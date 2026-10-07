const { spawnSync } = require('node:child_process');

const expoCli = require.resolve('expo/bin/cli');
// Separate bundles keep anonymous fixture tests and configured account tests
// deterministic. The reserved .invalid host is intercepted by Playwright.
for (const accountTests of [false, true]) {
  // Public environment values are inlined by Babel; switching modes needs a
  // clean transform cache so the account bundle cannot reuse fixture mode.
  const exportArgs = [expoCli, 'export', '--platform', 'web', '--clear', '--max-workers', '2', '--output-dir',
    accountTests ? 'dist-account-e2e' : 'dist'];
  if (process.env.EXPO_E2E_DEV === '1') exportArgs.push('--dev');
  const result = spawnSync(process.execPath, exportArgs, {
    env: {
      ...process.env,
      EXPO_PUBLIC_SUPABASE_URL: accountTests ? 'https://beybridge-e2e.invalid' : 'https://beybridge-discovery-e2e.invalid',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'e2e-placeholder',
      EXPO_PUBLIC_SENTRY_DSN: '',
      SENTRY_ORG: '',
      SENTRY_PROJECT: '',
    },
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
