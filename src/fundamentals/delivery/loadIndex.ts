import type { DeliveryIndexAsset } from './artifactTypes';

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export async function fetchDeliveryJson(
  path: string,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<unknown> {
  const response = await fetcher(path, { cache: 'no-cache', signal });
  if (!response.ok) throw new Error(`Delivery asset request failed: ${response.status}`);
  return response.json() as Promise<unknown>;
}

export function parseDeliveryIndex(value: unknown): DeliveryIndexAsset {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.units) ||
    value.units.length !== 12
  )
    throw new Error('Invalid fundamentals delivery index.');
  const units = value.units;
  const ids = new Set<string>();
  const orders = new Set<number>();
  const parsed = units.map((item) => {
    if (
      !record(item) ||
      !text(item.unitId) ||
      !text(item.slug) ||
      item.unitId !== `fundamentals.${item.slug}` ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) ||
      ids.has(item.unitId) ||
      !text(item.title) ||
      !text(item.parent) ||
      !text(item.objective) ||
      !Array.isArray(item.prerequisiteIds) ||
      !item.prerequisiteIds.every(text) ||
      !integer(item.order) ||
      item.order < 1 ||
      orders.has(item.order) ||
      (item.state !== 'published' && item.state !== 'planned') ||
      !text(item.contentVersion) ||
      !/^[a-f0-9]{64}$/.test(item.contentVersion) ||
      !text(item.contentHash) ||
      !/^[a-f0-9]{64}$/.test(item.contentHash) ||
      !integer(item.minutes) ||
      item.minutes < 1 ||
      !integer(item.totalSteps) ||
      item.totalSteps < 1 ||
      !integer(item.checkpointCount) ||
      !integer(item.finalQuestionCount) ||
      !Array.isArray(item.checkpointIds) ||
      item.checkpointIds.length !== item.checkpointCount ||
      !item.checkpointIds.every(text) ||
      new Set(item.checkpointIds).size !== item.checkpointIds.length ||
      !Array.isArray(item.finalQuestionIds) ||
      item.finalQuestionIds.length !== item.finalQuestionCount ||
      !item.finalQuestionIds.every(text) ||
      new Set(item.finalQuestionIds).size !== item.finalQuestionIds.length ||
      (item.next !== undefined && !text(item.next))
    )
      throw new Error('Invalid fundamentals delivery index unit.');
    const parsedItem = item as DeliveryIndexAsset['units'][number];
    ids.add(parsedItem.unitId);
    orders.add(parsedItem.order);
    return parsedItem;
  });
  if ([...orders].sort((a, b) => a - b).join(',') !== '1,2,3,4,5,6,7,8,9,10,11,12')
    throw new Error('Invalid fundamentals delivery order.');
  if (
    parsed.some(
      (item) =>
        item.prerequisiteIds.some((id) => !ids.has(id)) ||
        (item.next !== undefined && !ids.has(item.next)),
    )
  )
    throw new Error('Invalid fundamentals delivery dependency.');
  return value as unknown as DeliveryIndexAsset;
}

export async function loadDeliveryIndex(options: { signal?: AbortSignal; fetcher?: Fetcher } = {}) {
  return parseDeliveryIndex(
    await fetchDeliveryJson('/fundamentals/delivery/index.json', options.signal, options.fetcher),
  );
}
