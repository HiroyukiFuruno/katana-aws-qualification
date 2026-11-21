import { type Ast, ast, key, nodes, type Path, property } from './ast.ts';

type Target = { identifier: Ast; path: Path; fallback?: Ast };

export function arrayPatternElements(pattern: Ast | undefined): (Ast | undefined)[] {
  return Array.isArray(pattern?.elements) ? pattern.elements.map(ast) : [];
}

export function patternTargets(pattern: Ast | undefined, path: Path = []): Target[] {
  if (!pattern) return [];
  if (pattern.type === 'Parameter') return patternTargets(ast(pattern.pat), path);
  if (pattern.type === 'Identifier') return [{ identifier: pattern, path }];
  if (pattern.type === 'AssignmentPattern') return patternTargets(ast(pattern.left), path);
  if (pattern.type === 'RestElement') return patternTargets(ast(pattern.argument), path);
  if (pattern.type === 'ObjectPattern') {
    const properties = nodes(pattern.properties);
    const excluded = properties
      .filter((member) => member.type !== 'RestElement')
      .map((member) => property(ast(member.key)));
    return properties.flatMap((member) => {
      if (member.type === 'RestElement')
        return patternTargets(ast(member.argument), [...path, { kind: 'object-rest', excluded }]);
      const field = property(ast(member.key));
      if (member.type === 'AssignmentPatternProperty') {
        return patternTargets(ast(member.key), [...path, field]).map((target) => ({
          ...target,
          fallback: ast(member.value),
        }));
      }
      return patternTargets(ast(member.value), [...path, field]);
    });
  }
  if (pattern.type === 'ArrayPattern')
    return arrayPatternElements(pattern).flatMap((element, index) => {
      const step =
        element?.type === 'RestElement' ? { kind: 'array-rest' as const, start: index } : String(index);
      return patternTargets(element, [...path, step]);
    });
  return [];
}

export function patternIdentifiers(pattern: Ast | undefined): Ast[] {
  return [
    ...new Map(patternTargets(pattern).map(({ identifier }) => [key(identifier), identifier])).values(),
  ];
}
