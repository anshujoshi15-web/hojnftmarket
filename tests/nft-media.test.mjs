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
