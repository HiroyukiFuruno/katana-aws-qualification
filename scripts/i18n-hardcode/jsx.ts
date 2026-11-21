import { type Ast, ast, name, nodes, type Origin, type Path } from './ast.ts';
import { displayProp, jsxProps } from './link.ts';
import { textualSpreadProperties } from './sink-metadata.ts';

type Recur = (node: Ast | undefined, path?: Path) => Origin[];
type Component = (opening: Ast, props: Ast) => Origin[];

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
    ...nodes(opening?.attributes).flatMap((attribute) => {
      if (attribute.type === 'SpreadElement')
        return textualSpreadProperties.flatMap((field) => recur(ast(attribute.arguments), [field]));
      if (attribute.type !== 'JSXAttribute') return [];
      const value = ast(attribute.value);
      const attributeName = name(ast(attribute.name));
      if (displayProp(attributeName)) return recur(value);
      return attributeName === 'dangerouslySetInnerHTML' ? recur(value, ['__html']) : [];
    }),
  ];
}
