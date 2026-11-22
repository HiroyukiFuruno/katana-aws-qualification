export const placeholders = (value: string) =>
  [...value.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();

export function samePlaceholders(left: string, right: string) {
  return JSON.stringify(placeholders(left)) === JSON.stringify(placeholders(right));
}

export function formParts(form: string) {
  return form.split('|').map((part) => {
    const separator = part.indexOf(':');
    return [part.slice(0, separator), part.slice(separator + 1)] as const;
  });
}
