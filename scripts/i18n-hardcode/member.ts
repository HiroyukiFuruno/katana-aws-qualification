import {
  type Ast,
  ast,
  type Binding,
  type Origin,
  type Path,
  property,
  type Source,
  type Trace,
  type TraceOptions,
} from './ast.ts';
import { narrowedKeys } from './computed.ts';
import { errorObject, knownObjectMember } from './values.ts';

export function traceMember(
  source: Source,
  node: Ast,
  path: Path,
  recur: (value: Ast | undefined, path: Path) => Origin[],
  trace: Trace,
  seen: Set<string>,
  environment: Map<string, Binding[]>,
  options?: TraceOptions,
): Origin[] {
  const member = property(ast(node.property));
  const object = ast(node.object);
  if (
    !path.length &&
    member === 'message' &&
    errorObject(source, object, new Set(), environment) &&
    !knownObjectMember(source, object, member, new Set(), environment)
  ) {
    return [{ source, node, text: 'Untranslated error.message', rawError: true }];
  }
  if (member !== '*') return recur(object, [member, ...path]);
  const computed = ast(node.property);
  const index = computed && ast(computed.expression);
  const candidates = index && trace(source, index, [], seen, options).map((origin) => origin.text);
  const keys = candidates?.length ? narrowedKeys(source, node, index, candidates) : ['*'];
  return keys.flatMap((candidate) => recur(object, [candidate, ...path]));
}
