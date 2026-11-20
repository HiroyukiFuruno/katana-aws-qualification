export const forms = ['named', 'default', 'namespace'] as const;
export const paths = [
  'direct',
  'alias',
  'named-barrel',
  'star-barrel',
  'namespace-barrel',
  'namespace-alias-barrel',
  'namespace-export-barrel',
] as const;
export const values = ['constant', 'template', 'helper', 'helper-default', 'component'] as const;
type Form = (typeof forms)[number];
type Path = (typeof paths)[number];
type Value = (typeof values)[number];

export function importFixture(form: Form, path: Path, value: Value, visible: boolean) {
  const symbol = {
    constant: 'caption',
    template: 'caption',
    helper: 'format',
    'helper-default': 'format',
    component: 'Box',
  }[value];
  const definitions = {
    constant: `export const caption='Matrix copy';export default caption;`,
    template: `const text='Matrix copy';export const caption=\`\${text}\`;export default caption;`,
    helper: `export function format(value:string){return value}export default format;`,
    'helper-default': `export function format(value='Matrix copy'){return value}export default format;`,
    component: `export function Box({content}:{content:string}){return <p>{content}</p>}export default Box;`,
  };
  const extras: Record<string, string> = { 'leaf.tsx': definitions[value] };
  let module = './leaf';
  const namespace = ['namespace-barrel', 'namespace-alias-barrel', 'namespace-export-barrel'].includes(
    path,
  );
  if (path === 'named-barrel') extras['barrel.ts'] = `export {${symbol},default} from './leaf'`;
  if (path === 'star-barrel')
    extras['barrel.ts'] = `export * from './leaf';export {default} from './leaf'`;
  if (namespace)
    extras['barrel.ts'] = `import * as Copy from './leaf';export {Copy};export default Copy;`;
  if (path === 'namespace-export-barrel')
    extras['barrel.ts'] = `export * as Copy from './leaf';export * as default from './leaf';`;
  if (path === 'namespace-alias-barrel') {
    extras['inner.ts'] = extras['barrel.ts'];
    extras['barrel.ts'] =
      `import {Copy as Renamed} from './inner';export {Renamed as Copy};export default Renamed;`;
  }
  if (path.endsWith('barrel')) module = './barrel';
  const imported = namespace ? 'Copy' : symbol;
  let setup =
    form === 'named'
      ? `import {${imported} as Value} from '${module}';`
      : form === 'default'
        ? `import Value from '${module}';`
        : `import * as Group from '${module}';`;
  let reference = form === 'namespace' ? `Group.${imported}` : 'Value';
  if (namespace) reference += `.${symbol}`;
  if (path === 'alias') {
    setup += `const Alias=${reference};`;
    reference = 'Alias';
  }
  const content =
    value === 'constant' || value === 'template'
      ? `<p>{${reference}}</p>`
      : value === 'helper' || value === 'helper-default'
        ? `<p>{${reference}(${value === 'helper-default' ? '' : "'Matrix copy'"})}</p>`
        : `<${reference} content="Matrix copy"/>`;
  const diagnostic =
    value === 'helper' || value === 'helper-default'
      ? `const debug=${reference}('Diagnostic copy');`
      : `const debug=${reference};`;
  return {
    code: `${setup}${diagnostic}export const View=()=>${visible ? content : '<p>{42}</p>'};`,
    extras,
  };
}
