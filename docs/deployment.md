# Deployment Guide

Leash runs in four places, and each one is free: a Vercel site where anyone can run the demo in the browser, a local Anvil chain, the Sepolia testnet, and GitHub Releases for the `leash` CLI binary.

| Where | What runs there | Cost |
| :--- | :--- | :--- |
| Vercel (Hobby) | The interactive page: the full 5-transaction demo and "try your own transaction", on the Fe-compiled contracts and the Fe-built `leash` binary | Free; visitors need no account |
| Local Anvil | Mock Safe, `LeashModule`, demo token, the 5-transaction scenario | Free |
| Sepolia | The same contracts, driven by the scripted agent | Free (faucet test ETH) |
| GitHub Releases | Native `leash` binaries for Linux x86-64 and macOS arm64 | Free for public repos |

## 0. Vercel (the page judges open)

What it is:

- `web/index.html`: the page, plus the recorded-run dashboard at `/dashboard/`.
- `api/demo.ts`, `api/check.ts`, `api/health.ts`: Node functions. Each request deploys the Fe-compiled `MockSafe`, `LeashModule` and `MockErc20` (from `api/_assets/artifacts/`) into a fresh in-memory EVM (`@ethereumjs/vm`, Prague rules). Before each agent transaction, the bundled Fe-built binary (`api/_assets/leash-linux-x86_64`, from the `cli-v0.1.0` release) predicts the verdict from the agent's on-chain state. On Vercel the TypeScript mirror is switched off: if the binary cannot run, the request fails rather than fall back.
- Nothing touches a real network, and no keys or environment variables are needed.

Deploy:

1. Import the GitHub repository at vercel.com/new. Framework preset: **Other**. `vercel.json` supplies the install command, build command, output directory and function settings, so leave those fields empty.
2. Deploy. Or from a terminal: `npx vercel login`, then `npx vercel --prod` from the repo root.
3. Open `<your-domain>/api/health`. It should report `"predictionSource":"fe-native"` and `"cliVersion":"leash 0.1.0 (fe 26.6.0)"`.

Shareable links: `/?run` runs the demo on load, `/?tour` runs the full feature tour, and `/?try=N` runs example N (0 = 0.05 ETH to the treasury, 1 = 0.2 ETH over the cap, 2 = transfer 50 tokens, 3 = transfer 101 tokens, 4 = unlimited approve, 5 = unlisted contract, 6 = delegatecall).

Keep it in sync: after a Fe change, run `fe build && npm run sync:web` and commit `api/_assets/artifacts/`. To refresh the binary, run `gh release download <tag> -p leash-linux-x86_64 -D api/_assets --clobber`. The CI `web` job fails if either is stale.

Run it locally: `npm ci && npm run build:web && npx tsx scripts/dev-web.ts`, then open `http://localhost:3000`. For live editing of the page, `npm run dev:web` serves it with hot reload on `http://localhost:5173`. Run `npm run test:web` to check the functions without a server.

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

## 3. Dashboard only (static hosting)

The Vercel site above already serves the dashboard at `/dashboard/`. To host only the dashboard elsewhere: it is one static file, and it loads `../run.json`. Publish the whole `demo/` folder (without `node_modules`), and open `/dashboard/`.

- **GitHub Pages:** in the repo, go to Settings → Pages, deploy from a branch, and choose a branch whose root contains `dashboard/` and `run.json`. Copying `demo/dashboard` and `demo/run.json` into a `gh-pages` branch is the simplest way.
- **Cloudflare Pages, Netlify or Vercel:** set the output directory to `demo`, with no build command.

To check it locally: `npx serve demo`, then open `http://localhost:3000/dashboard/`.

## 4. CLI binary (GitHub Releases)

`.github/workflows/release.yml` builds `leash` with `fe build --backend native` on `ubuntu-latest` (x86-64) and `macos-latest` (Apple Silicon, arm64):

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
