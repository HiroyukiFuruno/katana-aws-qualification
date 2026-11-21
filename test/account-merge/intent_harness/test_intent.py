import unittest

from .controls import expression
from .redaction import contains_secret, discover_secrets, redact


class IntentHarnessUnitTests(unittest.TestCase):
    def test_recursive_redaction_and_scan(self):
        secret = 'nonce'
        value = {'outer': [{'inner': secret + '-suffix'}]}
        self.assertEqual(redact(value, {secret})['outer'][0]['inner'], '[REDACTED]-suffix')
        self.assertTrue(contains_secret(value, {secret}))
        self.assertFalse(contains_secret(redact(value, {secret}), {secret}))

    def test_control_expression_is_structured_call(self):
        self.assertTrue(expression('begin', kind="'add_existing'", intent_key='gen_random_uuid()').startswith('intent_harness.capture('))

    def test_discovers_nested_json_before_failure_serialization(self):
        transcript = [{'line': '{"value":{"secret":"nonce-value"}}'}]
        secrets = discover_secrets(transcript)
        self.assertEqual(secrets, {'nonce-value'})
        self.assertEqual(redact("failure ['nonce-value']", secrets), "failure ['[REDACTED]']")
