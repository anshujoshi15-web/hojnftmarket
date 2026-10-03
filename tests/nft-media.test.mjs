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

test("Arc OpenSea video artwork uses the media URL with an MP4 extension", async () => {
  const { arcImage } = await loadModule("lib/opensea-nft.ts");
  const { nftMedia } = await loadModule("lib/nft-media.ts");
  const source = arcImage({
    identifier: "3488",
    contract: "0xb856127c2371b396f92993814d8f64c3204911de",
    original_image_url: "ipfs://bafybeidl35yu2hne4jems3wmdqn7vqbda4xdre63bmjgngmiezzw2cwprm",
    image_url: "https://raw2.seadn.io/arc/example.mp4",
  });
  assert.deepEqual(nftMedia(source, null), { imageUrl: null, videoUrl: "https://raw2.seadn.io/arc/example.mp4" });
});
