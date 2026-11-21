from datetime import datetime, timezone
from pathlib import Path
import json
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = ROOT / 'supabase' / 'migrations'
DEFAULT_ARTIFACTS = ROOT / 'test-results' / 'account-merge' / 'locking-harness'


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


class Docker:
    def __init__(self):
        self.owned = []

    def run(self, *args, **kwargs):
        return subprocess.run(['docker', *args], capture_output=True, text=True, **kwargs)

    def create(self, name, *args):
        result = self.run('create', '--pull', 'never', '--name', name, *args)
        if result.returncode:
            raise RuntimeError(result.stderr)
        identifier = result.stdout.strip()
        self.owned.append((name, identifier))
        started = self.run('start', identifier)
        if started.returncode:
            raise RuntimeError(started.stderr)
        return identifier

    def reject_existing(self, *names):
        for name in names:
            result = self.run('ps', '-a', '--filter', f'name=^/{name}$', '--format', '{{.ID}} {{.Names}}')
            if result.returncode or result.stdout.strip():
                raise RuntimeError('Existing dedicated container was not touched: ' + result.stdout + result.stderr)

    def wait_ready(self, callback, label):
        deadline = time.monotonic() + 40
        while not callback():
            if time.monotonic() >= deadline:
                raise RuntimeError('Readiness failed: ' + label)


def require(condition, message):
    if not condition:
        raise AssertionError(message)
