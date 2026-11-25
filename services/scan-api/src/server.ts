/**
 * Node 실행 진입점 (Docker·VM·Render·Fly.io 등)
 *   ANTHROPIC_API_KEY=... PORT=8787 npm start -w @daro/scan-api
 * 프록시 뒤에서 실행하면 TRUST_PROXY=1 (X-Forwarded-For 첫 IP 사용)
 */
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { handlerFromEnv } from './config.ts';

const handle = handlerFromEnv(process.env);
const port = Number(process.env.PORT ?? 8787);
const trustProxy = process.env.TRUST_PROXY === '1';

createServer(async (req, res) => {
  try {
    const ip = (trustProxy && String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
    const ctrl = new AbortController();
    res.on('close', () => ctrl.abort());
    const request = new Request(`http://localhost${req.url ?? '/'}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' ? undefined : (Readable.toWeb(req) as ReadableStream),
      duplex: 'half',
      signal: ctrl.signal,
    } as RequestInit);
    const response = await handle(request, ip);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"ok":false,"error":"server_error"}');
  }
}).listen(port, () => console.info(JSON.stringify({ event: 'listening', port })));
