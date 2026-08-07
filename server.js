const { createServer } = require('http');
const next = require('next');

const PORT = 5000;
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
    handle(req, res);
  }).listen(PORT, '0.0.0.0', () => {
    console.log(`> Next.js custom server ready on http://0.0.0.0:${PORT}`);
  });
});
