from .scenario_concurrency import cancel_before_restart, commit_precedes_cancel, different_key, parallel_cancel, rate_limit, same_key
from .scenario_expiry import expiry_after_intent_wait, live_after_advisory_wait
from .scenario_support import ScenarioSupport


def run(env):
    support, baseline, snapshot = ScenarioSupport(env), env['baseline'], env['snapshot']
    results = {}
    for name, case in [
        ('parallel_same_key', same_key), ('parallel_different_key', different_key), ('parallel_cancel', parallel_cancel),
        ('cancel_before_restart', cancel_before_restart), ('expiry_after_intent_wait', expiry_after_intent_wait),
        ('parallel_rate_limit', rate_limit), ('commit_terminal_precedes_cancel', commit_precedes_cancel),
    ]:
        results[name] = case(support); support.clear(baseline, snapshot)
    results.update(live_after_advisory_wait(support, snapshot)); support.clear(baseline, snapshot)
    if len(results) != 9: raise RuntimeError('Expected nine normal intent scenarios')
    return results
