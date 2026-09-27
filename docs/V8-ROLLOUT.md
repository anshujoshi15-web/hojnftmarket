# V8 rollout and earlier marketplace access

V8 includes V7 settlement and adds `batchList` for several ERC-721 tokens from
one collection. Each chain needs its own V8 deployment. Existing V7 contracts
remain immutable and keep their listings, offers, approvals, and proceeds.
Never imply that changing an app address transfers this state.

## Shibarium deployment

- Chain ID: 109
- V8 address: `0xfb985d4eDd4C1F909899389C217aEC9D6895B72d`
- Deployment block: `19188433`
- Deployment transaction: `0x7896ba6637fa49b9e2cc3dd4f662c1b09ad7f9e2ecd453fd6e7c48e17872227d`
- Treasury: `0x6736d2eA9807297F0e56967361B9410854B86a5f`
- Earlier V7 address: `0x455DaD76334a67660D61bb319d8CfF1010e33049`, block `19169320`

Onchain reads returned version 8 and a 200-basis-point fee. The deployed runtime
matched the locally compiled V8 runtime for Solidity 0.8.36, Shanghai, optimizer
200 runs, excluding constructor immutable slots and compiler metadata. The
Shibarium explorer had not marked the source verified when this was recorded;
complete explorer source verification separately.

## Before deploying

1. Compile `contracts/NFTMarketplaceV8.sol` with Solidity 0.8.36, Shanghai,
   optimizer enabled with 200 runs. In Remix, copy the base, V4, V5, V6, V7,
   and V8 source files into the same `contracts` folder. Select
   `HOJNFTMarketplaceV8` as the contract.
2. Review the contract independently before significant mainnet trading.
   Run `npm test`, `npm run typecheck`, and `npm run build`; then exercise list,
   bulk list, buy, offers, editions, cancel, royalties, and withdrawals with
   small values on every target chain. Local tests are not an audit.
3. Confirm the chain and intended fee treasury before signing. The treasury
   is immutable and receives the 2% marketplace fee.

## After each deployment

Record chain ID, V8 address, deployment block, transaction hash, deployer,
treasury, compiler settings, and verified source on the chain explorer. Run:

```bash
CHECK_CHAIN_ID=8453 \
CHECK_MARKETPLACE_ADDRESS=0x... \
CHECK_TREASURY_ADDRESS=0x... \
npm run verify:marketplace-v8
```

The check requires code at the address, version 8, a 200-basis-point fee,
and the expected treasury. It does not compare deployed bytecode with the
locally compiled artifact or replace explorer source verification.

Configure `<CHAIN>_MARKETPLACE_ADDRESS` and
`<CHAIN>_MARKETPLACE_DEPLOY_BLOCK` for the new V8 deployment. Preserve the
earlier contract in `<CHAIN>_LEGACY_MARKETPLACE_ADDRESS` and
`<CHAIN>_LEGACY_MARKETPLACE_DEPLOY_BLOCK`. If no explicit legacy values are
provided, the app uses the checked-in V7 address and block when they differ
from the active address. Keep those checked-in values or set explicit legacy
values before editing them. Restart or redeploy the site, then check both:

For a chain currently marked `coming-soon` in
`lib/marketplace-chains.ts` (including Ethereum and Robinhood), change its
status to `live` only after the deployed V8 address and block are recorded.

```text
/api/indexer?chainId=8453
/api/indexer?chainId=8453&legacy=1
```

The current marketplace appears in `/market`; the earlier marketplace
appears in `/legacy`. Earlier listings can be bought or canceled from there,
and their offers and proceeds remain accessible on the earlier contract.
Owners must approve V8 separately and deliberately relist there if desired.
Funded offers cannot be moved; their makers should cancel or recover them
on the earlier contract.

Historical indexing on Vercel requires a persistent database integration.
Without one, the API may return only a recent scan window after a cold start.
Do not mark a network complete until `sync.caughtUp` is true and `syncError`
is null for both the current and earlier contract. The health command can be
run from an external monitor to alert on failures.

`setApprovalForAll` is a separate, one-time NFT collection transaction and
authorizes the marketplace contract for every NFT the user owns in that
collection. Batch listing is then one marketplace transaction per selected
batch. The Sell page can revoke the collection approval; doing so makes any
existing listings in that collection unbuyable until approval is restored.
