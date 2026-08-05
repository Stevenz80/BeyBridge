const { spawnSync } = require('node:child_process');

const expoCli = require.resolve('expo/bin/cli');
const exportArgs = [expoCli, 'export', '--platform', 'web'];
if (process.env.EXPO_E2E_DEV === '1') exportArgs.push('--dev');
const result = spawnSync(
  process.execPath,
  exportArgs,
  {
    env: {
      ...process.env,
      EXPO_PUBLIC_SUPABASE_URL: '',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      EXPO_PUBLIC_SENTRY_DSN: '',
      SENTRY_ORG: '',
      SENTRY_PROJECT: '',
    },
    stdio: 'inherit',
  }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
