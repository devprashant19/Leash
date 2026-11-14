/**
 * Local stand-in for Vercel: serves web/dist and the api/ functions on http://localhost:3000.
 *   npm run build:web && npx tsx scripts/dev-web.ts
 */
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import demo from '../api/demo';
import check from '../api/check';
import healthFn from '../api/health';
import tour from '../api/tour';

const root = path.resolve(__dirname, '..', 'web', 'dist');
const routes: Record<string, (req: any, res: any) => Promise<void>> = {
  '/api/demo': demo,
  '/api/check': check,
  '/api/health': healthFn,
  '/api/tour': tour,
};
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const port = Number(process.env.PORT || 3000);
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      const fn = routes[url.pathname];
      if (fn) {
        try {
          return await fn(req, res);
        } catch (routeErr) {
          console.error(`Error handling ${url.pathname}:`, routeErr);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: routeErr instanceof Error ? routeErr.message : String(routeErr) }));
          }
          return;
        }
      }
      let file = path.join(root, decodeURIComponent(url.pathname));
      if (!file.startsWith(root)) {
        res.statusCode = 403;
        return res.end('forbidden');
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) {
        res.statusCode = 404;
        return res.end('not found');
      }
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    } catch (serverErr) {
      console.error('Unhandled server error:', serverErr);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: serverErr instanceof Error ? serverErr.message : String(serverErr) }));
      }
    }
  })
  .listen(port, '0.0.0.0', () => console.log(`Leash web on http://localhost:${port}`));
