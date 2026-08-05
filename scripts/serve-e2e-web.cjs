const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const port = Number(process.argv[2] ?? 8081);
const root = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(root, 'index.html');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const candidate = path.resolve(root, pathname.replace(/^\/+/, ''));
  const isInsideRoot = candidate === root || candidate.startsWith(`${root}${path.sep}`);
  const filePath =
    isInsideRoot && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? candidate
      : indexPath;

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1');
process.on('SIGTERM', () => server.close());
