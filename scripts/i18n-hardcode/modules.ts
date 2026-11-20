import { type Ast, ast, key, name, nodes, type Source } from './ast.ts';

export function indexModule(source: Source, node: Ast) {
  if (node.type === 'ExportAllDeclaration' && !node.typeOnly) {
    const from = name(ast(node.source));
    if (from) source.exportStars.push(from);
  }
  if (node.type === 'ImportDeclaration') {
    for (const specifier of nodes(node.specifiers)) {
      const local = ast(specifier.local);
      const imported =
        specifier.type === 'ImportDefaultSpecifier'
          ? 'default'
          : specifier.type === 'ImportNamespaceSpecifier'
            ? '*'
            : name(ast(specifier.imported)) || name(local);
      if (local) source.imports.set(key(local), { source: name(ast(node.source)), imported });
    }
  }
  if (node.type === 'ExportDeclaration') {
    const declaration = ast(node.declaration);
    if (!declaration) return;
    for (const item of nodes(declaration.declarations)) {
      const id = ast(item.id);
      if (id) source.exports.set(name(id), id);
    }
    const id = ast(declaration.identifier);
    if (id) source.exports.set(name(id), id);
  }
  if (node.type === 'ExportDefaultExpression' || node.type === 'ExportDefaultDeclaration') {
    const value = ast(node.expression) ?? ast(node.decl);
    if (value) source.exports.set('default', value);
  }
  if (node.type === 'ExportNamedDeclaration') {
    for (const specifier of nodes(node.specifiers)) {
      const namespace = specifier.type === 'ExportNamespaceSpecifier';
      const original = ast(namespace ? specifier.name : specifier.orig);
      if (!original) continue;
      source.exports.set(name(ast(specifier.exported)) || name(original), original);
      const from = name(ast(node.source));
      if (from)
        source.imports.set(key(original), { source: from, imported: namespace ? '*' : name(original) });
    }
  }
}
