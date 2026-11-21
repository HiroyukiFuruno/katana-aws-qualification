import json


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def guard(intent, leg, issued, expires_at, purpose='leg'):
    return json.dumps({'purpose': purpose, 'intentId': intent, 'legId': leg, 'attempt': 1,
        'storageKey': f'kaq-proof:{intent}:{leg}:1', 'issuedAt': int(issued), 'expiresAt': int(expires_at)})


def next_record(revision, expires_at, nonce='ab'):
    return json.dumps({'revision': revision, 'keyVersion': 'v1', 'nonce': nonce * 12,
        'ciphertext': 'cd' * 16, 'expiresAt': int(expires_at)})


def scalar(sql, statement):
    return sql(statement).splitlines()[-1]
