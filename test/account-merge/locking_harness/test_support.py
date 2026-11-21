import json
import io
from copy import deepcopy
from pathlib import Path
from subprocess import CompletedProcess
from tempfile import TemporaryDirectory
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from .__main__ import cleanup
from .connections import Connection
from .refresh_contract import verify_refresh_contract
from .support import Docker


class DockerOwnershipTests(unittest.TestCase):
    def test_start_failure_remains_owned_for_cleanup(self):
        docker = Docker()
        replies = iter([
            CompletedProcess([], 0, 'owned-id\n', ''),
            CompletedProcess([], 1, '', 'start failed'),
        ])
        docker.run = lambda *args, **kwargs: next(replies)
        with self.assertRaises(RuntimeError):
            docker.create('owned-name', 'image:tag')
        self.assertEqual(docker.owned, [('owned-name', 'owned-id')])


class CleanupTests(unittest.TestCase):
    def test_cleanup_without_connections_removes_only_owned_identifiers(self):
        class FakeDocker:
            owned = [('owned-name', 'owned-id')]

            def __init__(self):
                self.calls = []

            def run(self, *args):
                self.calls.append(args)
                if args[0] == 'inspect':
                    return CompletedProcess([], 1, '', 'not running')
                return CompletedProcess([], 0, '', '')

        docker = FakeDocker()
        with TemporaryDirectory() as directory:
            artifacts = Path(directory)
            cleanup(docker, None, artifacts)
            receipt = json.loads((artifacts / 'cleanup.json').read_text())
            self.assertEqual(receipt['containers'][0]['id'], 'owned-id')
            self.assertEqual((artifacts / 'concurrency.ndjson').read_text(), '')
        self.assertEqual([call[0] for call in docker.calls], ['inspect', 'stop', 'container', 'ps'])


class ConnectionCommandTests(unittest.TestCase):
    def test_connection_uses_docker_and_merged_psql_stream(self):
        class Process:
            stdin = io.StringIO()
            stdout = io.StringIO('pid:456\n')

            def poll(self): return 0

        owner = SimpleNamespace(database='owned-db', events=threading.Condition(), transcript=[], context_sql=lambda actor: '')
        with patch('locking_harness.connections.subprocess.Popen', return_value=Process()) as popen:
            Connection('argv', None, owner)
        argv = popen.call_args.args[0]
        self.assertEqual(argv[0], 'docker')
        self.assertEqual(argv[4:6], ['sh', '-ec'])
        self.assertIn('2>&1', argv[6])


class RefreshContractTests(unittest.TestCase):
    first, second, third = 'first', 'second', 'third'
    start, finish = '2026-11-21T00:00:00+00:00', '2026-11-21T00:10:00+00:00'

    def user(self, updated):
        return {'timestamps': {'last_sign_in_at': None, 'updated_at': updated}, 'columnHashes': {'email': 'email'}, 'protectedHash': 'protected'}

    def evidence(self):
        users_before = {user: self.user('2026-11-21T00:00:00+00:00') for user in [self.first, self.second, self.third]}
        users_after = deepcopy(users_before)
        for user in [self.first, self.third]: users_after[user]['timestamps']['updated_at'] = '2026-11-21T00:01:00+00:00'
        before = {'hashes': {'old': 'old-hash'}, 'metadata': {'old': {'action': 'old', 'actorId': 'old', 'createdAt': self.start}}}
        after = deepcopy(before)
        for index, (actor, action) in enumerate([(self.first, 'token_refreshed'), (self.first, 'token_revoked'), (self.third, 'token_refreshed'), (self.third, 'token_revoked')]):
            row_id = f'new-{index}'; after['hashes'][row_id] = row_id; after['metadata'][row_id] = {'action': action, 'actorId': actor, 'createdAt': '2026-11-21T00:05:00+00:00'}
        return users_before, users_after, before, after

    def verify(self, users_before, users_after, audit_before, audit_after):
        verify_refresh_contract({}, {}, users_before, users_after, audit_before, audit_after, self.first, self.third, self.start, self.finish)

    def test_accepts_only_two_refreshes(self):
        self.verify(*self.evidence())

    def test_rejects_protected_user_change(self):
        evidence = self.evidence(); evidence[1][self.first]['protectedHash'] = 'changed'
        with self.assertRaises(AssertionError): self.verify(*evidence)

    def test_rejects_second_user_change_and_time_regression(self):
        evidence = self.evidence(); evidence[1][self.second]['timestamps']['updated_at'] = '2026-11-21T00:01:00+00:00'
        with self.assertRaises(AssertionError): self.verify(*evidence)
        evidence = self.evidence(); evidence[1][self.first]['timestamps']['updated_at'] = '2026-11-20T23:59:00+00:00'
        with self.assertRaises(AssertionError): self.verify(*evidence)

    def test_rejects_audit_deletion_modification_and_extra_action(self):
        evidence = self.evidence(); del evidence[3]['hashes']['old']
        with self.assertRaises(AssertionError): self.verify(*evidence)
        evidence = self.evidence(); evidence[3]['hashes']['old'] = 'changed'
        with self.assertRaises(AssertionError): self.verify(*evidence)
        evidence = self.evidence(); evidence[3]['metadata']['new-0']['actorId'] = self.second
        with self.assertRaises(AssertionError): self.verify(*evidence)
