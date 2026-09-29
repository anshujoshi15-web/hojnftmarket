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
  assert.equal(shibMagazineEdition(109, "0x007Bbf85988cAF18Cf4222C9214e4fa019b3e002", "1033000"), null);
});

test("published older covers resolve when token metadata is inaccessible", async () => {
  const { officialShibMagazineCover } = await loadModule("lib/shib-magazine-cover.ts");
  const cover25 = await officialShibMagazineCover(25);
  const cover26 = await officialShibMagazineCover(26);
  assert.match(cover25.imageUrl, /magazine\.shib\.io\/wp-content\/uploads\/.*\.png$/);
  assert.match(cover26.imageUrl, /magazine\.shib\.io\/wp-content\/uploads\/.*\.png$/);
  assert.notEqual(cover25.imageUrl, cover26.imageUrl);
});
