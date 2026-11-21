import json
import unittest
from .support import has_deadlock, sdk_receipt

class Process:
    def __init__(self, output='', error=''):
        self.stdout, self.stderr = output, error

class Connections:
    items = []

class SupportTests(unittest.TestCase):
    def test_receipt_accepts_only_complete_true_assertions(self):
        value=sdk_receipt('{"status":"passed","assertions":{"cancel":true,"expire":true,"staleRevision":true,"oldContext":true},"fixtureIntentIds":["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222","33333333-3333-4333-8333-333333333333"]}\n')
        self.assertEqual(value['status'],'passed')

    def test_receipt_rejects_missing_or_false_assertions(self):
        with self.assertRaises(RuntimeError): sdk_receipt('{"status":"passed","assertions":{"cancel":false}}\n')

    def test_receipt_rejects_missing_or_malformed_fixture_ids(self):
        output='{"status":"passed","assertions":{"cancel":true,"expire":true,"staleRevision":true,"oldContext":true},"fixtureIntentIds":[]}\n'
        with self.assertRaises(RuntimeError): sdk_receipt(output)

    def test_deadlock_scans_process_and_connection_output(self):
        self.assertTrue(has_deadlock(Process(error='40P01'),Connections()))
        self.assertFalse(has_deadlock(Process(),Connections()))

    def test_fixture_ids_reject_wrong_types_duplicates_and_invalid_values(self):
        first='11111111-1111-4111-8111-111111111111'
        second='22222222-2222-4222-8222-222222222222'
        for ids in [None, [first,first,second], [[],first,second], ['invalid',first,second]]:
            with self.subTest(ids=ids), self.assertRaises(RuntimeError):
                sdk_receipt(json.dumps({'status':'passed','assertions':dict.fromkeys(['cancel','expire','staleRevision','oldContext'],True),'fixtureIntentIds':ids}))

if __name__ == '__main__': unittest.main()
