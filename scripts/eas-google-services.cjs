/* EAS pre-install hook. google-services.json is gitignored, so EAS never uploads
 * it. Store it as an EAS *file* environment variable named GOOGLE_SERVICES_JSON
 * (EAS provides the file's path); this copies it to the path app.json expects
 * before the release guard and prebuild run. Local builds keep using the local file. */
const fs = require('node:fs');
const path = require('node:path');

const source = process.env.GOOGLE_SERVICES_JSON;
const target = path.join(process.cwd(), 'google-services.json');

if (!source) {
  console.log('GOOGLE_SERVICES_JSON is not set; using any existing google-services.json.');
} else if (!fs.existsSync(source)) {
  console.error(`GOOGLE_SERVICES_JSON points to a missing file: ${source}`);
  process.exitCode = 1;
} else {
  fs.copyFileSync(source, target);
  console.log('Copied google-services.json from the GOOGLE_SERVICES_JSON EAS file variable.');
}
