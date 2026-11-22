import { checkContentTranslations } from './check-content-translations';

const count = await checkContentTranslations('published');
console.log(`Validated ${count} published localized site/question files with strict provenance`);
