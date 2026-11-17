import assert from "node:assert/strict";
import { buildSearchSnippet, normalizeSearchQuery, snippetMatchesQuery } from "./docs-search";
import { tagKeyFromName, uniqueTagNames } from "./docs-tags";
import { docsContentToHtml, importMarkupDetailed } from "./docs-html";
import { sanitizeDocsContent } from "./docs-content";
import { assignHeadingAnchors } from "./docs-outline";

{
  const snippet = buildSearchSnippet("前面有一些字，这里是颗秒目录，后面还有。", "颗秒目录");
  assert.ok(snippet);
  assert.equal(snippetMatchesQuery(snippet, "颗秒目录"), true);
  assert.equal(snippet.text.includes("<"), false);
  assert.equal(normalizeSearchQuery("  a   b  "), "a b");
}

{
  assert.equal(tagKeyFromName(" 颗秒 目录 "), tagKeyFromName("颗秒 目录"));
  assert.deepEqual(uniqueTagNames(["甲", "甲", " 甲 ", "乙"]), ["甲", "乙"]);
}

{
  const imported = importMarkupDetailed(
    `<h2 data-anchor-id="h_abcdef123456">节</h2><p>正文<strong>粗</strong></p><table><tr><th>名</th><td>值</td></tr></table><p><img src="/uploads/a.png" alt="细图" width="120" height="640"></p><iframe src="https://evil.example"></iframe><script>alert(1)</script>`,
    "html",
  );
  assert.equal(imported.content.content?.[0]?.type, "heading");
  assert.equal(imported.content.content?.[0]?.attrs?.anchorId, "h_abcdef123456");
  assert.equal(imported.content.content?.[1]?.type, "paragraph");
  assert.equal(imported.content.content?.some((node) => node.type === "heading" && node.content?.[0]?.text === "粗"), false);
  assert.equal(imported.content.content?.some((node) => node.type === "table"), true);
  assert.equal(imported.content.content?.some((node) => node.type === "image"), true);
  assert.equal(JSON.stringify(imported.content).includes("alert"), false);
  assert.equal(JSON.stringify(imported.content).includes("evil.example"), false);
  assert.ok(imported.warnings.length > 0);
  const html = docsContentToHtml(assignHeadingAnchors(sanitizeDocsContent(imported.content), "roundtrip").content);
  assert.match(html, /id="h_abcdef123456"/);
  assert.match(html, /src="\/uploads\/a.png"/);
  assert.match(html, /width="120"/);
}

{
  const bold = importMarkupDetailed("<p><strong>不是标题</strong></p>", "html");
  assert.equal(bold.content.content?.[0]?.type, "paragraph");
  assert.equal(bold.content.content?.[0]?.content?.[0]?.marks?.[0]?.type, "bold");
}

console.log("docs-search and import tests ok");
