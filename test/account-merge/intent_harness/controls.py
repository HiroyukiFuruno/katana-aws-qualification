import json


def install(sql):
    sql("""create schema intent_harness; create function intent_harness.capture(operation text, kind text default null,
      intent_key uuid default null, intent_id uuid default null, intent_secret text default null, expected_version bigint default 0,
      replace_active boolean default false) returns jsonb language plpgsql as $$ declare value jsonb; state text; reason text; begin
      begin
        if operation='begin' then value:=kaq_private.begin_account_intent(kind,intent_key,replace_active);
        elsif operation='begin_and_cancel' then
          value:=kaq_private.begin_account_intent(kind,intent_key,replace_active);
          value:=kaq_private.cancel_account_intent((value->>'id')::uuid,value->>'secret',0);
        elsif operation='read' then value:=kaq_private.read_account_intent(intent_id,intent_secret);
        elsif operation='cancel' then value:=kaq_private.cancel_account_intent(intent_id,intent_secret,expected_version);
        else raise exception using errcode='PT400',message='HARNESS_OPERATION_INVALID'; end if;
        return jsonb_build_object('ok',true,'value',value);
      exception when others then get stacked diagnostics state=returned_sqlstate,reason=message_text;
        return jsonb_build_object('ok',false,'sqlstate',state,'reason',reason); end;
      end $$;""")


def quote(value): return "'" + str(value).replace("'", "''") + "'"


def expression(operation, **values):
    fields = {'operation': quote(operation), 'kind': 'null', 'intent_key': 'null', 'intent_id': 'null', 'intent_secret': 'null', 'expected_version': '0', 'replace_active': 'false'}
    fields.update(values)
    return "intent_harness.capture(" + ','.join(fields[name] for name in fields) + ')'


def parse(line):
    value = json.loads(line)
    if not isinstance(value, dict) or not isinstance(value.get('ok'), bool): raise RuntimeError('Invalid intent control response')
    return value
