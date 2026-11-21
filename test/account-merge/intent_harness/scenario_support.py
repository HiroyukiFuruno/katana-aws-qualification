from .controls import expression, parse, quote


class ScenarioSupport:
    def __init__(self, env):
        self.c, self.sql, self.users = env['connections'], env['sql'], env['users']
        self.second, self.secrets, self.serial = self.users[1], env['secrets'], 0

    def call(self, connection, value):
        self.serial += 1
        marker, position = 'intent_reply_' + str(self.serial), len(connection.lines)
        connection.send('select ' + value + "; select '" + marker + "';")
        return marker, position

    def response(self, connection, pending):
        marker, position = pending; connection.wait(marker)
        values = [parse(line) for line in connection.lines[position:] if line.startswith('{')]
        if len(values) != 1: raise RuntimeError('Expected one structured intent response')
        return values[0]

    def begin(self, key, replace=False):
        return expression('begin', kind="'add_existing'", intent_key=quote(key), replace_active=str(replace).lower())

    def begin_and_cancel(self, key):
        return expression('begin_and_cancel', kind="'add_existing'", intent_key=quote(key))

    def uuid(self): return self.sql('select gen_random_uuid()')

    def remember(self, value):
        if value.get('ok') and 'secret' in value['value']: self.secrets.add(value['value']['secret'])

    def configure(self, connection, value):
        connection.send("select set_config('intent_probe.id'," + quote(value['id']) + ",false); select set_config('intent_probe.secret'," + quote(value['secret']) + ",false); select 'secret_configured';")
        connection.wait('secret_configured')

    def control(self, operation='read', version=0):
        return expression(operation, intent_id="current_setting('intent_probe.id')::uuid", intent_secret="current_setting('intent_probe.secret')", expected_version=str(version))

    def gate(self, label):
        holder = self.c.open(label, self.second)
        holder.send("begin; select kaq_private.intent_actor_gate(); select 'intent_gate_held';")
        holder.wait('intent_gate_held')
        return holder

    def row(self, label, value):
        holder = self.c.open(label)
        holder.send("begin; select id from kaq_private.account_intents where id=" + quote(value['id']) + " for update; select 'intent_row_held';")
        holder.wait('intent_row_held')
        return holder

    def clear(self, baseline, snapshot):
        self.sql('delete from kaq_private.account_intents where actor_uid=' + quote(self.second['userId']))
        if snapshot() != baseline: raise RuntimeError('Intent fixture state was not restored')
