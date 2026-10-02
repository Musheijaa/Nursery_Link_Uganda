import { createServer, request as httpRequest, type Server } from 'node:http';
import { connect, type Socket } from 'node:net';

/**
 * A forwarding proxy with an off switch, for testing offline behaviour for real. Playwright's
 * setOffline() does not reach requests made by a service worker, so instead the browser's traffic
 * goes through this proxy and "offline" means every connection fails, for the page and the worker.
 */
export const netSwitch = async () => {
  let online = true;
  const sockets = new Set<Socket>();
  const server: Server = createServer((req, res) => {
    if (!online || !req.url) { req.socket.destroy(); return; }
    const upstream = httpRequest(req.url, { method: req.method, headers: req.headers }, up => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    });
    upstream.on('error', () => { req.socket.destroy(); });
    req.pipe(upstream);
  });
  // HTTPS (map tiles): a plain tunnel while online
  server.on('connect', (req, client: Socket) => {
    const [host = '', port = '443'] = (req.url ?? '').split(':');
    if (!online) { client.destroy(); return; }
    const upstream = connect(Number(port), host, () => { client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); upstream.pipe(client); client.pipe(upstream); });
    upstream.on('error', () => { client.destroy(); });
    client.on('error', () => { upstream.destroy(); });
  });
  server.on('connection', s => { sockets.add(s); s.on('close', () => { sockets.delete(s); }); });
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    /** For browser.newContext({ proxy }): every request, localhost included, goes through the switch. */
    proxy: { server: `http://127.0.0.1:${String(port)}`, bypass: '<-loopback>' },
    setOnline: (value: boolean) => {
      online = value;
      // Kept-alive connections would otherwise carry on working
      if (!value) for (const s of sockets) s.destroy();
    },
    close: () => new Promise<void>(resolve => { for (const s of sockets) s.destroy(); server.close(() => { resolve(); }); }),
  };
};
