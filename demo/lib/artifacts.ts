import * as fs from 'fs';
import * as path from 'path';

function loadArtifact(ingot: string, name: string) {
  const root = path.resolve(__dirname, '..', '..');
  // `fe build ingots/<ingot>` writes to ingots/<ingot>/out; the workspace `fe build` writes to out/.
  const baseDir = [path.join(root, 'ingots', ingot, 'out'), path.join(root, 'out')].find((d) =>
    fs.existsSync(path.join(d, `${name}.bin`))
  );
  if (!baseDir) {
    throw new Error(`Bytecode for ${name} not found. Run 'fe build' (or 'fe build ingots/${ingot}') first.`);
  }
  const bytecodePath = path.join(baseDir, `${name}.bin`);
  const abiPath = path.join(baseDir, `${name}.abi.json`);
  if (!fs.existsSync(abiPath)) {
    throw new Error(`ABI not found at ${abiPath}. Run 'fe build' first.`);
  }

  const bytecode = ('0x' + fs.readFileSync(bytecodePath, 'utf8').trim()) as `0x${string}`;
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

  return { bytecode, abi };
}

export function getLeashModuleArtifact() {
  return loadArtifact('module', 'LeashModule');
}

export function getMockSafeArtifact() {
  return loadArtifact('testkit', 'MockSafe');
}

export function getMockErc20Artifact() {
  return loadArtifact('testkit', 'MockErc20');
}

