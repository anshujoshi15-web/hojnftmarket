import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

test("magazine cover fallback uses only explicitly numbered publisher images", async () => {
  const { parseShibMagazineCovers, shibMagazineEdition } = await loadModule("lib/shib-magazine-cover.ts");
  const html = `
    <img alt="Issue 105" src="https://magazine.shib.io/wp-content/uploads/2026/04/105-cover1.png">
    <img alt="Edition 103" src="https://magazine.shib.io/wp-content/uploads/2025/12/Cover-103-1-775x1024.jpg" srcset="https://magazine.shib.io/wp-content/uploads/2025/12/Cover-103-1-775x1024.jpg 775w, https://magazine.shib.io/wp-content/uploads/2025/12/Cover-103-1.jpg 1779w">
    <img alt="Edition 77" src="https://magazine.shib.io/wp-content/uploads/2025/06/Cover-77-2.jpg">
    <img alt="Unnumbered" src="https://magazine.shib.io/wp-content/uploads/2025/04/Cover-final.jpg">
    <img alt="Outside source" src="https://example.com/wp-content/uploads/Cover-99.jpg">
  `;
  const covers = parseShibMagazineCovers(html);
  assert.deepEqual(covers.map(cover => cover.edition), [105, 103, 77]);
  assert.match(covers[1].imageUrl, /\/Cover-103-1\.jpg$/);
  assert.equal(shibMagazineEdition(109, "0x007Bbf85988cAF18Cf4222C9214e4fa019b3e002", "1030923"), 103);
  assert.equal(shibMagazineEdition(109, "0x007Bbf85988cAF18Cf4222C9214e4fa019b3e002", "250104"), 25);
  assert.equal(shibMagazineEdition(109, "0x007Bbf85988cAF18Cf4222C9214e4fa019b3e002", "261754"), 26);
  assert.equal(shibMagazineEdition(109, "0x007Bbf85988cAF18Cf4222C9214e4fa019b3e002", "295774"), 29);
  assert.equal(shibMagazineEdition(109, "0x007Bbf85988cAF18Cf4222C9214e4fa019b3e002", "10010000"), null);
});

test("published older covers resolve when token metadata is inaccessible", async () => {
  const { officialShibMagazineCover } = await loadModule("lib/shib-magazine-cover.ts");
  const cover25 = await officialShibMagazineCover(25);
  const cover26 = await officialShibMagazineCover(26);
  assert.match(cover25.imageUrl, /magazine\.shib\.io\/wp-content\/uploads\/.*\.png$/);
  assert.match(cover26.imageUrl, /magazine\.shib\.io\/wp-content\/uploads\/.*\.png$/);
  assert.notEqual(cover25.imageUrl, cover26.imageUrl);
});

test("publisher media catalog maps verified issue 25 to neighboring NFT covers", async () => {
  const { parseShibMagazineMediaCovers } = await loadModule("lib/shib-magazine-cover.ts");
  const media = [
    { title: { rendered: "Unrelated image" }, source_url: "https://magazine.shib.io/wp-content/uploads/other.png" },
    { title: { rendered: "NFT Cover for Shib Nami Ura" }, source_url: "https://magazine.shib.io/wp-content/uploads/29.jpeg" },
    { title: { rendered: "NFT Cover for Shib’s All Fired Up!" }, source_url: "https://magazine.shib.io/wp-content/uploads/28.png" },
    { title: { rendered: "NFT Cover for Underdog Rising" }, source_url: "https://magazine.shib.io/wp-content/uploads/27.jpeg" },
    { title: { rendered: "NFT Cover for SHIB Eyes Wall Street" }, source_url: "https://magazine.shib.io/wp-content/uploads/26.jpeg" },
    { title: { rendered: "NFT Cover for A Bold New Shib" }, source_url: "https://magazine.shib.io/wp-content/uploads/25.jpeg" },
    { title: { rendered: "NFT Cover for Untrusted" }, source_url: "https://example.com/wp-content/uploads/24.jpeg" },
  ];
  assert.deepEqual(parseShibMagazineMediaCovers(media).map(cover => cover.edition), [29, 28, 27, 26, 25]);
  assert.deepEqual(parseShibMagazineMediaCovers(media.slice(0, 4)), []);
});
