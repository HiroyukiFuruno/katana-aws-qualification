import unittest
from datetime import timezone

from .refresh_contract import instant


class InstantTests(unittest.TestCase):
    def test_accepts_postgres_short_utc_offset(self):
        value = instant('2026-11-21 22:18:22.444165+00')
        self.assertEqual(value.astimezone(timezone.utc).isoformat(), '2026-11-21T22:18:22.444165+00:00')

    def test_accepts_z_and_complete_offsets_as_the_same_utc_instant(self):
        expected = instant('2026-11-21T22:18:22.444165+00:00')
        for value in [
            '2026-11-21T22:18:22.444165Z',
            '2026-11-21T17:18:22.444165-05:00',
            '2026-11-21T17:18:22.444165-05',
        ]:
            with self.subTest(value=value):
                self.assertEqual(instant(value).astimezone(timezone.utc), expected.astimezone(timezone.utc))

    def test_rejects_missing_or_invalid_timestamps(self):
        with self.assertRaises(AssertionError):
            instant(None)
        for value in ['', 'not-a-timestamp', '2026-11-21T22:18:22.444165']:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    instant(value)
