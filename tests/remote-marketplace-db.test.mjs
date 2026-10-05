import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { loadModule } from "./load-module.mjs";
const { adaptLibsqlClient } = await loadModule("lib/remote-marketplace-db.ts");
const { loadMarketplaceIndex } = await loadModule("lib/marketplace-index.ts");

test("serverless adapter preserves rows and indexing cursor across fresh connections", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "hoj-db-"));
  const url = `file:${path.join(directory, "index.sqlite")}`;
  let client = createClient({ url });
  try {
    let db = adaptLibsqlClient(client);
    await db.batch([db.prepare("CREATE TABLE progress(scope TEXT PRIMARY KEY, last_block INTEGER)"), db.prepare("INSERT INTO progress VALUES (?,?)").bind("polygon:v8", 95000000)]);
    client.close();
    client = createClient({ url });
    db = adaptLibsqlClient(client);
    assert.deepEqual(await db.prepare("SELECT last_block FROM progress WHERE scope=?").bind("polygon:v8").first(), { last_block: 95000000 });
    assert.equal(await db.prepare("SELECT last_block FROM progress WHERE scope=?").bind("base:v8").first(), null);
  } finally { client.close(); await rm(directory, { recursive: true, force: true }); }
});

test("a failing indexing batch rolls back listings and cursor together", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    const db = adaptLibsqlClient(client);
    await db.batch([db.prepare("CREATE TABLE listings(id TEXT PRIMARY KEY)"), db.prepare("CREATE TABLE progress(last_block INTEGER)")]);
    await assert.rejects(() => db.batch([db.prepare("INSERT INTO listings VALUES ('nft:1')"), db.prepare("INSERT INTO progress VALUES (100)"), db.prepare("INSERT INTO missing_table VALUES (1)")]));
    assert.deepEqual(await db.prepare("SELECT COUNT(*) AS count FROM listings").first(), { count: 0 });
    assert.deepEqual(await db.prepare("SELECT COUNT(*) AS count FROM progress").first(), { count: 0 });
  } finally { client.close(); }
});

test("an RPC outage preserves a durable read-only snapshot scoped to its contract", async () => {
  const client = createClient({ url: "file::memory:" });
  const originalFetch = globalThis.fetch;
  const address = "0x1111111111111111111111111111111111111111";
  try {
    const db = adaptLibsqlClient(client);
    await db.batch([db.prepare("CREATE TABLE marketplace_verified_snapshots(scope TEXT PRIMARY KEY, data TEXT, verified_at INTEGER)")]);
    const saved = { stale: false, verificationFailed: false, listings: [{ id: "saved-nft" }], collections: [], offers: [{ id: "expired-offer" }], activity: [], sync: { safeLatest: 100, syncedThrough: 100, caughtUp: true, logsProcessed: 0 }, syncError: null };
    await db.batch([db.prepare("INSERT INTO marketplace_verified_snapshots VALUES (?,?,?)").bind(`marketplace:v3:4663:${address}`, JSON.stringify(saved), Date.now())]);
    globalThis.fetch = async () => { throw new Error("provider offline"); };
    const result = await loadMarketplaceIndex({ chain: { id: 4663, confirmations: 12 }, address, deployBlock: "1", rpcUrl: "https://rpc-test.invalid" }, db);
    assert.equal(result.stale, true);
    assert.equal(result.sync.caughtUp, false);
    assert.deepEqual(result.listings, saved.listings);
    assert.deepEqual(result.offers, []);
    assert.match(result.syncError, /read-only/);
    await assert.rejects(() => loadMarketplaceIndex({ chain: { id: 4663, confirmations: 12 }, address: "0x2222222222222222222222222222222222222222", deployBlock: "1", rpcUrl: "https://rpc-test.invalid" }, db));
  } finally { globalThis.fetch = originalFetch; client.close(); }
});
