# Sanitized author evidence; mutation logic unchanged; see README.md.
import os,re,subprocess
# Portability adapter: only run in an explicitly marked disposable clone.
from pathlib import Path
ROOT = os.environ.get('PANTRY_REVIEW_PROBE_ROOT', '')
if not ROOT:
    raise SystemExit('Set PANTRY_REVIEW_PROBE_ROOT to pantry-flow in a disposable clone')
ROOT = str(Path(ROOT).resolve())
if not (Path(ROOT).parent / '.review-probe-disposable').is_file():
    raise SystemExit('Missing disposable-clone marker .review-probe-disposable')
os.chdir(ROOT)
L='hooks/household-list.ts';U='hooks/usePantryItems.tsx';H='hooks/household-scope.tsx'
F2=(L,"householdId ? items.filter(it => it.household_id === householdId) : []","items")
F4=(U,"<ScopedPantryProvider key={user?.id ?? 'guest'}>","<ScopedPantryProvider>")
CL=(L,"    setItems([]);\n    void fetchItems();","    void fetchItems();")
HK=(H,"<ScopedHouseholdProvider key={user?.id ?? 'guest'}>","<ScopedHouseholdProvider>")
SK=('hooks/useShoppingItems.tsx',"key={user?.id ?? 'guest'}","")
def run(name,ms):
    orig={}
    for p,o,n in ms:
        b=open(p,'rb').read(); orig.setdefault(p,b)
        t=b.decode().replace('\r\n','\n'); assert t.count(o)==1,(p,o,t.count(o))
        open(p,'wb').write(t.replace(o,n).encode())
    try: r=subprocess.run(['node','scripts/run-node-tests.cjs','--test-concurrency=2','--test-timeout=60000'],capture_output=True,text=True,encoding='utf-8',errors='replace')
    finally:
        for p,b in orig.items(): open(p,'wb').write(b)
    f=sorted(set(re.findall('^\s*✖ (?!failing)(.+?) \([\d.]+ms\)',r.stdout,re.M)))
    print('DETECTED' if r.returncode else 'SURVIVED',name,len(f),f[:2],flush=True)
run('clear-on-change removed',[CL]); run('filter + clear removed',[F2,CL]); run('provider key + filter removed',[F4,F2]); run('provider key + filter + clear removed',[F4,F2,CL]); run('household key removed',[HK]); run('household key + provider key + filter + clear removed',[HK,F4,F2,CL])
try: run('shopping provider key removed',[SK])
except AssertionError as e: print('skip',e)
