function canonical(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b, 'en'))
        .map(([key, item]) => [key, canonical(item)]),
    );
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value))
    return new Date(value).toISOString();
  return value;
}

export function assertDashboardEquivalent(actual: unknown, expected: unknown, path = 'summary') {
  const left = canonical(actual),
    right = canonical(expected);
  const compare = (a: unknown, b: unknown, key: string) => {
    if (typeof a === 'number' && typeof b === 'number') {
      if (Math.abs(a - b) > Math.max(1e-9, Math.abs(b) * 1e-12))
        throw new Error(`${key}: ${a} differs from ${b}`);
      return;
    }
    if (a === b) return;
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
      const first = Object.entries(a),
        second = Object.entries(b);
      if (JSON.stringify(first.map(([key]) => key)) !== JSON.stringify(second.map(([key]) => key)))
        throw new Error(`${key}: dashboard fields differ`);
      for (const [index, [name, value]] of first.entries())
        compare(value, second[index][1], `${key}.${name}`);
      return;
    }
    throw new Error(`${key}: ${JSON.stringify(a)} differs from ${JSON.stringify(b)}`);
  };
  compare(left, right, path);
}
