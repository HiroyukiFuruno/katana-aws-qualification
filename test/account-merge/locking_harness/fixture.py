import base64
import hashlib
import hmac
import json
import re
import tempfile
import time

from .support import require

DATABASE_NAME = 'kaq-locking-scope-probe-db'
AUTH_NAME = 'kaq-locking-scope-probe-auth'
FIXTURE_SECRET = 'kaq-account-merge-only-jwt-secret-not-for-production'


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def token(payload):
    encode = lambda value: base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).rstrip(b'=').decode()
    unsigned = encode({'alg': 'HS256', 'typ': 'JWT'}) + '.' + encode(payload)
    signature = base64.urlsafe_b64encode(hmac.new(FIXTURE_SECRET.encode(), unsigned.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return unsigned + '.' + signature


def context_sql(actor, claims=None):
    headers = {'x-kaq-account-id': actor['userId'], 'x-kaq-membership-epoch': '0'}
    return (f"select set_config('request.jwt.claims',{quote(json.dumps(claims or actor['claims']))},false);"
            f"select set_config('request.headers',{quote(json.dumps(headers))},false);")


def lock_sql(users, actor, mode='writer', generation=0):
    if mode == 'merge':
        return (f"select kaq_private.lock_learning_scope('merge',{generation},array[{quote(users[0]['userId'])}::uuid,"
                f"{quote(users[1]['userId'])}::uuid],array[{quote(users[1]['sessionId'])}::uuid]);")
    return f"select kaq_private.lock_learning_scope({quote(mode)},{generation});"


def auth_request(docker, auth, path, body=None, access_token=None):
    script = """IFS= read -r authorization; IFS= read -r request_body
if [ -n "$authorization" ]; then auth_header="--header=Authorization: Bearer $authorization"; fi
if [ -n "$request_body" ]; then
  if [ -n "$authorization" ]; then wget -qO- --header='Content-Type: application/json' "$auth_header" --post-data="$request_body" "$1"; else wget -qO- --header='Content-Type: application/json' --post-data="$request_body" "$1"; fi
elif [ -n "$authorization" ]; then wget -qO- "$auth_header" "$1"; else wget -qO- "$1"; fi"""
    payload = (access_token or '') + '\n' + (json.dumps(body) if body is not None else '') + '\n'
    result = docker.run('exec', '-i', auth, 'sh', '-ec', script, 'sh', 'http://127.0.0.1:9999' + path, input=payload)
    if result.returncode:
        raise RuntimeError('Synthetic GoTrue request failed: ' + result.stderr)
    return json.loads(result.stdout)


def refresh_probe(docker, auth, refresh_token):
    script = "IFS= read -r request_body; wget -S -O /tmp/kaq-refresh-probe.json --header='Content-Type: application/json' --post-data=\"$request_body\" \"$1\""
    result = docker.run('exec', '-i', auth, 'sh', '-ec', script, 'sh', 'http://127.0.0.1:9999/token?grant_type=refresh_token', input=json.dumps({'refresh_token': refresh_token}) + '\n')
    status = re.findall(r'HTTP/[^ ]+ ([0-9]{3})', result.stderr)
    return {'outcome': 'success' if result.returncode == 0 else 'failed', 'httpStatus': int(status[-1]) if status else None}


def start(docker):
    docker.reject_existing(DATABASE_NAME, AUTH_NAME)
    database = docker.create(DATABASE_NAME, '--network', 'none', '--tmpfs', '/var/lib/postgresql:rw,nosuid,nodev,size=256m',
        '-e', 'POSTGRES_USER=supabase_auth_admin', '-e', 'POSTGRES_PASSWORD=integration-only', '-e',
        'POSTGRES_DB=kaq_account_merge', 'postgres:18-alpine')
    docker.wait_ready(lambda: docker.run('exec', database, 'pg_isready', '-h', '127.0.0.1', '-U', 'supabase_auth_admin').returncode == 0, 'postgres TCP')
    return database


def prepare(database, docker, sql, root):
    sql((root / 'test/account-merge/init.sql').read_text())
    env = {'GOTRUE_API_HOST': '0.0.0.0', 'GOTRUE_API_PORT': '9999', 'API_EXTERNAL_URL': 'http://127.0.0.1:9999',
        'GOTRUE_SITE_URL': 'http://fixture.invalid', 'GOTRUE_DB_DRIVER': 'postgres', 'GOTRUE_DB_DATABASE_URL':
        'postgres://supabase_auth_admin:integration-only@127.0.0.1:5432/kaq_account_merge?search_path=auth',
        'GOTRUE_JWT_SECRET': FIXTURE_SECRET, 'GOTRUE_JWT_ISSUER': 'http://127.0.0.1:9999', 'GOTRUE_JWT_AUD': 'authenticated',
        'GOTRUE_JWT_DEFAULT_GROUP_NAME': 'authenticated', 'GOTRUE_EXTERNAL_EMAIL_ENABLED': 'true',
        'GOTRUE_MAILER_AUTOCONFIRM': 'true', 'GOTRUE_LOG_LEVEL': 'warn'}
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8') as values:
        values.write(''.join(key + '=' + value + '\n' for key, value in env.items())); values.flush()
        auth = docker.create(AUTH_NAME, '--network', 'container:' + database, '--env-file', values.name, 'supabase/gotrue:v2.198.0')
    health = {}
    def ready():
        result = docker.run('exec', auth, 'wget', '-qO-', 'http://127.0.0.1:9999/health')
        if result.returncode == 0:
            health.update(json.loads(result.stdout))
            return True
        return False
    docker.wait_ready(ready, 'GoTrue health')
    migrations = sorted((root / 'supabase/migrations').glob('*.sql'))
    require(len(migrations) == 14, f'Expected 14 migrations, found {len(migrations)}')
    for migration in migrations:
        sql(migration.read_text())
    for name in ['session-resolver.sql', 'owner-scope.sql', 'locking-scope.sql']:
        sql((root / 'supabase/account-merge' / name).read_text())
    return auth, health


def create_users(docker, auth):
    admin = token({'role': 'service_role', 'exp': int(time.time()) + 3600})
    users = []
    for name in ['first', 'second', 'third']:
        user = auth_request(docker, auth, '/admin/users', {'email': f'locking-{name}@fixture.example.test',
            'password': 'integration-only-password', 'email_confirm': True}, admin)
        session = auth_request(docker, auth, '/token?grant_type=password', {'email': f'locking-{name}@fixture.example.test', 'password': 'integration-only-password'})
        value = session['access_token']; unsigned, signature = value.rsplit('.', 1)
        actual = base64.urlsafe_b64decode(signature + '=' * (-len(signature) % 4))
        require(hmac.compare_digest(actual, hmac.new(FIXTURE_SECRET.encode(), unsigned.encode(), hashlib.sha256).digest()), 'GoTrue signature mismatch')
        claims = json.loads(base64.urlsafe_b64decode(unsigned.split('.')[1] + '=' * (-len(unsigned.split('.')[1]) % 4)))
        require(claims['sub'] == user['id'] and claims['aud'] == 'authenticated' and claims['iss'] == 'http://127.0.0.1:9999', 'GoTrue claim mismatch')
        require(auth_request(docker, auth, '/user', access_token=value)['id'] == user['id'], 'GoTrue user mismatch')
        users.append({'userId': user['id'], 'sessionId': claims['session_id'], 'refreshToken': session['refresh_token'], 'claims': {key: claims[key] for key in ['sub', 'session_id', 'role', 'aud', 'exp']}})
    return users
