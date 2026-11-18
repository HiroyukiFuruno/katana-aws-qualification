import { defineConfig, loadEnv, type HtmlTagDescriptor } from 'vite';

export default defineConfig(({ command, isPreview, mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    appType: command === 'serve' && !isPreview ? 'spa' : 'mpa',
    plugins: [
      {
        name: 'google-site-integrations',
        transformIndexHtml() {
          const tags: HtmlTagDescriptor[] = [];
          const token = env.VITE_GOOGLE_SITE_VERIFICATION;
          if (token) {
            if (!/^[\w-]+$/.test(token))
              throw new Error('Invalid Google Search Console verification token');
            tags.push({ tag: 'meta', attrs: { name: 'google-site-verification', content: token } });
          }
          return tags;
        },
      },
    ],
  };
});
