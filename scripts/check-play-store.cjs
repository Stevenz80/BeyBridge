const { validateStoreConfig } = require('./play-store-config.cjs');
// EAS runs this lifecycle hook for every profile; local checks are explicit.
if (process.argv.includes('--eas') && process.env.EAS_BUILD_PROFILE !== 'production') process.exit(0);
const problems = validateStoreConfig(process.env, process.cwd());
if (problems.length) {
  console.error('Play Store release configuration is incomplete:');
  for (const problem of problems) console.error(`- ${problem}`);
  console.error('See PLAY_STORE_READINESS.md. Configuration checks do not certify store acceptance.');
  process.exit(1);
}
console.log('Release configuration checks passed. Deployment, policy, AAB and device checks remain required.');
