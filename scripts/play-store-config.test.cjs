const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateStoreConfig } = require('./play-store-config.cjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beybridge-store-'));
  fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({ expo: { android: {
    package: 'com.beybridge.app', googleServicesFile: './google-services.json' } } }));
  fs.writeFileSync(path.join(root, 'eas.json'), JSON.stringify({ build: { production: { android: { buildType: 'app-bundle' } } } }));
  fs.writeFileSync(path.join(root, 'google-services.json'), JSON.stringify({ client: [{ client_info: {
    android_client_info: { package_name: 'com.beybridge.app' } } }] }));
  const env = {
    EXPO_PUBLIC_LEGAL_OPERATOR: 'BeyBridge operator', EXPO_PUBLIC_SUPPORT_EMAIL: 'support@beybridge.test',
    EXPO_PUBLIC_BACKUP_RETENTION: 'Seven days', EXPO_PUBLIC_LOG_RETENTION: 'Thirty days',
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    EXPO_PUBLIC_PRIVACY_URL: 'https://beybridge.test/privacy.html',
    EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://beybridge.test/delete-account.html',
  };
  return { root, env };
}
test('release configuration rejects missing and placeholder legal/backend details', () => {
  const { root, env } = fixture();
  try {
    assert.deepEqual(validateStoreConfig(env, root), []);
    assert(validateStoreConfig({ ...env, EXPO_PUBLIC_SUPPORT_EMAIL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'e2e-placeholder' }, root).length >= 2);
    assert(validateStoreConfig({ ...env, EXPO_PUBLIC_BACKUP_RETENTION: 'pending confirmation' }, root).length >= 1);
    assert(validateStoreConfig({ ...env, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_do_not_publish' }, root).some(error => error.includes('secret key')));
  } finally { fs.rmSync(root, { recursive: true }); }
});
test('release URLs cannot be localhost, unencrypted, authenticated, or test placeholders', () => {
  const { root, env } = fixture();
  try {
    for (const url of ['http://beybridge.test/privacy', 'https://localhost/privacy', 'https://user:password@beybridge.test/privacy', 'https://beybridge-e2e.invalid/privacy']) {
      assert(validateStoreConfig({ ...env, EXPO_PUBLIC_PRIVACY_URL: url }, root).some(error => error.includes('PRIVACY_URL')));
    }
  } finally { fs.rmSync(root, { recursive: true }); }
});
test('release requires matching Firebase registration and an AAB profile', () => {
  const { root, env } = fixture();
  try {
    fs.writeFileSync(path.join(root, 'google-services.json'), JSON.stringify({ client: [] }));
    assert(validateStoreConfig(env, root).some(error => error.includes('application ID')));
    fs.rmSync(path.join(root, 'google-services.json'));
    assert(validateStoreConfig(env, root).some(error => error.includes('missing or invalid')));
    fs.writeFileSync(path.join(root, 'eas.json'), JSON.stringify({ build: { production: { developmentClient: true, android: { buildType: 'apk' } } } }));
    assert(validateStoreConfig(env, root).some(error => error.includes('App Bundle')));
  } finally { fs.rmSync(root, { recursive: true }); }
});

test('legal exports are readable without JavaScript and escape configured text', () => {
  const { root } = fixture();
  try {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'export-store-pages.cjs'), '--draft'], {
      cwd: root, env: { ...process.env, EXPO_PUBLIC_LEGAL_OPERATOR: '<script>unsafe</script>',
        EXPO_PUBLIC_SUPPORT_EMAIL: 'review@example.invalid' }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    for (const file of ['privacy.html', 'terms.html', 'delete-account.html']) {
      const html = fs.readFileSync(path.join(root, 'dist-store', file), 'utf8');
      assert(html.includes('<main>') && html.includes('Draft for review.'));
      assert(!html.includes('<script'));
    }
    const privacy = fs.readFileSync(path.join(root, 'dist-store/privacy.html'), 'utf8');
    assert(privacy.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
    const deletion = fs.readFileSync(path.join(root, 'dist-store/delete-account.html'), 'utf8');
    assert(deletion.includes('Request deletion without the app') && deletion.includes('review@example.invalid'));
  } finally { fs.rmSync(root, { recursive: true }); }
});
