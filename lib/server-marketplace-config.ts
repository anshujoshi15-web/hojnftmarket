import { isAddress } from "viem";
import { getMarketplaceChain, type MarketplaceChainId } from "./marketplace-chains";
import type { D1Database } from "./marketplace-index";
export type RuntimeEnv = {
  ALCHEMY_API_KEY?: string;
  DB?: D1Database;
  MARKETPLACE_ADDRESS?: string;
  MARKETPLACE_DEPLOY_BLOCK?: string;
  ETHEREUM_MARKETPLACE_ADDRESS?: string;
  ETHEREUM_MARKETPLACE_DEPLOY_BLOCK?: string;
  ETHEREUM_RPC_URL?: string;
  CRONOS_MARKETPLACE_ADDRESS?: string;
  CRONOS_MARKETPLACE_DEPLOY_BLOCK?: string;
  CRONOS_LEGACY_MARKETPLACE_ADDRESS?: string;
  CRONOS_LEGACY_MARKETPLACE_DEPLOY_BLOCK?: string;
  CRONOS_RPC_URL?: string;
  SHIBARIUM_MARKETPLACE_ADDRESS?: string;
  SHIBARIUM_MARKETPLACE_DEPLOY_BLOCK?: string;
  SHIBARIUM_LEGACY_MARKETPLACE_ADDRESS?: string;
  SHIBARIUM_LEGACY_MARKETPLACE_DEPLOY_BLOCK?: string;
  SHIBARIUM_RPC_URL?: string;
  POLYGON_MARKETPLACE_ADDRESS?: string;
  POLYGON_MARKETPLACE_DEPLOY_BLOCK?: string;
  POLYGON_RPC_URL?: string;
  BASE_MARKETPLACE_ADDRESS?: string;
  BASE_MARKETPLACE_DEPLOY_BLOCK?: string;
  BASE_RPC_URL?: string;
  ROBINHOOD_MARKETPLACE_ADDRESS?: string;
  ROBINHOOD_MARKETPLACE_DEPLOY_BLOCK?: string;
  ROBINHOOD_RPC_URL?: string;
  ZORA_MARKETPLACE_ADDRESS?: string;
  ZORA_MARKETPLACE_DEPLOY_BLOCK?: string;
  ZORA_RPC_URL?: string;
  APECHAIN_MARKETPLACE_ADDRESS?: string;
  APECHAIN_MARKETPLACE_DEPLOY_BLOCK?: string;
  APECHAIN_RPC_URL?: string;
  ARC_MARKETPLACE_ADDRESS?: string;
  ARC_MARKETPLACE_DEPLOY_BLOCK?: string;
  ARC_LEGACY_MARKETPLACE_ADDRESS?: string;
  ARC_LEGACY_MARKETPLACE_DEPLOY_BLOCK?: string;
  ARC_RPC_URL?: string;
};

const SHIBARIUM_V7_ADDRESS="0x455DaD76334a67660D61bb319d8CfF1010e33049";
const SHIBARIUM_V7_DEPLOY_BLOCK="19169320";
const BASE_V7_ADDRESS="0x50489Fdc2352917595359667b34b384b33184b91";
const BASE_V7_DEPLOY_BLOCK="51813478";
const CRONOS_V7_ADDRESS="0x74cE4e02E754DAdc3BA27CB4f8678538F0833eab";
const CRONOS_V7_DEPLOY_BLOCK="96267649";
const ARC_V7_ADDRESS="0xD9883fDdf57Ca58f775Bdab96C0e7c3F1c918af3";
const ARC_V7_DEPLOY_BLOCK="22840359";

export function chainConfig(runtime: RuntimeEnv, chainId: MarketplaceChainId) {
  const chain = getMarketplaceChain(chainId);
  const alchemyNetwork:Partial<Record<MarketplaceChainId,string>>={1:"eth-mainnet",137:"polygon-mainnet",8453:"base-mainnet"};
  const fallbackRpcUrl=runtime.ALCHEMY_API_KEY&&alchemyNetwork[chainId]?`https://${alchemyNetwork[chainId]}.g.alchemy.com/v2/${runtime.ALCHEMY_API_KEY}`:undefined;
  if (chainId === 1) return {
    fallbackRpcUrl,
    chain,
    address: runtime.ETHEREUM_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.ETHEREUM_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.ETHEREUM_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 25) {
    const configuredAddress=runtime.CRONOS_MARKETPLACE_ADDRESS;
    const address=!configuredAddress||configuredAddress.toLowerCase()===CRONOS_V7_ADDRESS.toLowerCase()?chain.marketplaceAddress:configuredAddress;
    const deployBlock=address.toLowerCase()===chain.marketplaceAddress.toLowerCase()?String(chain.marketplaceDeployBlock):runtime.CRONOS_MARKETPLACE_DEPLOY_BLOCK??String(chain.marketplaceDeployBlock);
    return {fallbackRpcUrl,chain,address,deployBlock,rpcUrl:runtime.CRONOS_RPC_URL??chain.rpcUrl};
  }
  if (chainId === 109) {
    const configuredAddress=runtime.SHIBARIUM_MARKETPLACE_ADDRESS ?? runtime.MARKETPLACE_ADDRESS;
    // Existing deployments may still carry the previous V7 environment default.
    // Keep that address available as legacy while routing new listings to V8.
    const address=configuredAddress?.toLowerCase()===SHIBARIUM_V7_ADDRESS.toLowerCase()||!configuredAddress
      ? chain.marketplaceAddress : configuredAddress;
    const deployBlock=address.toLowerCase()===chain.marketplaceAddress.toLowerCase()
      ? String(chain.marketplaceDeployBlock)
      : runtime.SHIBARIUM_MARKETPLACE_DEPLOY_BLOCK ?? runtime.MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock);
    return {fallbackRpcUrl,chain,address,deployBlock,rpcUrl:runtime.SHIBARIUM_RPC_URL ?? chain.rpcUrl};
  }
  if (chainId === 137) return {
    fallbackRpcUrl,
    chain,
    address: runtime.POLYGON_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.POLYGON_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.POLYGON_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 8453) {
    const configuredAddress=runtime.BASE_MARKETPLACE_ADDRESS;
    const address=configuredAddress?.toLowerCase()===BASE_V7_ADDRESS.toLowerCase()||!configuredAddress
      ? chain.marketplaceAddress : configuredAddress;
    const deployBlock=address.toLowerCase()===chain.marketplaceAddress.toLowerCase()
      ? String(chain.marketplaceDeployBlock)
      : runtime.BASE_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock);
    return {fallbackRpcUrl,chain,address,deployBlock,rpcUrl:runtime.BASE_RPC_URL ?? chain.rpcUrl};
  }
  if (chainId === 5042) {
    const configuredAddress=runtime.ARC_MARKETPLACE_ADDRESS;
    const address=!configuredAddress||configuredAddress.toLowerCase()===ARC_V7_ADDRESS.toLowerCase()?chain.marketplaceAddress:configuredAddress;
    const deployBlock=address.toLowerCase()===chain.marketplaceAddress.toLowerCase()?String(chain.marketplaceDeployBlock):runtime.ARC_MARKETPLACE_DEPLOY_BLOCK??String(chain.marketplaceDeployBlock);
    return {fallbackRpcUrl,chain,address,deployBlock,rpcUrl:runtime.ARC_RPC_URL??chain.rpcUrl};
  }
  if (chainId === 4663) return {
    fallbackRpcUrl,
    chain,
    address: runtime.ROBINHOOD_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.ROBINHOOD_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.ROBINHOOD_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 7777777) return {
    fallbackRpcUrl,
    chain,
    address: runtime.ZORA_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.ZORA_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.ZORA_RPC_URL ?? chain.rpcUrl,
  };
  return {
    fallbackRpcUrl,
    chain,
    address: runtime.APECHAIN_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.APECHAIN_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.APECHAIN_RPC_URL ?? chain.rpcUrl,
  };
}

export function legacyChainConfig(runtime:RuntimeEnv,chainId:MarketplaceChainId){
  const current=chainConfig(runtime,chainId);
  const prefix=current.chain.slug.toUpperCase();
  const values=runtime as Record<string,unknown>;
  const old=chainId===109?[SHIBARIUM_V7_ADDRESS,SHIBARIUM_V7_DEPLOY_BLOCK]:chainId===8453?[BASE_V7_ADDRESS,BASE_V7_DEPLOY_BLOCK]:chainId===25?[CRONOS_V7_ADDRESS,CRONOS_V7_DEPLOY_BLOCK]:chainId===5042?[ARC_V7_ADDRESS,ARC_V7_DEPLOY_BLOCK]:[current.chain.marketplaceAddress,String(current.chain.marketplaceDeployBlock)];
  const address=String(values[`${prefix}_LEGACY_MARKETPLACE_ADDRESS`]??old[0]);
  const deployBlock=String(values[`${prefix}_LEGACY_MARKETPLACE_DEPLOY_BLOCK`]??old[1]);
  if(!isAddress(address,{strict:false})||address.toLowerCase()===current.address.toLowerCase()||!/^\d+$/.test(deployBlock))return null;
  return {...current,address,deployBlock};
}
