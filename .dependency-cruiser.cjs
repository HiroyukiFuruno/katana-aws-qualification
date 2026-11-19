module.exports = {
  forbidden: [
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      from: { path: '^src/' },
      to: { circular: true },
    },
    {
      name: 'no-unresolved-imports',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'source-does-not-import-entry-or-scripts',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^(src/main\\.tsx$|scripts/)' },
    },
    {
      name: 'domain-does-not-import-interface',
      severity: 'error',
      from: { path: '^src/(assessment\\w*|attempts|certification\\w*|exam|questions)\\.ts$' },
      to: { path: '(\\.tsx$|^node_modules/react(?:-dom)?/)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    parser: 'swc',
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
