const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const PORT = 5000;
const PROXY_PREFIX = '/port/5000';
const app = next({ dev: false, hostname: '0.0.0.0', port: PORT });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    // Health check endpoint for start_server
    if (req.url === '/health' || req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Strip the proxy prefix from the URL
    // The deploy_website proxy sends requests as /port/5000/...
    // We need to strip /port/5000 so Next.js sees the actual path
    let url = req.url;
    if (url.startsWith(PROXY_PREFIX)) {
      url = url.slice(PROXY_PREFIX.length) || '/';
    }
    req.url = url;

    const parsedUrl = parse(url, true);
    handle(req, res, parsedUrl);
  }).listen(PORT, '0.0.0.0', () => {
    console.log(`> Next.js custom server ready on http://0.0.0.0:${PORT}`);
  });
});
