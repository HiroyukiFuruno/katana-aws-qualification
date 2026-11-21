import json

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
    return {'status': value['status'], 'assertions': assertions}

def has_deadlock(process, connections):
    rows = [process.stdout, process.stderr]
    rows.extend(line for connection in connections.items for line in connection.lines)
    return any('40P01' in row for row in rows)
