import unittest
from .support import has_deadlock, sdk_receipt

class Process:
    def __init__(self, output='', error=''):
        self.stdout, self.stderr = output, error

class Connections:
    items = []

class SupportTests(unittest.TestCase):
    def test_receipt_accepts_only_complete_true_assertions(self):
        value=sdk_receipt('{"status":"passed","assertions":{"cancel":true,"expire":true,"staleRevision":true,"oldContext":true}}\n')
        self.assertEqual(value['status'],'passed')

    def test_receipt_rejects_missing_or_false_assertions(self):
        with self.assertRaises(RuntimeError): sdk_receipt('{"status":"passed","assertions":{"cancel":false}}\n')

    def test_deadlock_scans_process_and_connection_output(self):
        self.assertTrue(has_deadlock(Process(error='40P01'),Connections()))
        self.assertFalse(has_deadlock(Process(),Connections()))

if __name__ == '__main__': unittest.main()
