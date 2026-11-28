import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './load-module.mjs';
const {chainConfig}=await loadModule('lib/server-marketplace-config.ts');
const {marketplaceChains}=await loadModule('lib/marketplace-chains.ts');
test('new Ethereum and ApeChain deployments are live with matching start blocks',()=>{
  for(const [id,address,block] of [[1,'0x773e6c3020Ec65bf59e0aE2EAc4380EFE372646e','26513170'],[33139,'0x03fE1DD040556aAa58D2DeEdb7896142257A21C9','56111461']]){
    const config=chainConfig({},id);
    assert.equal(config.address,address);assert.equal(config.deployBlock,block);assert.equal(config.chain.marketplaceStatus,'live');
  }
  assert.equal(Object.values(marketplaceChains).filter(chain=>chain.marketplaceStatus==='live').length,9);
});
test('empty Ethereum env and old ApeChain deployment migrate to current defaults',()=>{
  assert.equal(chainConfig({ETHEREUM_MARKETPLACE_ADDRESS:'',ETHEREUM_MARKETPLACE_DEPLOY_BLOCK:''},1).deployBlock,'26513170');
  const ape=chainConfig({APECHAIN_MARKETPLACE_ADDRESS:'0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875',APECHAIN_MARKETPLACE_DEPLOY_BLOCK:'50360444'},33139);
  assert.equal(ape.address,marketplaceChains[33139].marketplaceAddress);assert.equal(ape.deployBlock,'56111461');
});
test('explicit custom deployments retain their own indexing block',()=>{
  const address='0x1111111111111111111111111111111111111111';
  const config=chainConfig({ETHEREUM_MARKETPLACE_ADDRESS:address,ETHEREUM_MARKETPLACE_DEPLOY_BLOCK:'123'},1);
  assert.equal(config.address,address);assert.equal(config.deployBlock,'123');
});
