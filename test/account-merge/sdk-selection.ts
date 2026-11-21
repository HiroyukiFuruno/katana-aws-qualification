import { run } from './commands';

export function sdkSelection(args: string[]) {
  const index = args.indexOf('--sdk-grep');
  if (index < 0) return { scopeArgs: args, sdkArgs: [], sdkGrep: null };
  const value = args[index + 1];
  if (!value || value.startsWith('-') || args.lastIndexOf('--sdk-grep') !== index)
    throw new Error('--sdk-grep requires exactly one test-name pattern');
  return {
    scopeArgs: [...args.slice(0, index), ...args.slice(index + 2)],
    sdkArgs: ['--grep', value],
    sdkGrep: value,
  };
}
export function runSdk(args: string[]) {
  run('bunx', ['playwright', 'test', '--config=playwright.account-sdk.config.ts', ...args]);
}
