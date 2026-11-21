from datetime import datetime


def instant(value):
    if not isinstance(value, str):
        raise AssertionError('Refresh timestamp is missing')
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def verify_users(before, after, first_id, third_id):
    if set(before) != set(after) or len(before) != 3:
        raise AssertionError('Refresh changed the fixture user inventory')
    for user_id in before:
        prior, current = before[user_id], after[user_id]
        if user_id not in {first_id, third_id}:
            if prior != current:
                raise AssertionError('Refresh changed an unrelated user')
            continue
        if prior['timestamps']['last_sign_in_at'] != current['timestamps']['last_sign_in_at']:
            raise AssertionError('Refresh changed last_sign_in_at')
        if prior['protectedHash'] != current['protectedHash'] or prior['columnHashes'] != current['columnHashes']:
            raise AssertionError('Refresh changed a protected user column')
        if set(prior['timestamps']) != {'last_sign_in_at', 'updated_at'} or set(current['timestamps']) != {'last_sign_in_at', 'updated_at'}:
            raise AssertionError('Unexpected user timestamp columns')
        if instant(current['timestamps']['updated_at']) <= instant(prior['timestamps']['updated_at']):
            raise AssertionError('Refresh did not advance updated_at')


def verify_audit(before, after, first_id, third_id, refresh_started, refresh_finished):
    before_hashes, after_hashes = before['hashes'], after['hashes']
    if not set(before_hashes).issubset(after_hashes):
        raise AssertionError('Refresh removed an existing audit row')
    if any(after_hashes[row_id] != row_hash for row_id, row_hash in before_hashes.items()):
        raise AssertionError('Refresh modified an existing audit row')
    added = {row_id: after['metadata'][row_id] for row_id in after_hashes if row_id not in before_hashes}
    expected = {(first_id, 'token_refreshed'), (first_id, 'token_revoked'), (third_id, 'token_refreshed'), (third_id, 'token_revoked')}
    actual = {(row['actorId'], row['action']) for row in added.values()}
    if len(added) != 4 or actual != expected:
        raise AssertionError('Refresh audit actions differ from the two refreshes')
    start, finish = instant(refresh_started), instant(refresh_finished)
    if any(instant(row['createdAt']) < start or instant(row['createdAt']) > finish for row in added.values()):
        raise AssertionError('Refresh audit timestamp is outside the refresh interval')


def verify_refresh_contract(before, after, users_before, users_after, audit_before, audit_after, first_id, third_id, refresh_started, refresh_finished):
    allowed = {'auth.users', 'auth.sessions', 'auth.refresh_tokens', 'auth.mfa_amr_claims', 'auth.audit_log_entries'}
    if any(before[name] != after[name] for name in before if name not in allowed):
        raise AssertionError('Refresh changed data outside the GoTrue refresh tables')
    verify_users(users_before, users_after, first_id, third_id)
    verify_audit(audit_before, audit_after, first_id, third_id, refresh_started, refresh_finished)
