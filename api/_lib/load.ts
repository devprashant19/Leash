import type * as Engine from './engine';

let cached: typeof Engine | undefined;

/**
 * The engine, loaded on first use inside the handler's try block, so a load failure becomes a JSON error.
 *
 * On Vercel this is engine.bundle.cjs, built by scripts/bundle-api.mjs. The bundle is needed because the
 * @ethereumjs packages' CommonJS builds `require()` @noble/curves and @noble/hashes v2, which ship only as
 * ES modules, and Vercel's Node runtime rejects require() of an ES module (ERR_REQUIRE_ESM). esbuild
 * converts those modules to CommonJS at build time. Without a bundle (local dev, tests) the TS source is used.
 */
export function engine(): typeof Engine {
  if (!cached) {
    try {
      cached = require('./engine.bundle.cjs') as typeof Engine;
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'MODULE_NOT_FOUND' || !String(err.message).includes('engine.bundle.cjs')) throw e;
      cached = require('./engine') as typeof Engine;
    }
  }
  return cached;
}
