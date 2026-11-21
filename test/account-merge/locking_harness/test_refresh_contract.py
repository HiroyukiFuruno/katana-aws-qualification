import unittest
from datetime import datetime, timedelta, timezone

from .refresh_contract import instant


class InstantTests(unittest.TestCase):
    def expected(self, fraction, offset_hours):
        return datetime(
            2026,
            11,
            21,
            22,
            54,
            41,
            int((fraction + '000000')[:6]),
            tzinfo=timezone(timedelta(hours=offset_hours)),
        )

    def test_accepts_actual_five_digit_postgres_timestamp(self):
        actual = instant('2026-11-21T22:54:41.56626+00:00')
        self.assertEqual(actual, self.expected('56626', 0))
        self.assertEqual(actual.microsecond, 566260)

    def test_preserves_all_valid_fraction_widths_offsets_and_separators(self):
        offsets = [('Z', 0), ('+00', 0), ('+00:00', 0), ('-05', -5), ('-05:00', -5)]
        for width in range(7):
            fraction = '123456'[:width]
            for separator in ['T', ' ']:
                for suffix, hours in offsets:
                    value = f'2026-11-21{separator}22:54:41' + (f'.{fraction}' if fraction else '') + suffix
                    with self.subTest(value=value):
                        actual = instant(value)
                        expected = self.expected(fraction, hours)
                        self.assertEqual(actual.astimezone(timezone.utc), expected.astimezone(timezone.utc))
                        self.assertEqual(actual.microsecond, expected.microsecond)

    def test_rejects_missing_or_invalid_timestamps(self):
        with self.assertRaises(AssertionError):
            instant(None)
        for value in [
            '',
            'not-a-timestamp',
            '2026-11-21T22:54:41',
            '2026-11-21T22:54:41.1234567+00:00',
            '2026-11-21T22:54:41+000',
        ]:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    instant(value)
