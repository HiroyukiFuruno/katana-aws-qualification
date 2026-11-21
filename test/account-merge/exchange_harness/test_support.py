import tempfile
import unittest
from pathlib import Path

from intent_harness.redaction import contains_secret, redact
from .__main__ import close


class Result:
    def __init__(self, code=0, text=''): self.returncode, self.stdout, self.stderr = code, text, ''


class Docker:
    owned=[('exchange-test-owned','fixture-id')]
    def run(self,*_args): return Result()


class CloseTests(unittest.TestCase):
    def test_none_connections_still_writes_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            close(Docker(),None,Path(directory),set())
            self.assertTrue((Path(directory)/'cleanup.json').exists())

    def test_redaction_covers_discovered_secret(self):
        secret='a'*64
        self.assertNotIn(secret,redact('failure '+secret,{secret}))
        self.assertFalse(contains_secret('failure [REDACTED]',{secret}))
