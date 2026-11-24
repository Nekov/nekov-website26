// Local server: serves dist/ and runs /api/contact. Usage: node scripts/dev.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(process.cwd(), 'dist');
const port = Number(process.argv[2] || 3456);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'application/xml' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      // Run the same function files Vercel runs: api/<path>.js, or api/<dir>/[token].js for the last segment.
      const parts = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '').split('/');
      let file = join(process.cwd(), 'api', ...parts) + '.js';
      try { await stat(file); } catch { file = join(process.cwd(), 'api', ...parts.slice(0, -1), '[token].js'); }
      const mod = await import(pathToFileURL(file).href);
      const handler = mod[req.method];
      if (!handler) { res.writeHead(405); return res.end('Method Not Allowed'); }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const r = await handler(request);
      const headers = {}; r.headers.forEach((v, k) => { headers[k] = v; });
      const setc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
      if (setc.length) headers['set-cookie'] = setc.map((c) => c.replace(/;\s*Secure/i, '')); // plain http on localhost
      res.writeHead(r.status, headers);
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let p = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!p.startsWith(root)) throw new Error('outside');
    if ((await stat(p)).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' }); return res.end(); }
      p = join(p, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
