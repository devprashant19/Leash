# Deployment Guide

Leash runs in four places, and each one is free: a local Anvil chain, the Sepolia testnet, a static host for the dashboard, and GitHub Releases for the `leash` CLI binary.

| Where | What runs there | Cost |
| :--- | :--- | :--- |
| Local Anvil | Mock Safe, `LeashModule`, demo token, the 5-transaction scenario | Free |
| Sepolia | The same contracts, driven by the scripted agent | Free (faucet test ETH) |
| GitHub Pages, Cloudflare Pages, Netlify or Vercel | `demo/dashboard/` reading `demo/run.json` | Free tier |
| GitHub Releases | Native `leash` binaries for Linux x86-64 and macOS arm64 | Free for public repos |

## 1. Local (Anvil)

Needs Fe 26.6.0, Node 20+ and Foundry (`anvil` on `PATH`).

```bash
fe build
fe build --backend native        # x86-64 Linux or AArch64 macOS: real Fe CLI predictions
cd demo && npm ci && npm run demo
```

The run prints `Prediction source: fe-native` when the predictions came from the Fe-built binary (`out/cli`), and writes `demo/run.json` and `demo/run.local.json`. Set `LEASH_REQUIRE_NATIVE=1` to make the run fail rather than use the TypeScript mirror; CI does this. Set `ANVIL_PATH` if `anvil` is not on `PATH`.

## 2. Sepolia testnet

1. **RPC.** The default is the free public endpoint `https://ethereum-sepolia-rpc.publicnode.com`. A free Alchemy or Infura key also works.
2. **Keys.** Run the wizard. It generates fresh testnet-only keys and writes `demo/.env`, which git ignores:

   ```bash
   cd demo && npm ci && npm run wizard
   ```

3. **Test ETH.** Send about 0.05 Sepolia ETH to the owner address the wizard printed, from a free faucet such as the Google Cloud Web3 faucet or the pk910 PoW faucet. `deploy.ts` warns below 0.02 ETH.
4. **Deploy.** (`deploy.ts` generates the `sepolia.json` file named below.) This deploys the Fe `MockSafe`, `LeashModule` and the demo token, enables the module, registers the agent key, and writes `demo/deployments/sepolia.json`: <!-- check-docs: ignore -->

   ```bash
   fe build
   npm run deploy:sepolia
   ```

5. **Run the agent.** The five scenario transactions run on Sepolia, with each prediction made before its transaction is sent. The results are written to `demo/run.json`:

   ```bash
   npm run agent:sepolia
   ```

   On Linux or macOS, run `fe build --backend native` first so the predictions come from the Fe binary.

6. **Publish the evidence.** Commit `demo/deployments/sepolia.json` <!-- check-docs: ignore --> and `demo/run.json`, and add the transaction hashes (Sepolia Etherscan links) to the README.

### Using a canonical Safe instead of the mock

1. Create a 1-of-1 Safe on Sepolia at app.safe.global. You pay only gas.
2. Put its address in `demo/.env` as `SAFE_ADDRESS`, and deploy `LeashModule` with that Safe as its `_safe` constructor argument.
3. In the Safe's Transaction Builder, send two transactions: `enableModule(<LeashModule address>)` to the Safe itself, then `setAgent(<agent>, <expiry>, <label>)` to `LeashModule`. Admin calls must come from the Safe, which `deploy.ts` cannot sign for a canonical Safe.

## 3. Dashboard (static hosting)

The dashboard is one static file, and it loads `../run.json`. Publish the whole `demo/` folder (without `node_modules`), and open `/dashboard/`.

- **GitHub Pages:** in the repo, go to Settings → Pages, deploy from a branch, and choose a branch whose root contains `dashboard/` and `run.json`. Copying `demo/dashboard` and `demo/run.json` into a `gh-pages` branch is the simplest way.
- **Cloudflare Pages, Netlify or Vercel:** set the output directory to `demo`, with no build command.

To check it locally: `npx serve demo`, then open `http://localhost:3000/dashboard/`.

## 4. CLI binary (GitHub Releases)

`.github/workflows/release.yml` builds `leash` with `fe build --backend native` on `ubuntu-latest` (x86-64) and `macos-14` (arm64):

- **Manual run** (Actions → Release → Run workflow): uploads the binaries as workflow artifacts.
- **Pushing a tag `cli-v*`:** also attaches them to a GitHub release for that tag.

Windows users run the Linux binary under WSL. Fe 26.6.0 links native binaries only on x86-64 Linux and AArch64 macOS.

## Health

- The local demo ends with `✓ SUCCESS: All 5 predictions matched on-chain execution with zero drift!` and exits 0.
- On any chain, the CLI and the contract print the same policy fingerprint:

  ```bash
  ./out/cli fingerprint
  cast call <LeashModule address> "fingerprint()(uint256)" --rpc-url <rpc>
  ```

  Both give `0x3efcfc58aec5d1e7e81b5bded7820ed3ed8a0e654cf4aff3bfb793a7494ae6ee` for the default policy (`cast` prints it as a decimal integer).
