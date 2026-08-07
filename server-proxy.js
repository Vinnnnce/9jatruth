const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 5000;
const NEXT_PORT = 3000;

// Health check endpoint — responds immediately for start_server
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Proxy all other requests to the Next.js server
app.use('/', createProxyMiddleware({
  target: `http://127.0.0.1:${NEXT_PORT}`,
  changeOrigin: true,
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Express proxy server running on port ${PORT}, forwarding to Next.js on port ${NEXT_PORT}`);
});
