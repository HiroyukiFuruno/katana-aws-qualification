import type { Locator } from '@playwright/test';

export async function visibleBounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Expected visible bounds: ${locator.toString()}`);
  return box;
}
