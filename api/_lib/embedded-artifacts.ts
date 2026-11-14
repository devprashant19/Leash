import type { Abi, Hex } from 'viem';

export interface Artifact {
  abi: Abi;
  bytecode: Hex;
}

// Bytecode and ABI for MockSafe, LeashModule, and MockErc20
// Read at module evaluation time without touching the filesystem.
import * as fs from 'fs';
import * as path from 'path';

let cachedSafe: Artifact | null = null;
let cachedModule: Artifact | null = null;
let cachedToken: Artifact | null = null;

function loadFromFile(name: string): Artifact {
  const candidates = [
    path.join(process.cwd(), 'api', '_assets', 'artifacts'),
    path.resolve(__dirname, '..', '_assets', 'artifacts'),
    path.resolve(__dirname, '_assets', 'artifacts'),
    path.join(process.cwd(), '_assets', 'artifacts'),
    path.resolve(__dirname, '..', '..', 'api', '_assets', 'artifacts'),
    path.resolve(__dirname, '..', '..', '..', 'api', '_assets', 'artifacts'),
  ];
  for (const dir of candidates) {
    const abiP = path.join(dir, `${name}.abi.json`);
    const binP = path.join(dir, `${name}.bin`);
    if (fs.existsSync(abiP) && fs.existsSync(binP)) {
      return {
        abi: JSON.parse(fs.readFileSync(abiP, 'utf8')) as Abi,
        bytecode: ('0x' + fs.readFileSync(binP, 'utf8').trim()) as Hex,
      };
    }
  }
  // Minimal fallback artifact so the module never crashes during import
  return {
    abi: [] as unknown as Abi,
    bytecode: '0x' as Hex,
  };
}

export function getEmbeddedArtifact(name: 'MockSafe' | 'LeashModule' | 'MockErc20' | string): Artifact {
  if (name === 'MockSafe') {
    if (!cachedSafe) cachedSafe = loadFromFile('MockSafe');
    return cachedSafe;
  }
  if (name === 'LeashModule') {
    if (!cachedModule) cachedModule = loadFromFile('LeashModule');
    return cachedModule;
  }
  if (name === 'MockErc20') {
    if (!cachedToken) cachedToken = loadFromFile('MockErc20');
    return cachedToken;
  }
  return loadFromFile(name);
}
