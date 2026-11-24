"""Release-assurance detection probes (PantryFlow, 2026-11-24).

Applies one deliberate breakage at a time to a THROWAWAY clone, runs the Node suite and the component
suite, restores the file and records the result. No database, network or device is used by the suites.

    python -X utf8 run_probes.py --repo <clone>/pantry-flow --out <results folder> [IDS...]

The clone must be clean and at the evaluated commit. Do not point this at a working copy you care about.
"""
import argparse, datetime, getpass, hashlib, json, os, platform, re, socket, subprocess, sys, time

COMMIT = '25499a656c1e419883d95b6e9ade8cd0fa4fc791'
NODE_CMD = ['node', 'scripts/run-node-tests.cjs', '--test-concurrency=2', '--test-timeout=60000']
JEST_CMD = ['node', 'node_modules/jest/bin/jest.js', '--runInBand']

M1 = 'supabase/migrations/00001_first_slice.sql'
M2 = 'supabase/migrations/00002_review_hardening.sql'
M3 = 'supabase/migrations/00003_strict_duplicate_prevention.sql'
M4 = 'supabase/migrations/00004_shopping_items.sql'
LIST, ITEMS, SHOP, SCOPE = 'hooks/household-list.ts', 'hooks/usePantryItems.tsx', 'hooks/useShoppingItems.tsx', 'hooks/household-scope.tsx'


def rep(old, new, many=False):
    def change(text):
        n = text.count(old)
        if n == 0 or (n > 1 and not many):
            raise SystemExit(f'pattern found {n} times: {old!r}')
        return text.replace(old, new)
    return change


def first(old, new):
    return lambda text: text.replace(old, new, 1)


def policy(name, condition):
    def change(text):
        i = text.index(f'CREATE POLICY "{name}"')
        j = text.index(';', i)
        stmt = text[i:j]
        return text[:i] + stmt[:stmt.index('USING (')] + f'USING ({condition})' + text[j:]
    return change


def regex(pattern, new, count=0):
    return lambda text: re.sub(pattern, new, text, count=count)


FILTER = (LIST, rep('householdId ? items.filter(it => it.household_id === householdId) : []', 'items'))
CLEAR = (LIST, rep('    setItems([]);\n    void fetchItems();', '    void fetchItems();'))
PANTRY_KEY = (ITEMS, rep("<ScopedPantryProvider key={user?.id ?? 'guest'}>", '<ScopedPantryProvider>'))
HOUSEHOLD_KEY = (SCOPE, rep("<ScopedHouseholdProvider key={user?.id ?? 'guest'}>", '<ScopedHouseholdProvider>'))
SHOPPING_KEY = (SHOP, rep("key={user?.id ?? 'guest'}", ''))

# (id, description, [(file, change)])
PROBES = [
    ('S1', 'pantry SELECT policy open to all', [(M1, policy('items_select_member', 'true'))]),
    ('S2', 'pantry UPDATE policy open to all', [(M1, policy('items_update_member', 'true'))]),
    ('S3', 'pantry DELETE policy open to all', [(M1, policy('items_delete_member', 'true'))]),
    ('S4', 'pantry INSERT: creator not checked', [(M2, rep('created_by = auth.uid() AND household_id IN (', 'household_id IN ('))]),
    ('S5', 'pantry INSERT: household not checked', [(M2, regex(r'created_by = auth\.uid\(\) AND household_id IN \(\s*SELECT household_id FROM public\.pantry_household_members\s*WHERE user_id = auth\.uid\(\)\s*\)', 'created_by = auth.uid()'))]),
    ('S6', 'premium flag writable by users', [(M2, rep('GRANT UPDATE (name, language)', 'GRANT UPDATE (name, language, is_premium)'))]),
    ('S7', 'creator column writable by users', [(M2, rep('GRANT UPDATE (name, status, category, location)', 'GRANT UPDATE (name, status, category, location, created_by)'))]),
    ('S8', 'profile SELECT policy open to all', [(M1, policy('profiles_select_own', 'true'))]),
    ('S9', 'household SELECT policy open to all', [(M1, policy('households_select_member', 'true'))]),
    ('S10', 'shopping SELECT policy open to all', [(M4, regex(r'(shopping_select_member ON public\.pantry_shopping_items\s+FOR SELECT TO authenticated USING \()[^;]*\);', r'\1true);'))]),
    ('S11', 'signed-out users reach protected routes', [('components/AuthGate.tsx', rep('if (requireSession && !session)', 'if (false)'))]),
    ('S12', 'PKCE flow replaced by implicit', [('lib/supabase.ts', rep("flowType: 'pkce'", "flowType: 'implicit'"))]),
    ('S13', 'confirmation link accepted while signed in', [('lib/email-confirmation.ts', rep("if (current.data.session) throw new Error('Already signed in');", ''))]),
    ('S14', 'error parameters in a confirmation link ignored', [('lib/email-confirmation.ts', rep('if (params.error !== undefined || params.error_code !== undefined || params.error_description !== undefined) return null;', ''))]),
    ('D1', 'duplicate index missing', [(M3, regex('CREATE UNIQUE INDEX pantry_items_household_normalized_name_key', 'CREATE INDEX pantry_items_household_normalized_name_key'))]),
    ('D2', 'legacy duplicate guard in 00003 removed (CONFOUNDED: also removes the unique index, as in the original run)', [(M3, lambda t: t.replace('HAVING count(*) > 1', 'HAVING count(*) > 1000000').replace('CREATE UNIQUE INDEX', 'CREATE INDEX'))]),
    ('D3', 'deleting an author deletes shared items', [(M2, rep('ON DELETE SET NULL', 'ON DELETE CASCADE'))]),
    ('D4', 'status write without compare-and-set', [('lib/pantry-data.ts', rep(".eq('status', prev)", ''))]),
    ('D5', 'status write: uncoded failure treated as rejected', [('lib/pantry-data.ts', rep("throw typeof code === 'string' && code !== '' ? error : uncertain(error);", 'throw error;'))]),
    ('D6', 'delete of zero rows reported as success', [(ITEMS, rep("if (!data?.length) throw Object.assign(new Error('Item was not deleted'), { code: PANTRY_MISSING });", ''))]),
    ('D7', 'truncated list accepted as complete', [('lib/pagination.ts', rep("if (received < PAGE_SIZE) throw new Error('Server row limit is below page size');", 'if (received < PAGE_SIZE) return true;'))]),
    ('D8', 'language save of zero rows reported as success', [('lib/profile-language.ts', rep("if (!data || data.length === 0) throw new Error('Profile language was not saved: no profile row was updated.');", ''))]),
    ('F1', 'late read of a previous user or household applied', [(LIST, rep('mounted.current && currentScope.current === started', 'mounted.current'))]),
    ('F2', 'rows of another household stay visible (row filter removed)', [FILTER]),
    ('F3', 'older read overwrites newer one', [(LIST, rep('request === generation.current', 'true', many=True))]),
    ('F4', 'pantry state not reset on user change (provider key removed)', [PANTRY_KEY]),
    ('F5', 'double submit not locked', [('hooks/useItemMutation.ts', rep('if (locked.current) return;', ''))]),
    ('F6', 'finished request navigates an abandoned screen', [('hooks/useItemMutation.ts', rep('if (current()) success();', 'success();'))]),
    ('F7', 'failed sign-out shown as success', [('lib/auth.tsx', rep('const { error: err } = await supabase.auth.signOut();\n    if (err) throw err;', 'await supabase.auth.signOut();'))]),
    ('F8', 'failed session restore hidden', [('lib/auth.tsx', rep("setSession(null); setError('err_restore_session');", 'setSession(null);'))]),
    ('F9', 'missing German key', [('lib/i18n/de.ts', regex(r'\n\s*settings_language:[^\n]*', '', 1))]),
    ('A1', 'chips lose the checked state', [('components/OptionChips.tsx', rep('accessibilityState={{ checked: selected }}', ''))]),
    ('A2', 'pantry row loses role', [('components/PantryItem.tsx', first('accessibilityRole="button"', ''))]),
    ('A3', 'field error not announced', [('components/InlineError.tsx', rep('accessibilityRole="alert" ', ''))]),
]
COMBOS = [
    ('C1', 'clear-on-change removed', [CLEAR]),
    ('C2', 'row filter + clear removed', [FILTER, CLEAR]),
    ('C3', 'pantry provider key + row filter removed', [PANTRY_KEY, FILTER]),
    ('C4', 'pantry provider key + row filter + clear removed', [PANTRY_KEY, FILTER, CLEAR]),
    ('C5', 'household provider key removed', [HOUSEHOLD_KEY]),
    ('C6', 'household key + pantry key + row filter + clear removed', [HOUSEHOLD_KEY, PANTRY_KEY, FILTER, CLEAR]),
    ('C7', 'shopping provider key removed', [SHOPPING_KEY]),
]
# Not part of the reported 34: isolates what D2 confounded.
EXTRA = [('X1', 'legacy duplicate guard in 00003 removed, unique index kept', [(M3, rep('HAVING count(*) > 1', 'HAVING count(*) > 1000000'))])]


def sanitizer(repo):
    paths = {repo, os.path.dirname(repo), os.path.realpath(repo), os.path.dirname(os.path.realpath(repo))}
    pairs = []
    for p in sorted(paths, key=len, reverse=True):
        name = '<clone>/pantry-flow' if p.rstrip('\\/').endswith('pantry-flow') else '<clone>'
        for v in {p, p.replace('\\', '/'), p.replace('\\', '\\\\'), 'file:///' + p.replace('\\', '/')}:
            pairs.append((v, name))
    home = os.path.expanduser('~')
    for v in {home, home.replace('\\', '/'), home.replace('\\', '\\\\')}:
        pairs.append((v, '<home>'))
    pairs += [(socket.gethostname(), '<host>')]
    user = getpass.getuser()

    def clean(text):
        text = re.sub(r'\x1b\[[0-9;]*m', '', text)
        for old, new in pairs:
            text = re.sub(re.escape(old), lambda _: new, text, flags=re.I)
        return re.sub(r'(?i)(?<=[\\/])' + re.escape(user) + r'(?=[\\/])', '<user>', text)
    return clean


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def run(cmd, log, clean):
    started = time.time()
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', timeout=900)
    text = clean(p.stdout)
    with open(log, 'w', encoding='utf-8', newline='\n') as f:
        f.write(f'$ {" ".join(cmd)}\n{text}\n[exit code {p.returncode}]\n')
    return p.returncode, text, round(time.time() - started, 1)


def number(text, label):
    m = re.search(rf'^ℹ {label} (\d+)', text, re.M)
    return int(m.group(1)) if m else None


def suite(pid, logs, clean):
    rc, out, sec = run(NODE_CMD, os.path.join(logs, f'{pid}.node.log'), clean)
    seed = re.search(r'Randomized test order seed: (\d+)', out)
    node = {'exit': rc, 'seconds': sec, 'seed': seed.group(1) if seed else None,
            **{k: number(out, k) for k in ('tests', 'pass', 'fail', 'cancelled', 'skipped')},
            'failing': sorted(set(re.findall(r'^\s*✖ (?!failing)(.+?) \([\d.]+ms\)', out, re.M))),
            'load_errors': sorted(set(re.findall(r'(SyntaxError[^\n]*|Cannot find module[^\n]*)', out)))[:5]}
    rc, out, sec = run(JEST_CMD, os.path.join(logs, f'{pid}.jest.log'), clean)
    tests = re.search(r'^Tests: +(.*)$', out, re.M)
    jest = {'exit': rc, 'seconds': sec, 'tests': tests.group(1).strip() if tests else None,
            'failing': re.findall(r'^\s*● (.+)$', out, re.M)[:10]}
    return {'node': node, 'jest': jest}


def environment(repo, clean):
    def out(*cmd):
        return subprocess.run(cmd, capture_output=True, text=True, shell=(os.name == 'nt')).stdout.strip()

    def version(pkg):
        try:
            return json.load(open(os.path.join(repo, 'node_modules', pkg, 'package.json'), encoding='utf-8'))['version']
        except OSError:
            return None
    pg = subprocess.run(['node', '-e', "const{PGlite}=require('@electric-sql/pglite');(async()=>{const d=new PGlite();console.log((await d.query('select version()')).rows[0].version);await d.close()})()"], capture_output=True, text=True, cwd=repo).stdout.strip()
    return {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'commit': out('git', 'rev-parse', 'HEAD'),
            'clone_status_empty': out('git', 'status', '--porcelain') == '', 'os': platform.platform(), 'logical_cpus': os.cpu_count(),
            'python': platform.python_version(), 'node': out('node', '--version'), 'npm': out('npm', '--version'), 'git': out('git', '--version'),
            'core.autocrlf': out('git', 'config', 'core.autocrlf'), 'install': 'npm ci --ignore-scripts --no-audit --no-fund; on Windows also: node scripts/patch-expo-windows.cjs',
            'package_lock_sha256': sha(os.path.join(repo, 'package-lock.json')), 'pglite_server': pg,
            'packages': {p: version(p) for p in ('@electric-sql/pglite', 'jest', 'jest-expo', 'typescript', 'react', 'react-native', 'expo', '@supabase/supabase-js', '@testing-library/react-native')},
            'commands': {'node': ' '.join(NODE_CMD), 'components': ' '.join(JEST_CMD)}}


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--repo', required=True)
    a.add_argument('--out', required=True)
    a.add_argument('ids', nargs='*')
    args = a.parse_args()
    repo, outdir = os.path.abspath(args.repo), os.path.abspath(args.out)
    logs, patches = os.path.join(outdir, 'logs'), os.path.join(outdir, 'patches')
    for d in (logs, patches):
        os.makedirs(d, exist_ok=True)
    os.chdir(repo)
    clean = sanitizer(repo)
    env = environment(repo, clean)
    if env['commit'] != COMMIT or not env['clone_status_empty']:
        raise SystemExit(f"refusing: commit {env['commit']}, clean {env['clone_status_empty']}")
    json.dump(env, open(os.path.join(outdir, 'environment.json'), 'w', encoding='utf-8', newline='\n'), indent=1)

    results = {}
    path = os.path.join(outdir, 'results.json')

    def save():
        json.dump(results, open(path, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)

    selected = [p for p in [*PROBES, *COMBOS, *EXTRA] if not args.ids or p[0] in args.ids]
    results['baseline_before'] = suite('baseline_before', logs, clean)
    save()
    print('baseline_before', results['baseline_before']['node']['tests'], results['baseline_before']['jest']['tests'], flush=True)
    base = results['baseline_before']
    if base['node']['exit'] or base['jest']['exit'] or not base['node']['tests'] or not base['jest']['tests']:
        raise SystemExit(f"refusing: the unmodified baseline is not green: {base['node']['failing']} {base['jest']['failing']}")
    for pid, what, changes in selected:
        originals = {}
        try:
            for file, change in changes:
                raw = open(file, 'rb').read()
                originals.setdefault(file, raw)
                text = raw.decode('utf-8')
                crlf = '\r\n' in text
                before = text.replace('\r\n', '\n')
                after = change(before)
                if after == before:
                    raise SystemExit(f'{pid}: no change in {file}')
                open(file, 'wb').write((after.replace('\n', '\r\n') if crlf else after).encode('utf-8'))
            diff = subprocess.run(['git', 'diff', '--no-color', '--', *originals], capture_output=True).stdout
            open(os.path.join(patches, f'{pid}.patch'), 'wb').write(diff)
            r = suite(pid, logs, clean)
        finally:
            for file, raw in originals.items():
                open(file, 'wb').write(raw)
        r['restored'] = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True).stdout.strip() == ''
        r.update(description=what, files=sorted(originals),
                 verdict='DETECTED' if r['node']['exit'] or r['jest']['exit'] else 'SURVIVED')
        results[pid] = r
        save()
        print(r['verdict'], pid, what, '| node', r['node']['fail'], 'failed of', r['node']['tests'], '| jest', r['jest']['tests'], '| restored', r['restored'], flush=True)
    results['baseline_after'] = suite('baseline_after', logs, clean)
    save()
    after = results['baseline_after']
    if after['node']['exit'] or after['jest']['exit']:
        raise SystemExit('INVALID RUN: the baseline after the probes is not green')
    print('baseline_after', results['baseline_after']['node']['tests'], results['baseline_after']['jest']['tests'], flush=True)
    print('DONE', flush=True)


main()
