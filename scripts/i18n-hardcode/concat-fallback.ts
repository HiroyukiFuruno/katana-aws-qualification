import {
  type Ast,
  args,
  ast,
  type Binding,
  nodes,
  type Origin,
  type Path,
  property,
  type Source,
} from './ast.ts';
import { callArguments } from './calls.ts';
import {
  argumentLength,
  type ConcatSelection,
  fixedIndex,
  knownArrayLength,
  knownConcatSelection,
  selectedConcatOrigins,
  unwrap,
} from './concat-index.ts';
import { mappedPaths } from './mapped-path.ts';

type Recur = (node: Ast | undefined, path: Path) => Origin[];

export function concatOrigins(
  source: Source,
  node: Ast,
  receiver: Ast | undefined,
  path: Path,
  environment: Map<string, Binding[]>,
  recur: Recur,
): Origin[] {
  const argumentsList = callArguments(node);
  const known = selectedConcatOrigins(
    knownConcatSelection(source, receiver, argumentsList, path, environment),
    receiver,
    path,
    recur,
  );
  if (known) return known;
  const possible = selectedConcatOrigins(
    possibleConcatSelection(source, receiver, argumentsList, path, environment),
    receiver,
    path,
    recur,
  );
  return [
    ...(possible ?? []),
    ...recur(receiver, path),
    ...args(node).flatMap((argument) =>
      mappedPaths(path, true).flatMap((selected) => recur(argument, selected)),
    ),
  ];
}

export function possibleConcatSelection(
  source: Source,
  receiver: Ast | undefined,
  argumentsList: Ast[],
  path: Path,
  environment: Map<string, Binding[]>,
): ConcatSelection | undefined {
  const index = fixedIndex(path);
  const receiverLength = knownArrayLength(source, receiver, environment, new Set());
  if (index === undefined || receiverLength === undefined || index < receiverLength) return undefined;
  let relative = index - receiverLength;
  for (const argument of argumentsList) {
    const shape = argumentLength(source, argument, environment);
    if (shape) {
      relative -= shape.length;
      continue;
    }
    const node = unwrap(argument) ?? argument;
    const argumentsAtIndex =
      node.type === 'ObjectExpression'
        ? nodes(node.properties)
            .filter((member) => member.type === 'KeyValueProperty')
            .flatMap((member) => {
              const memberKey = ast(member.key);
              const value = ast(member.value);
              const key =
                memberKey?.type === 'NumericLiteral' ? String(memberKey.value) : property(memberKey);
              return key === String(relative) && value ? [{ node: value, path: path.slice(1) }] : [];
            })
        : [];
    return argumentsAtIndex.length ? { receiver: false, arguments: argumentsAtIndex } : undefined;
  }
  return undefined;
}
