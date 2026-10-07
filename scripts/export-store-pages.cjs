const fs = require('node:fs');
const path = require('node:path');
const documents = require('../src/lib/legal-documents.json');
const { validateStoreConfig } = require('./play-store-config.cjs');
const draft = process.argv.includes('--draft');
const output = path.resolve('dist-store');
if (!draft) {
  const problems = validateStoreConfig(process.env, process.cwd());
  if (problems.length) {
    console.error('Complete release configuration before publishing legal pages. Use --draft only for review.');
    process.exit(1);
  }
}
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const replacements = {
  operator: process.env.EXPO_PUBLIC_LEGAL_OPERATOR || '[Operator pending]',
  email: process.env.EXPO_PUBLIC_SUPPORT_EMAIL || '[Support email pending]',
  backups: process.env.EXPO_PUBLIC_BACKUP_RETENTION || '[Backup retention pending]',
  logs: process.env.EXPO_PUBLIC_LOG_RETENTION || '[Log retention pending]',
};
fs.mkdirSync(output, { recursive: true });
for (const key of ['privacy', 'terms', 'deletion']) {
  const document = documents[key];
  const sections = document.sections.map(section => {
    const body = section.body.replace(/\{\{(\w+)\}\}/g, (_, name) => replacements[name]);
    return `<section><h2>${escape(section.title)}</h2><p>${escape(body)}</p></section>`;
  }).join('\n');
  const filename = key === 'deletion' ? 'delete-account.html' : `${key}.html`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(document.title)} — BeyBridge</title>
<style>body{font:17px/1.65 system-ui,sans-serif;color:#111;background:#fafafa;margin:0}main{max-width:760px;padding:24px;margin:auto}h1{line-height:1.2}h2{font-size:1.2em}a{color:#514175}nav{display:flex;gap:24px;flex-wrap:wrap}nav a{padding:12px 0}aside{padding:16px;background:#fff4d6}</style>
</head><body><main><nav><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="delete-account.html">Account deletion</a></nav>
<h1>${escape(document.title)}</h1><p>Updated ${documents.version}</p>
${draft ? '<aside>Draft for review. Complete operator, support and retention details before publishing.</aside>' : ''}
${sections}
${key === 'deletion' ? '<p><a href="/account/delete">Open signed-in account deletion</a></p>' : ''}
</main></body></html>`;
  fs.writeFileSync(path.join(output, filename), html);
}
console.log(`Exported ${draft ? 'draft' : 'release'} privacy, terms and account-deletion HTML to dist-store.`);
