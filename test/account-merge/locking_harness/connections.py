from datetime import datetime, timezone
import json
import subprocess
import threading
import time

PSQL_COMMAND = 'exec psql -h 127.0.0.1 -U supabase_auth_admin -d kaq_account_merge -XAt -v ON_ERROR_STOP={} 2>&1'


class Connections:
    def __init__(self, database, docker, quote, context_sql):
        self.database, self.docker = database, docker
        self.quote, self.context_sql = quote, context_sql
        self.items, self.transcript, self.events = [], [], threading.Condition()

    def open(self, label, actor=None):
        connection = Connection(label, actor, self)
        self.items.append(connection)
        return connection

    def graph(self):
        statement = """select coalesce(jsonb_agg(jsonb_build_object('pid',activity.pid,
          'application',application_name,'blockers',pg_blocking_pids(activity.pid),'waitEventType',wait_event_type,
          'waitEvent',wait_event,'ungrantedLocks',(select coalesce(jsonb_agg(jsonb_build_object('mode',mode,
          'locktype',locktype,'relation',relation::regclass::text,'transactionid',transactionid)),'[]'::jsonb)
          from pg_locks where pid=activity.pid and not granted)) order by activity.pid),'[]'::jsonb)
          from pg_stat_activity activity where application_name like 'locking_scope_%';"""
        return json.loads(self.sql(statement))

    def sql(self, statement):
        result = self.docker.run('exec', '-i', self.database, 'sh', '-ec', PSQL_COMMAND.format(1), input=statement)
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
        return result.stdout.strip()

    def blocked(self, waiter, holder):
        deadline = time.monotonic() + 10
        while True:
            observed = self.graph()
            if holder.pid in {row['pid']: row['blockers'] for row in observed}.get(waiter.pid, []):
                return observed
            if time.monotonic() >= deadline:
                raise RuntimeError('Expected observed blocking edge missing: ' + json.dumps(observed))

    def close(self):
        errors = []
        for connection in self.items:
            try:
                connection.close()
            except Exception as error:
                errors.append(str(error))
        return errors


class Connection:
    def __init__(self, label, actor, owner):
        self.owner, self.label, self.lines = owner, 'locking_scope_' + label, []
        self.process = subprocess.Popen(['docker', 'exec', '-i', owner.database, 'sh', '-ec', PSQL_COMMAND.format(0)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        threading.Thread(target=self.read, daemon=True).start()
        self.send("\\set VERBOSITY verbose\nset application_name='" + self.label + "'; select 'pid:'||pg_backend_pid();")
        self.wait('pid:')
        self.pid = int(next(line[4:] for line in self.lines if line.startswith('pid:')))
        if actor:
            self.send(owner.context_sql(actor) + "select 'context_ready';")
            self.wait('context_ready')

    def read(self):
        for line in self.process.stdout:
            with self.owner.events:
                line = line.rstrip('\n')
                self.lines.append(line)
                self.owner.transcript.append({'at': datetime.now(timezone.utc).isoformat(), 'connection': self.label, 'line': line})
                self.owner.events.notify_all()

    def send(self, statement):
        self.process.stdin.write(statement + '\n')
        self.process.stdin.flush()

    def wait(self, marker):
        deadline = time.monotonic() + 10
        with self.owner.events:
            while not any(line.startswith(marker) for line in self.lines):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise RuntimeError(f'{self.label} missing {marker}: {self.lines}')
                self.owner.events.wait(remaining)

    def error(self, state, message):
        deadline = time.monotonic() + 10
        with self.owner.events:
            while not any(state in line and message in line for line in self.lines):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise RuntimeError(f'{self.label} missing error {state}/{message}: {self.lines}')
                self.owner.events.wait(remaining)

    def finish(self, operation='rollback'):
        marker = 'finished_' + str(len(self.lines))
        self.send(f"{operation}; select '{marker}';")
        self.wait(marker)

    def close(self):
        if self.process.poll() is None:
            self.send('rollback;\\q')
            self.process.stdin.close()
            self.process.wait(timeout=10)
