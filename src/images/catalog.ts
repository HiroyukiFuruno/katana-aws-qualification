import type { Locale } from '../locales.ts';
import source from './catalog.json' with { type: 'json' };

export type ImageAsset = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  language?: 'en' | 'ja';
  authoring?: string;
  mediaType?: 'image/png';
  equivalentTo?: string;
};

export type ImageLayout = {
  element: 'image' | 'figure' | 'mask' | 'metadata';
  className?: string;
  expand?: 'image' | 'caption';
  decoding?: 'async';
  width?: number;
  height?: number;
  hidden?: boolean;
  referrerPolicy?: 'no-referrer';
};

type Placement = {
  layout: string;
  asset?: string;
  remote?: true;
  identifier?: string;
};

type Catalog = {
  assets: Record<string, ImageAsset>;
  japanese: Record<string, string>;
  layouts: Record<string, ImageLayout>;
  placements: Record<string, Placement>;
};

export const imageCatalog: Catalog = source as Catalog;

export function imageSlot(...parts: string[]) {
  return parts.join('/');
}

export function imagePlacement(id: string) {
  return Object.hasOwn(imageCatalog.placements, id) ? imageCatalog.placements[id] : undefined;
}

export function imageForSlot(id: string, locale: Locale) {
  const placement = imagePlacement(id);
  if (!placement?.asset) return undefined;
  const assetId =
    locale === 'ja' ? (imageCatalog.japanese[placement.asset] ?? placement.asset) : placement.asset;
  const asset = imageCatalog.assets[assetId];
  if (!asset) throw new Error(`Unknown image asset: ${id}/${assetId}`);
  return asset;
}

export function imagePlacementsFor(prefix: string) {
  return Object.keys(imageCatalog.placements).filter((id) => id.startsWith(`${prefix}/`));
}

export function documentImageAttributes(locale: Locale) {
  const icon = imageForSlot('site/document/favicon', locale);
  if (!icon?.width || !icon.height || !icon.mediaType) throw new Error('Invalid favicon');
  return { rel: 'icon', type: icon.mediaType, sizes: `${icon.width}x${icon.height}`, href: icon.src };
}

export function httpsImageSource(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
