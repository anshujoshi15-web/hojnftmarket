import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

test("NFT search matches names, networks, contracts and token IDs across terms", async () => {
  const { matchesNftQuery } = await loadModule("lib/nft-search.ts");
  const fields = ["Shine Bright", "Ice Girlz Specials", "Polygon", "0xAbC123", "27"];
  assert.equal(matchesNftQuery("shine polygon", fields), true);
  assert.equal(matchesNftQuery("abc123 27", fields), true);
  assert.equal(matchesNftQuery("shine base", fields), false);
  assert.equal(matchesNftQuery(" ", fields), true);
});
