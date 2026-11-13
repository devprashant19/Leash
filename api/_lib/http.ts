import type { IncomingMessage, ServerResponse } from 'http';

export type Req = IncomingMessage & { body?: unknown; method?: string };
export type Res = ServerResponse;

/** JSON with bigint support. */
export function sendJson(res: Res, status: number, payload: unknown): void {
  const body = JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function parseJson(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('The request body must be JSON: { "to": "0x…", "valueEth": "0.05", "data": "0x", "operation": "call" }.');
  }
}

export async function readBody(req: Req): Promise<unknown> {
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? parseJson(req.body) : req.body;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.length > 16_384) throw new Error('Request body too large.');
  return parseJson(raw);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
