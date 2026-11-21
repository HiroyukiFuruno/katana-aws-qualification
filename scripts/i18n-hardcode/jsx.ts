import { type Ast, ast, name, nodes, type Origin, type Path } from './ast.ts';
import { displayProp, jsxProps } from './link.ts';

type Recur = (node: Ast | undefined, path?: Path) => Origin[];
type Component = (opening: Ast, props: Ast) => Origin[];
type Sink = { node: Ast | undefined; path: Path; name: string };

const spreadFields = [
  'children',
  'label',
  'title',
  'placeholder',
  'alt',
  'aria-label',
  'aria-description',
  'text',
  'message',
];

export function jsxTextSinks(opening: Ast, resolve: Recur): Sink[] {
  if (opening.type !== 'JSXOpeningElement') return [];
  const attributes = nodes(opening.attributes);
  const element = name(ast(opening.name));
  const types = attributes.flatMap((attribute) => {
    if (attribute.type === 'SpreadElement')
      return resolve(ast(attribute.arguments), ['type']).map((origin) => origin.text);
    return name(ast(attribute.name)) === 'type'
      ? resolve(ast(attribute.value)).map((origin) => origin.text)
      : [];
  });
  const values =
    element === 'textarea'
      ? ['value', 'defaultValue']
      : element === 'input' && types.some((type) => ['button', 'submit', 'reset'].includes(type))
        ? ['value', 'defaultValue']
        : [];
  return attributes.flatMap((attribute) => {
    if (attribute.type === 'SpreadElement')
      return [
        ...[...new Set([...spreadFields, ...values])].map((field) => ({
          node: ast(attribute.arguments),
          path: [field],
          name: `JSX spread ${field}`,
        })),
        {
          node: ast(attribute.arguments),
          path: ['dangerouslySetInnerHTML', '__html'],
          name: 'JSX spread dangerouslySetInnerHTML',
        },
      ];
    if (attribute.type !== 'JSXAttribute') return [];
    const field = name(ast(attribute.name));
    if (displayProp(field)) return [{ node: ast(attribute.value), path: [], name: `JSX ${field}` }];
    if (field === 'dangerouslySetInnerHTML')
      return [{ node: ast(attribute.value), path: ['__html'], name: 'JSX HTML content' }];
    if (values.includes(field))
      return [
        {
          node: ast(attribute.value),
          path: [],
          name: element === 'textarea' ? `textarea ${field}` : 'input button value',
        },
      ];
    return [];
  });
}

export function jsxValues(node: Ast, recur: Recur, component?: Component): Origin[] {
  const children = nodes(node.children)
    .filter((child) =>
      ['JSXText', 'JSXExpressionContainer', 'JSXElement', 'JSXFragment'].includes(child.type),
    )
    .flatMap((child) => recur(child));
  if (node.type !== 'JSXElement') return children;
  const opening = ast(node.opening);
  const props = opening && jsxProps(opening);
  return [
    ...children,
    ...(opening && props && component ? component(opening, props) : []),
    ...(opening ? jsxTextSinks(opening, recur).flatMap((sink) => recur(sink.node, sink.path)) : []),
  ];
}
