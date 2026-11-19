const docs = 'https://docs.aws.amazon.com';
const certification = 'https://aws.amazon.com';

export function awsSource(raw: string): URL {
  const url = new URL(raw);
  if (
    url.username ||
    url.password ||
    url.port ||
    !(
      (url.origin === docs && /\.(?:html|md)$/.test(url.pathname)) ||
      (url.origin === certification && /^\/certification\/certified-[\w-]+\/?$/.test(url.pathname))
    )
  ) {
    throw new Error(`AWS公式ドキュメントまたは試験案内のURLが必要です: ${url.origin}${url.pathname}`);
  }
  url.hash = '';
  url.search = '';
  if (url.origin === docs) url.pathname = url.pathname.replace(/\.md$/, '.html');
  else if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

export function examSources(guide: URL, markdown: string): URL[] {
  const results = [];
  for (const [, link] of markdown.matchAll(/\]\(([^\s)]+)\)/g)) {
    if (/^[\w-]+\.md(?:#[\w-]+)?$/.test(link)) {
      results.push(awsSource(new URL(link, guide).href));
    } else if (/^https:\/\/aws\.amazon\.com\/certification\/certified-[\w-]+\/?$/.test(link)) {
      results.push(awsSource(link));
    }
  }
  return results;
}

async function certificationText(html: string): Promise<string> {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (!main) throw new Error('試験案内の本文要素が見つかりません');
  const fragments: string[] = [];
  const document = main.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  await new HTMLRewriter()
    .on('h1, h2, h3, p, li, tr', {
      element(element) {
        fragments.push('\n');
        element.onEndTag(() => fragments.push('\n'));
      },
    })
    .on('td, th', {
      element(element) {
        element.onEndTag(() => fragments.push(' '));
      },
    })
    .onDocument({
      text({ text }) {
        fragments.push(text);
      },
    })
    .transform(new Response(document))
    .text();
  const content = fragments
    .join('')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  if (!/exam (?:overview|duration|format)|\d+ questions/i.test(content)) {
    throw new Error('試験案内から試験情報を確認できません');
  }
  return content;
}

export async function readAwsSource(source: URL): Promise<string> {
  const request = new URL(source);
  if (request.origin === docs) request.pathname = request.pathname.replace(/\.html$/, '.md');
  const response = await fetch(request, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${request.href}`);
  if (request.origin === certification) return `${await certificationText(await response.text())}\n`;
  const content = (await response.text()).replace(/\r\n/g, '\n').trim();
  if (!/^# .+/m.test(content) || /^<!doctype html|^<html/i.test(content)) {
    throw new Error(`Markdown本文を取得できません: ${request.href}`);
  }
  return `${content}\n`;
}
