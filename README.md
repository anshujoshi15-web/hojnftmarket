# House of Joshi — Multichain NFT Marketplace

A non-custodial ERC-721 and ERC-1155 marketplace. HOJ trading is configured on Base, Cronos EVM, Shibarium, Polygon, Robinhood Chain, and Zora. Ethereum, ApeChain, and Arc are marked Coming soon for HOJ trading. Arc uses USDC as its native gas and settlement currency.

## Local setup

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app is connected by default to Shibarium V8 at `0xfb985d4eDd4C1F909899389C217aEC9D6895B72d` (block `19188433`). Earlier V7 activity remains available at `0x455DaD76334a67660D61bb319d8CfF1010e33049` (block `19169320`). Listings, offers, and proceeds do not migrate automatically.

## Multichain configuration

Nine chains are configured in the wallet and network UI. The active V8 deployments and earlier contract addresses are recorded in `lib/marketplace-chains.ts` and [the V8 rollout guide](docs/V8-ROLLOUT.md). Ethereum remains coming soon. Setting an address in the environment alone does not activate trading. Server environment values override the checked-in defaults; known earlier V7 contracts remain available as legacy:

```env
ETHEREUM_MARKETPLACE_ADDRESS=0x...
ETHEREUM_MARKETPLACE_DEPLOY_BLOCK=...
ETHEREUM_RPC_URL=https://cloudflare-eth.com

CRONOS_MARKETPLACE_ADDRESS=0x455DaD76334a67660D61bb319d8CfF1010e33049
CRONOS_MARKETPLACE_DEPLOY_BLOCK=96559481
CRONOS_LEGACY_MARKETPLACE_ADDRESS=0x74cE4e02E754DAdc3BA27CB4f8678538F0833eab
CRONOS_LEGACY_MARKETPLACE_DEPLOY_BLOCK=96267649
CRONOS_RPC_URL=https://evm.cronos.org

SHIBARIUM_MARKETPLACE_ADDRESS=0xfb985d4eDd4C1F909899389C217aEC9D6895B72d
SHIBARIUM_MARKETPLACE_DEPLOY_BLOCK=19188433
SHIBARIUM_LEGACY_MARKETPLACE_ADDRESS=0x455DaD76334a67660D61bb319d8CfF1010e33049
SHIBARIUM_LEGACY_MARKETPLACE_DEPLOY_BLOCK=19169320
SHIBARIUM_RPC_URL=https://...

POLYGON_MARKETPLACE_ADDRESS=0x77eD6097BF531c6ec3759Bd915858D5854057828
POLYGON_MARKETPLACE_DEPLOY_BLOCK=94642898
POLYGON_LEGACY_MARKETPLACE_ADDRESS=0x3C626ff68e9a69526117B22D288ab71bdA2B377a
POLYGON_LEGACY_MARKETPLACE_DEPLOY_BLOCK=94475428
POLYGON_RPC_URL=https://...

BASE_MARKETPLACE_ADDRESS=0x4188737783510f6A284F99212dBe3BF6C21Be8DA
BASE_MARKETPLACE_DEPLOY_BLOCK=51875993
BASE_LEGACY_MARKETPLACE_ADDRESS=0x50489Fdc2352917595359667b34b384b33184b91
BASE_LEGACY_MARKETPLACE_DEPLOY_BLOCK=51813478
BASE_RPC_URL=https://mainnet.base.org

ROBINHOOD_MARKETPLACE_ADDRESS=0xD9883fDdf57Ca58f775Bdab96C0e7c3F1c918af3
ROBINHOOD_MARKETPLACE_DEPLOY_BLOCK=75504936
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com

ZORA_MARKETPLACE_ADDRESS=0x455DaD76334a67660D61bb319d8CfF1010e33049
ZORA_MARKETPLACE_DEPLOY_BLOCK=51988065
ZORA_LEGACY_MARKETPLACE_ADDRESS=0x74cE4e02E754DAdc3BA27CB4f8678538F0833eab
ZORA_LEGACY_MARKETPLACE_DEPLOY_BLOCK=51861519
APECHAIN_MARKETPLACE_ADDRESS=0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875
APECHAIN_MARKETPLACE_DEPLOY_BLOCK=50360444

# Optional Blockscout-compatible NFT API overrides
ETHEREUM_EXPLORER_API_URL=https://eth.blockscout.com/api/v2
SHIBARIUM_EXPLORER_API_URL=https://.../api/v2
POLYGON_EXPLORER_API_URL=https://.../api/v2
BASE_EXPLORER_API_URL=https://.../api/v2
ROBINHOOD_EXPLORER_API_URL=https://robinhoodchain.blockscout.com/api/v2
```

The older `MARKETPLACE_ADDRESS` and `MARKETPLACE_DEPLOY_BLOCK` variables remain supported as Shibarium-only aliases. Cronos NFT wallet discovery uses the RPC ownership fallback and metadata fetching; complete ERC-721/1155 enumeration needs a compatible NFT indexer API, such as a configured `CRONOS_EXPLORER_API_URL` or server-side `BLOCKSCOUT_API_KEY`. Complete Zora NFT holdings need server-side `ALCHEMY_API_KEY`; the configured public Zora explorer NFT endpoint does not work. Set `OPENSEA_API_KEY` on the server to show supported OpenSea orders on NFT pages and enable compatible native-currency Seaport checkout. Never place these API keys in `NEXT_PUBLIC_` variables or in a committed file.

Listings, activity, and indexer cursors are stored with chain-specific IDs in the `multichain_listings` and `multichain_marketplace_activity` tables. The API contract is:

```text
GET /api/indexer?chainId=137
GET /api/wallet-nfts?owner=0x...&chainId=137
GET /api/nft?contract=0x...&tokenId=1&chainId=137
```

### Deploying a marketplace

The deployer wallet must hold enough native gas currency on the target network. Never put a private key in a committed file.

```bash
COMPILE_ONLY=1 DEPLOY_CHAIN_ID=8453 npm run deploy:marketplace
# For an actual deployment, supply DEPLOY_CHAIN_ID, DEPLOYER_PRIVATE_KEY,
# and FEE_TREASURY_ADDRESS through a secure local environment.
```

The command now compiles and deploys V8. It prints the address, block, deployer, and transaction hash. `FEE_TREASURY_ADDRESS` is the constructor argument: check it before signing because it cannot be changed on that deployment. For manual deployment and continuity with existing V7 markets, follow [the V8 rollout guide](docs/V8-ROLLOUT.md).

RainbowKit powers wallet connection and account management. Installed browser wallets work without extra configuration. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to a WalletConnect Cloud project ID to add QR-based mobile wallet connections.

## Contract

[`contracts/NFTMarketplaceV8.sol`](contracts/NFTMarketplaceV8.sol) is the current deployable marketplace. It inherits V7 and adds ERC-721 bulk listing for one collection per transaction. The first collection approval is a separate NFT contract transaction. Earlier deployed V7 contracts remain accessible through `/legacy` when a distinct V8 address is configured; their state does not migrate.

[`contracts/NFTMarketplaceV5.sol`](contracts/NFTMarketplaceV5.sol) defines the deployable `HOJNFTMarketplace`, built on the base and V4 contracts. It supports ERC-721 and ERC-1155 listings, purchases, and funded offers using the network's native currency. It deducts a 2% protocol fee, honors optional ERC-2981 royalties, and credits sellers, creators, and the constructor-supplied treasury to pull-payment balances withdrawn with `withdrawProceeds()`.

Base V5 reports treasury `0x6736d2eA9807297F0e56967361B9410854B86a5f`. Confirm this is the intended fee wallet. Each new deployment takes its own treasury address as a constructor parameter. Verify every new deployment on its network explorer, then configure the app with its address and deployment block. An old contract's offers, approvals, and withdrawable proceeds do not migrate; see [operations](docs/MARKETPLACE-OPERATIONS.md).

## Data layer

The marketplace intentionally ships without sample listings, activity, or metrics. Its D1-backed indexer reads confirmed `ItemListed`, `ItemCanceled`, `ItemBought`, and `ProceedsWithdrawn` events independently from each configured network, persists chain-specific block checkpoints, and exposes active listings and recent activity through `/api/indexer?chainId=...`.

On Vercel, `npm run build` creates the standard `.next` output. A persistent database is required for complete historical indexing; an ephemeral server filesystem cannot retain the index across restarts. The Cloudflare Sites build is available through `npm run build:sites` and uses the persistent D1 checkpoint.

## Production checklist

- Confirm the immutable fee treasury wallet on each deployed contract.
- Obtain an independent security review before handling significant value.
- Exercise ERC-721 and ERC-1155 list, buy, offer, cancel, royalty, and withdrawal flows with small values on each target chain.
- Set matching address and deployment-block overrides in production, keep legacy-contract withdrawal access, and wait for the indexer to catch up.
- Rebuild, deploy, and check the live app's `/api/indexer?chainId=8453` response.
