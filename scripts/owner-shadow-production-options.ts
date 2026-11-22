export type ProductionOptions = { apply: false } | { apply: true; sourceHash: string };

export function parseProductionArgs(args: string[]): ProductionOptions {
  if (args.length === 0) return { apply: false };
  const sourceHash = args[1];
  if (args.length === 2 && args[0] === '--apply' && sourceHash && /^[a-f0-9]{64}$/.test(sourceHash))
    return { apply: true, sourceHash };
  throw new Error('Apply requires an explicit verified source SHA-256');
}
