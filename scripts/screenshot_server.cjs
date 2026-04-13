// Tiny screenshot receiver server
// Listens on port 3099, accepts POST /save with JSON {filename, data (base64 PNG)}
const http = require('http');
const fs = require('fs');
const path = require('path');

const SAVE_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

const server = http.createServer((req, res) => {
  // CORS headers so the browser can POST to us
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { filename, data } = JSON.parse(body);
        const buf = Buffer.from(data, 'base64');
        const filepath = path.join(SAVE_DIR, filename);
        fs.writeFileSync(filepath, buf);
        console.log(`Saved: ${filename} (${buf.length} bytes)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, filename }));
      } catch (e) {
        console.error('Error saving:', e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(3099, () => {
  console.log('Screenshot server listening on http://localhost:3099');
});
