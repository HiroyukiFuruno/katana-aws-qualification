import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Locale } from '../locales.ts';
import { ImageSlot } from './ImageSlot.ts';

export function imageSlotMarkup(id: string | undefined, locale: Locale) {
  return id ? renderToStaticMarkup(createElement(ImageSlot, { id, locale })) : '';
}
