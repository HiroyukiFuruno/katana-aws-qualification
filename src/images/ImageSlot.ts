import { createElement, type ReactNode, useState } from 'react';
import type { Locale } from '../locales.ts';
import {
  httpsImageSource,
  type ImageAsset,
  imageCatalog,
  imageForSlot,
  type ImageLayout,
  imagePlacement,
} from './catalog.ts';

type ImageSlotProps = {
  id: string;
  locale?: Locale;
  expandLabel?: string;
  source?: string;
  fallback?: ReactNode;
};

function RemoteImage({
  source,
  layout,
  fallback,
}: {
  source?: string;
  layout: ImageLayout;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState<string>();
  const src = httpsImageSource(source);
  if (!src || src === failed) return fallback ?? null;
  return createElement('img', {
    src,
    alt: '',
    className: layout.className,
    referrerPolicy: layout.referrerPolicy,
    onError: () => setFailed(src),
  });
}

function imageElement(asset: ImageAsset, layout: ImageLayout) {
  return createElement('img', {
    src: asset.src,
    alt: asset.alt,
    width: layout.width ?? asset.width,
    height: layout.height ?? asset.height,
    className: layout.element === 'image' ? layout.className : undefined,
    decoding: layout.decoding,
    'aria-hidden': layout.hidden,
  });
}

export function ImageSlot({
  id,
  locale = 'en',
  expandLabel,
  source,
  fallback,
}: ImageSlotProps): ReactNode {
  const placement = imagePlacement(id);
  if (!placement) return fallback ?? null;
  const layout = imageCatalog.layouts[placement.layout];
  if (!layout) throw new Error(`Unknown image layout: ${placement.layout}`);
  if (placement.remote) return createElement(RemoteImage, { source, layout, fallback });

  const asset = imageForSlot(id, locale);
  if (!asset) throw new Error(`Missing image asset: ${id}`);
  if (layout.element === 'metadata') throw new Error(`Image belongs in document metadata: ${id}`);
  if (layout.element === 'mask')
    return createElement('span', {
      className: layout.className,
      style: { maskImage: `url("${asset.src}")` },
    });

  const image = imageElement(asset, layout);
  if (layout.element === 'image') return image;

  const link = { href: asset.src, target: '_blank', rel: 'noreferrer' };
  if (layout.expand === 'caption' && !expandLabel) throw new Error(`Missing image link label: ${id}`);
  return createElement(
    'figure',
    { className: layout.className, lang: asset.language, 'data-figure': placement.identifier },
    layout.expand === 'image' ? createElement('a', link, image) : image,
    layout.expand === 'caption'
      ? createElement('figcaption', { lang: locale }, createElement('a', link, expandLabel))
      : null,
  );
}
