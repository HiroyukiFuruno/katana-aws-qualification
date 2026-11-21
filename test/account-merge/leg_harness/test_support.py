import json
import tempfile
import unittest
from pathlib import Path

from .__main__ import close


class Result:
    def __init__(self, code=0, text=''): self.returncode, self.stdout = code, text


class Docker:
    owned = [('leg-test-owned', 'fixture-id')]
    def run(self, *_args): return Result()


class Connections:
    def __init__(self, secret, errors): self.secret, self.errors = secret, errors; self.transcript = [{'line': json.dumps({'secret': secret})}]
    def close(self): return self.errors


class CloseTests(unittest.TestCase):
    def test_cleanup_failure_redacts_discovered_secret_in_written_artifact(self):
        secret = 'a' * 64
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, 'cleanup failed'):
                close(Docker(), Connections(secret, ['wait failed ' + secret]), Path(directory), set())
            text = (Path(directory) / 'cleanup.json').read_text()
        self.assertNotIn(secret, text); self.assertIn('[REDACTED]', text)

    def test_none_connections_writes_cleanup_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            close(Docker(), None, Path(directory), set())
            document = json.loads((Path(directory) / 'cleanup.json').read_text())
        self.assertEqual(document['connectionErrors'], [])
