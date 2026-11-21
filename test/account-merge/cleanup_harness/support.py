import json, re

ASSERTIONS = {'cancel','expire','staleRevision','oldContext'}

def sdk_receipt(output):
    lines = [line for line in output.splitlines() if line]
    if len(lines) != 1:
        raise RuntimeError('unexpected SDK receipt output')
    value = json.loads(lines[0])
    if not isinstance(value, dict) or value.get('status') != 'passed':
        raise RuntimeError('SDK receipt status failed')
    assertions = value.get('assertions')
    if not isinstance(assertions, dict) or set(assertions) != ASSERTIONS:
        raise RuntimeError('SDK receipt assertions malformed')
    if any(item is not True for item in assertions.values()):
        raise RuntimeError('SDK assertion failed')
    ids=value.get('fixtureIntentIds')
    if not isinstance(ids,list) or len(ids)!=3 or any(not isinstance(item,str) or not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}',item,re.I) for item in ids) or len(set(ids))!=3:
        raise RuntimeError('SDK fixture intent IDs malformed')
    return {'status': value['status'], 'assertions': assertions, 'fixtureIntentIds': ids}

def has_deadlock(process, connections):
    rows = [process.stdout, process.stderr]
    rows.extend(line for connection in connections.items for line in connection.lines)
    return any('40P01' in row for row in rows)
