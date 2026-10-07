const fs = require('node:fs');
const path = require('node:path');

function validateStoreConfig(env, root) {
  const problems = [];
  const value = name => env[name]?.trim() || '';
  const placeholder = text => !text || /placeholder|your[-_ ]|example\.|\.invalid\b|pending|todo|not.configured/i.test(text);
  for (const name of ['EXPO_PUBLIC_LEGAL_OPERATOR', 'EXPO_PUBLIC_SUPPORT_EMAIL',
    'EXPO_PUBLIC_BACKUP_RETENTION', 'EXPO_PUBLIC_LOG_RETENTION',
    'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
    if (placeholder(value(name))) problems.push(`${name} must contain real release configuration.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('EXPO_PUBLIC_SUPPORT_EMAIL'))) {
    problems.push('EXPO_PUBLIC_SUPPORT_EMAIL must be a monitored email address.');
  }
  const key = value('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  let keyRole;
  try { keyRole = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()).role; } catch { /* Publishable keys need not be JWTs. */ }
  if (key.startsWith('sb_secret_') || keyRole === 'service_role') {
    problems.push('The public Supabase key must never be a service-role or secret key.');
  }
  for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_ACCOUNT_DELETION_URL']) {
    try {
      const url = new URL(value(name));
      if (url.protocol !== 'https:' || url.username || url.password ||
        url.search || url.hash || placeholder(url.hostname) ||
        /^(localhost|127\.|0\.|\[?::1\]?)/i.test(url.hostname)) throw new Error('invalid');
    } catch { problems.push(`${name} must be a public HTTPS URL without credentials or query parameters.`); }
  }
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  if (!app.android?.package) problems.push('An Android application ID is required.');
  if (app.android?.googleServicesFile) {
    try {
      const file = JSON.parse(fs.readFileSync(path.resolve(root, app.android.googleServicesFile), 'utf8'));
      if (!file.client?.some(client => client.client_info?.android_client_info?.package_name === app.android.package)) {
        problems.push('google-services.json must match the Android application ID.');
      }
    } catch { problems.push('The configured google-services.json is missing or invalid.'); }
  }
  const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  if (eas.build?.production?.android?.buildType !== 'app-bundle' || eas.build.production.developmentClient) {
    problems.push('The production profile must produce a release Android App Bundle.');
  }
  return problems;
}

module.exports = { validateStoreConfig };
