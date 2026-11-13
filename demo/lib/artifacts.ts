import * as fs from 'fs';
import * as path from 'path';

function loadArtifact(ingot: string, name: string) {
  const baseDir = path.resolve(__dirname, '..', '..', 'ingots', ingot, 'out');
  const bytecodePath = path.join(baseDir, `${name}.bin`);
  const abiPath = path.join(baseDir, `${name}.abi.json`);

  if (!fs.existsSync(bytecodePath)) {
    throw new Error(`Bytecode not found at ${bytecodePath}. Run 'fe build ingots/${ingot}' first.`);
  }
  if (!fs.existsSync(abiPath)) {
    throw new Error(`ABI not found at ${abiPath}. Run 'fe build ingots/${ingot}' first.`);
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

