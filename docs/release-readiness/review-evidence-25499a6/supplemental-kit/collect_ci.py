"""Collects the PUBLIC data of CI runs (GitHub API, no token): run, jobs, steps and artifact metadata.

    python -X utf8 collect_ci.py --out <folder> RUN_ID [RUN_ID ...]

Job logs and artifact contents need a signed-in user and are NOT collected here.
"""
import argparse, json, os, urllib.error, urllib.request

API = 'https://api.github.com/repos/Micha0371/PantryFlow/actions'


def get(url):
    req = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'ci-evidence'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def log_status(job_id):
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a):
            return None
    try:
        urllib.request.build_opener(NoRedirect).open(urllib.request.Request(f'{API}/jobs/{job_id}/logs', headers={'User-Agent': 'ci-evidence'}), timeout=30)
        return 200
    except urllib.error.HTTPError as e:
        return e.code


a = argparse.ArgumentParser()
a.add_argument('--out', required=True)
a.add_argument('runs', nargs='+')
args = a.parse_args()
os.makedirs(args.out, exist_ok=True)
for run_id in args.runs:
    r = get(f'{API}/runs/{run_id}')
    jobs = get(f'{API}/runs/{run_id}/jobs?per_page=50')['jobs']
    arts = get(f'{API}/runs/{run_id}/artifacts')['artifacts']
    data = {
        'run': {k: r[k] for k in ('id', 'name', 'event', 'head_branch', 'head_sha', 'run_attempt', 'status', 'conclusion', 'run_started_at', 'updated_at', 'html_url')},
        'jobs': [{**{k: j[k] for k in ('id', 'name', 'status', 'conclusion', 'started_at', 'completed_at', 'labels', 'html_url')},
                  'public_log_http_status': log_status(j['id']),
                  'steps': [{k: s[k] for k in ('number', 'name', 'conclusion', 'started_at', 'completed_at')} for s in j.get('steps', [])]} for j in jobs],
        'artifacts': [{k: x.get(k) for k in ('id', 'name', 'size_in_bytes', 'digest', 'expired', 'created_at', 'expires_at')} for x in arts],
        'not_available_without_sign_in': ['job logs', 'artifact contents (test counts, Maestro JUnit results, logcat)'],
    }
    with open(os.path.join(args.out, f'run-{run_id}.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=1)
    print(run_id, r['head_sha'][:7], r['status'], r['conclusion'], {j['name']: j['conclusion'] for j in jobs})
