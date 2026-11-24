# Sanitized author evidence; mutation logic unchanged; see README.md.
import os, re, subprocess, json, sys, time
# Portability adapter: only run in an explicitly marked disposable clone.
from pathlib import Path
ROOT = os.environ.get('PANTRY_REVIEW_PROBE_ROOT', '')
if not ROOT:
    raise SystemExit('Set PANTRY_REVIEW_PROBE_ROOT to pantry-flow in a disposable clone')
ROOT = str(Path(ROOT).resolve())
if not (Path(ROOT).parent / '.review-probe-disposable').is_file():
    raise SystemExit('Missing disposable-clone marker .review-probe-disposable')
os.chdir(ROOT)
ITEMS = "household_id IN (\n      SELECT household_id\n      FROM public.pantry_household_members\n      WHERE user_id = auth.uid()\n    )"
M1, M2, M3, M4 = ('supabase/migrations/00001_first_slice.sql', 'supabase/migrations/00002_review_hardening.sql',
                  'supabase/migrations/00003_strict_duplicate_prevention.sql', 'supabase/migrations/00004_shopping_items.sql')

def policy(text, name, new):
    """Replace the USING(...) expression of one items policy in 00001."""
    i = text.index(f'CREATE POLICY "{name}"')
    j = text.index(';', i)
    stmt = text[i:j]
    k = stmt.index('USING (')
    return text[:i] + stmt[:k] + f'USING ({new})' + text[j:]

def rep(old, new, count=1):
    def f(t):
        assert t.count(old) >= 1, ('not found', old)
        if count == 1:
            assert t.count(old) == 1, ('ambiguous', t.count(old), old)
        return t.replace(old, new)
    return f

P = [
 # security: in-memory database
 ('S1', 'pantry SELECT policy open to all', M1, lambda t: policy(t, 'items_select_member', 'true')),
 ('S2', 'pantry UPDATE policy open to all', M1, lambda t: policy(t, 'items_update_member', 'true')),
 ('S3', 'pantry DELETE policy open to all', M1, lambda t: policy(t, 'items_delete_member', 'true')),
 ('S4', 'pantry INSERT: creator not checked', M2, rep('created_by = auth.uid() AND household_id IN (', 'household_id IN (')),
 ('S5', 'pantry INSERT: household not checked', M2, lambda t: re.sub(r'created_by = auth\.uid\(\) AND household_id IN \(\s*SELECT household_id FROM public\.pantry_household_members\s*WHERE user_id = auth\.uid\(\)\s*\)', 'created_by = auth.uid()', t)),
 ('S6', 'premium flag writable by users', M2, rep('GRANT UPDATE (name, language)', 'GRANT UPDATE (name, language, is_premium)')),
 ('S7', 'creator column writable by users', M2, rep('GRANT UPDATE (name, status, category, location)', 'GRANT UPDATE (name, status, category, location, created_by)')),
 ('S8', 'profile SELECT policy open to all', M1, lambda t: policy(t, 'profiles_select_own', 'true')),
 ('S9', 'household SELECT policy open to all', M1, lambda t: policy(t, 'households_select_member', 'true')),
 ('S10', 'shopping SELECT policy open to all', M4, lambda t: re.sub(r'(shopping_select_member ON public\.pantry_shopping_items\s+FOR SELECT TO authenticated USING \()[^;]*\);', r'\1true);', t)),
 ('S11', 'signed-out users reach protected routes', 'components/AuthGate.tsx', rep('if (requireSession && !session)', 'if (false)')),
 ('S12', 'PKCE flow replaced by implicit', 'lib/supabase.ts', rep("flowType: 'pkce'", "flowType: 'implicit'")),
 ('S13', 'confirmation link accepted while signed in', 'lib/email-confirmation.ts', rep("if (current.data.session) throw new Error('Already signed in');", '')),
 ('S14', 'error parameters in a confirmation link ignored', 'lib/email-confirmation.ts', rep("if (params.error !== undefined || params.error_code !== undefined || params.error_description !== undefined) return null;", '')),
 # data integrity
 ('D1', 'duplicate index missing', M3, lambda t: re.sub(r'CREATE UNIQUE INDEX pantry_items_household_normalized_name_key', 'CREATE INDEX pantry_items_household_normalized_name_key', t)),
 ('D2', 'legacy duplicate guard in 00003 removed', M3, lambda t: t.replace('HAVING count(*) > 1', 'HAVING count(*) > 1000000').replace('CREATE UNIQUE INDEX', 'CREATE INDEX')),
 ('D3', 'deleting an author deletes shared items', M2, rep('ON DELETE SET NULL', 'ON DELETE CASCADE')),
 ('D4', 'status write without compare-and-set', 'lib/pantry-data.ts', rep(".eq('status', prev)", '')),
 ('D5', 'status write: uncoded failure treated as rejected', 'lib/pantry-data.ts', rep("throw typeof code === 'string' && code !== '' ? error : uncertain(error);", 'throw error;')),
 ('D6', 'delete of zero rows reported as success', 'hooks/usePantryItems.tsx', rep("if (!data?.length) throw Object.assign(new Error('Item was not deleted'), { code: PANTRY_MISSING });", '')),
 ('D7', 'truncated list accepted as complete', 'lib/pagination.ts', rep("if (received < PAGE_SIZE) throw new Error('Server row limit is below page size');", 'if (received < PAGE_SIZE) return true;')),
 ('D8', 'language save of zero rows reported as success', 'lib/profile-language.ts', rep("if (!data || data.length === 0) throw new Error('Profile language was not saved: no profile row was updated.');", '')),
 # functional / state
 ('F1', 'late read of a previous user or household applied', 'hooks/household-list.ts', rep('mounted.current && currentScope.current === started', 'mounted.current')),
 ('F2', 'rows of another household stay visible', 'hooks/household-list.ts', rep('householdId ? items.filter(it => it.household_id === householdId) : []', 'items')),
 ('F3', 'older read overwrites newer one', 'hooks/household-list.ts', rep('request === generation.current', 'true', 0)),
 ('F4', 'pantry state not reset on user change', 'hooks/usePantryItems.tsx', rep("<ScopedPantryProvider key={user?.id ?? 'guest'}>", '<ScopedPantryProvider>')),
 ('F5', 'double submit not locked', 'hooks/useItemMutation.ts', rep('if (locked.current) return;', '')),
 ('F6', 'finished request navigates an abandoned screen', 'hooks/useItemMutation.ts', rep('if (current()) success();', 'success();')),
 ('F7', 'failed sign-out shown as success', 'lib/auth.tsx', rep("const { error: err } = await supabase.auth.signOut();\n    if (err) throw err;", 'await supabase.auth.signOut();')),
 ('F8', 'failed session restore hidden', 'lib/auth.tsx', rep("setSession(null); setError('err_restore_session');", 'setSession(null);')),
 ('F9', 'missing German key', 'lib/i18n/de.ts', lambda t: re.sub(r"\n\s*settings_language:[^\n]*", '', t, count=1)),
 # accessibility
 ('A1', 'chips lose the checked state', 'components/OptionChips.tsx', rep('accessibilityState={{ checked: selected }}', '')),
 ('A2', 'pantry row loses role', 'components/PantryItem.tsx', lambda t: t.replace('accessibilityRole="button"', '', 1)),
 ('A3', 'field error not announced', 'components/InlineError.tsx', rep('accessibilityRole="alert" ', '')),
]

def suite():
    out = {}
    r = subprocess.run(['node', 'scripts/run-node-tests.cjs', '--test-concurrency=2', '--test-timeout=60000'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600)
    out['node'] = (r.returncode, sorted(set(re.findall(r'^\s*\u2716 (?!failing)(.+?) \([\d.]+ms\)', r.stdout, re.M))), re.findall(r'^\u2139 tests (\d+)', r.stdout, re.M))
    r = subprocess.run('npx --no-install jest --runInBand', shell=True, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600)
    out['jest'] = (r.returncode, re.findall(r'^Tests: .*', re.sub(r'\x1b\[[0-9;]*m', '', r.stderr + r.stdout), re.M))
    return out

only = sys.argv[1:]
if not only:
    print('BASE', suite(), flush=True)
for pid, what, path, change in P:
    if only and pid not in only:
        continue
    orig = open(path, 'rb').read()
    crlf = b'\r\n' in orig
    t = orig.decode('utf-8').replace('\r\n', '\n')
    try:
        new = change(t)
    except AssertionError as e:
        print('SKIPPED', pid, what, e, flush=True)
        continue
    if new == t:
        print('SKIPPED', pid, what, 'no change', flush=True)
        continue
    open(path, 'wb').write((new.replace('\n', '\r\n') if crlf else new).encode('utf-8'))
    try:
        s = suite()
    finally:
        open(path, 'wb').write(orig)
    hit = s['node'][0] != 0 or s['jest'][0] != 0
    print('DETECTED ' if hit else 'SURVIVED ', pid, '|', what, '| node failures:', len(s['node'][1]), s['node'][1][:2], '| jest rc', s['jest'][0], flush=True)
print('DONE', flush=True)
