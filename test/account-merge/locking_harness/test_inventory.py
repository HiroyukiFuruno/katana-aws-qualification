from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from .fixture import migration_inventory


def write_inventory(root, registered, files):
    (root / 'scripts').mkdir(); migrations = root / 'supabase/migrations'; migrations.mkdir(parents=True)
    (root / 'scripts/data-migrations.ts').write_text(
        'export const dataMigrations = [\n' + ''.join(f"  '{name}',\n" for name in registered) + '] as const;\n'
    )
    for name in files: (migrations / name).write_text('-- fixture\n')


class MigrationInventoryTests(unittest.TestCase):
    names = ['202611220001_first.sql', '202611220002_second.sql']

    def test_current_registry_has_canonical_prefix_and_private_helper_order(self):
        root = Path(__file__).resolve().parents[3]
        names = [path.name for path in migration_inventory(root)]
        self.assertEqual(names[:14], [
            '202611200001_learning_schema.sql',
            '202611200002_learning_writes.sql',
            '202611200003_learning_summaries.sql',
            '202611200004_profile_snapshot.sql',
            '202611200005_exam_clock.sql',
            '202611200006_revision_conflicts.sql',
            '202611200007_fundamentals_schema.sql',
            '202611200008_fundamentals_rpc.sql',
            '202611200009_fundamentals_guest_import.sql',
            '202611200010_fundamentals_catalog.sql',
            '202611210001_fundamentals_catalog_revision.sql',
            '202611210002_dashboard_summary.sql',
            '202611210003_dashboard_settings.sql',
            '202611210004_learning_account_foundation.sql',
        ])
        owner = '202611220001_learning_owner_shadow.sql'
        helper = '202611220002_learning_context_helpers.sql'
        grants = '202611220003_learning_session_grants.sql'
        self.assertEqual(names[14:], [owner, helper, grants])

    def test_rejects_missing_registered_sql(self):
        with TemporaryDirectory() as directory:
            root = Path(directory); write_inventory(root, self.names, self.names[:1])
            with self.assertRaisesRegex(AssertionError, 'differ'): migration_inventory(root)

    def test_rejects_extra_sql(self):
        with TemporaryDirectory() as directory:
            root = Path(directory); write_inventory(root, self.names[:1], self.names)
            with self.assertRaisesRegex(AssertionError, 'differ'): migration_inventory(root)

    def test_rejects_duplicate_and_daily_gap(self):
        with TemporaryDirectory() as directory:
            root = Path(directory); write_inventory(root, [self.names[0], self.names[0]], self.names[:1])
            with self.assertRaisesRegex(AssertionError, 'duplicate'): migration_inventory(root)
        with TemporaryDirectory() as directory:
            root = Path(directory); names = [self.names[0], '202611220003_third.sql']; write_inventory(root, names, names)
            with self.assertRaisesRegex(AssertionError, 'gap'): migration_inventory(root)
