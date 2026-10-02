import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

test("MP4 artwork is kept out of image renderers", async () => {
  const { nftMedia } = await loadModule("lib/nft-media.ts");
  assert.deepEqual(nftMedia("https://example.com/clip.mp4?token=1", null), {
    imageUrl: null,
    videoUrl: "https://example.com/clip.mp4?token=1",
  });
  assert.deepEqual(nftMedia("https://example.com/cover.png", "https://example.com/clip.mp4"), {
    imageUrl: "https://example.com/cover.png",
    videoUrl: "https://example.com/clip.mp4",
  });
  assert.deepEqual(nftMedia("https://example.com/cover.png", "https://example.com/page.html"), {
    imageUrl: "https://example.com/cover.png",
    videoUrl: null,
  });
});

test("known IPFS artwork uses a browser-facing gateway URL", async () => {
  const { directIpfsImageUrl } = await loadModule("lib/nft-media.ts");
  const cid = "QmdWc6vGdmZGNAy5TAPX6DEqsL2QH6ua1DRDrNPqnXeXdG";
  const expected = `https://gateway.pinata.cloud/ipfs/${cid}/art.png`;
  assert.equal(directIpfsImageUrl(`ipfs://${cid}/art.png`), expected);
  assert.equal(directIpfsImageUrl(`https://ipfs.io/ipfs/${cid}/art.png`), expected);
  assert.equal(directIpfsImageUrl("https://example.com/art.png"), null);
  assert.equal(directIpfsImageUrl("ipfs://bafybeiexample/art.png"), null);
});
