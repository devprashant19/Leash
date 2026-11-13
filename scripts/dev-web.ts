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

const root = path.resolve(__dirname, '..', 'web', 'dist');
const routes: Record<string, (req: any, res: any) => Promise<void>> = {
  '/api/demo': demo,
  '/api/check': check,
  '/api/health': healthFn,
};
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript' };

const port = Number(process.env.PORT || 3000);
http
  .createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const fn = routes[url.pathname];
    if (fn) return fn(req, res);
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
  })
  .listen(port, () => console.log(`Leash web on http://localhost:${port}`));
