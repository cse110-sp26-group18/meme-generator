const fs = require('fs');
const http = require('http');
const path = require('path');

const port = Number(process.env.PORT || 4173);
const rootDir = path.resolve(process.cwd(), process.env.ROOT_DIR || 'meme-app');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function send(res, status, body, contentType) {
  res.writeHead(status, { 'Content-Type': contentType || 'text/plain; charset=utf-8' });
  res.end(body);
}

function resolveRequestPath(reqUrl) {
  const url = new URL(reqUrl, `http://127.0.0.1:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(rootDir, `.${requestedPath}`);

  if (!filePath.startsWith(rootDir + path.sep) && filePath !== rootDir) {
    return null;
  }

  return filePath;
}

const server = http.createServer((req, res) => {
  const filePath = resolveRequestPath(req.url);

  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      send(res, err.code === 'ENOENT' ? 404 : 500, err.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }

    send(res, 200, content, mimeTypes[path.extname(filePath).toLowerCase()]);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${rootDir} at http://127.0.0.1:${port}`);
});
