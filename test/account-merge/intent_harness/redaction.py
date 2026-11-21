def redact(value, secrets):
    if isinstance(value, dict): return {key: redact(item, secrets) for key, item in value.items()}
    if isinstance(value, list): return [redact(item, secrets) for item in value]
    if isinstance(value, str):
        for secret in secrets: value = value.replace(secret, '[REDACTED]')
    return value


def contains_secret(value, secrets):
    if isinstance(value, dict): return any(contains_secret(item, secrets) for item in value.values())
    if isinstance(value, list): return any(contains_secret(item, secrets) for item in value)
    return isinstance(value, str) and any(secret in value for secret in secrets)


def discover_secrets(value):
    found = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {'secret', 'nonce', 'intent_secret'} and isinstance(item, str): found.add(item)
            found.update(discover_secrets(item))
    elif isinstance(value, list):
        for item in value: found.update(discover_secrets(item))
    elif isinstance(value, str):
        try: found.update(discover_secrets(__import__('json').loads(value)))
        except (TypeError, ValueError): pass
    return found
