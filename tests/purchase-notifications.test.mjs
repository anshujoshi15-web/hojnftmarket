import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

test("confirmed purchase notices are stored once per NFT and transaction",async()=>{
  const {notifyNFTPurchased,getNotifications}=await loadModule("lib/notifications.ts");
  const values=new Map();
  const events=[];
  const previousWindow=globalThis.window,previousStorage=globalThis.localStorage;
  globalThis.window={dispatchEvent:event=>events.push(event)};
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const previousEvent=globalThis.CustomEvent;
  globalThis.CustomEvent=class {constructor(type,options){this.type=type;this.detail=options.detail;}};
  try{
    const wallet="0x3333333333333333333333333333333333333333";
    const contract="0x1111111111111111111111111111111111111111";
    const hash=`0x${"a".repeat(64)}`;
    notifyNFTPurchased(wallet,"Token #1","0.1","ETH",8453,hash,contract,"1");
    notifyNFTPurchased(wallet,"Token #1","0.1","ETH",8453,hash,contract,"1");
    notifyNFTPurchased(wallet,"Token #2","0.2","ETH",8453,hash,contract,"2");
    const notifications=getNotifications(wallet);
    assert.equal(notifications.length,2);
    assert.equal(events.length,2);
    assert.deepEqual(notifications.map(item=>item.type),["PURCHASE","PURCHASE"]);
    assert.match(notifications[0].message,/Token #2/);
  }finally{
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage;
    if(previousEvent===undefined)delete globalThis.CustomEvent;else globalThis.CustomEvent=previousEvent;
  }
});
