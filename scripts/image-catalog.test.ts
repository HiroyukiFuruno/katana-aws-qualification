import { expect, test } from 'bun:test';
import {
  documentImageAttributes,
  httpsImageSource,
  imageCatalog,
  imageForSlot,
} from '../src/images/catalog.ts';
import { locales } from '../src/locales.ts';

test('teaching slots have Japanese figures and a shared English version for every other locale', () => {
  for (const id of Object.keys(imageCatalog.placements)) {
    const english = imageForSlot(id, 'en');
    if (english?.language !== 'en') continue;
    const japanese = imageForSlot(id, 'ja');
    expect(japanese?.language).toBe('ja');
    expect(japanese?.src).not.toBe(english.src);
    for (const locale of locales) {
      if (locale !== 'ja') expect(imageForSlot(id, locale)).toBe(english);
    }
  }
});

test('equivalent responsibility figures share one Japanese asset', () => {
  const equivalent = Object.entries(imageCatalog.assets).find(([, asset]) => asset.equivalentTo);
  expect(equivalent).toBeDefined();
  if (!equivalent) return;
  const [id, asset] = equivalent;
  if (!asset.equivalentTo) throw new Error('Missing shared figure');
  expect(imageCatalog.japanese[id]).toBe(imageCatalog.japanese[asset.equivalentTo]);
  expect(imageCatalog.japanese[id]).toBeDefined();
});

test('brand metadata and visible logo share the static source', () => {
  const favicon = documentImageAttributes('ja');
  expect(favicon).toEqual({
    rel: 'icon',
    type: 'image/png',
    sizes: '128x128',
    href: imageForSlot('site/header/logo', 'en')?.src,
  });
});

test('remote avatars retain HTTPS and credential rejection', () => {
  expect(httpsImageSource('https://example.org/avatar')).toBe('https://example.org/avatar');
  for (const candidate of [
    'https://name:secret@example.org/avatar',
    'http://example.org/avatar',
    '/local.png',
    'data:image/png;base64,AAAA',
  ]) {
    expect(httpsImageSource(candidate)).toBeUndefined();
  }
});
