import assert from "node:assert/strict";
import { assignHeadingAnchors, extractOutline, visibleOutlineItems, activeOutlineAnchor } from "./docs-outline";
import type { DocsJsonNode } from "./docs-content";

const doc = (content: DocsJsonNode["content"]): DocsJsonNode => ({ type: "doc", content });
const heading = (level: number, text: string, anchorId?: string): DocsJsonNode => ({
  type: "heading",
  attrs: anchorId ? { level, anchorId } : { level },
  content: text ? [{ type: "text", text }] : [{ type: "text", text: "" }],
});

{
  const first = assignHeadingAnchors(
    doc([heading(1, "开始"), heading(2, "开始"), heading(3, "🚀 标题"), heading(2, "")]),
    "doc-a",
  );
  const second = assignHeadingAnchors(first.content, "doc-a");
  assert.equal(second.changed, false);
  assert.equal(JSON.stringify(first.content), JSON.stringify(second.content));
  const outline = extractOutline(first.content, "doc-a");
  assert.equal(outline.length, 4);
  assert.notEqual(outline[0].anchorId, outline[1].anchorId);
  assert.equal(outline[0].text, outline[1].text);
  assert.equal(outline[2].text, "🚀 标题");
  assert.equal(outline[3].empty, true);
}

{
  const anchored = assignHeadingAnchors(doc([heading(1, "甲", "h_aaaabbbbcccc"), heading(2, "乙")]), "doc-b");
  const renamed = {
    ...anchored.content,
    content: [
      heading(1, "甲改名", "h_aaaabbbbcccc"),
      heading(1, "插在前面", String(anchored.content.content?.[1]?.attrs?.anchorId || "")),
      heading(3, "跳级"),
    ],
  };
  const again = assignHeadingAnchors(renamed, "doc-b");
  const ids = extractOutline(again.content, "doc-b").map((item) => item.anchorId);
  assert.equal(ids[0], "h_aaaabbbbcccc");
  assert.equal(ids[0] === ids[1], false);
  assert.equal(extractOutline(again.content, "doc-b")[2].level, 3);
}

{
  const duplicated = doc([
    heading(1, "同名", "h_111111111111"),
    heading(1, "同名", "h_111111111111"),
  ]);
  const fixed = assignHeadingAnchors(duplicated, "doc-c");
  const again = assignHeadingAnchors(fixed.content, "doc-c");
  const ids = extractOutline(again.content, "doc-c").map((item) => item.anchorId);
  assert.equal(ids[0], "h_111111111111");
  assert.notEqual(ids[1], ids[0]);
  assert.deepEqual(ids, extractOutline(fixed.content, "doc-c").map((item) => item.anchorId));
}

{
  const items = extractOutline(
    assignHeadingAnchors(
      doc([heading(1, "一"), heading(2, "二"), heading(3, "三"), heading(1, "四")]),
      "doc-d",
    ).content,
    "doc-d",
  );
  const hidden = visibleOutlineItems(items, new Set([items[0].anchorId]), 6);
  assert.deepEqual(hidden.map((item) => item.text), ["一", "四"]);
  assert.equal(activeOutlineAnchor(
    items.map((item, index) => ({ anchorId: item.anchorId, top: index * 100 })),
    150,
    false,
  ), items[1].anchorId);
  assert.equal(activeOutlineAnchor(
    items.map((item, index) => ({ anchorId: item.anchorId, top: index * 100 })),
    0,
    true,
  ), items[3].anchorId);
}

{
  const blocks = [];
  for (let index = 0; index < 100; index += 1) {
    blocks.push(heading((index % 6) + 1, `第 ${index + 1} 节 😀`));
  }
  for (let index = 0; index < 40; index += 1) {
    blocks.push({ type: "image", attrs: { src: `/uploads/demo/${index}.png`, alt: "图", width: index === 0 ? 80 : 640, height: index === 0 ? 900 : 360 } });
  }
  const started = Date.now();
  const result = extractOutline(doc(blocks), "long");
  assert.equal(result.length, 100);
  assert.equal(new Set(result.map((item) => item.anchorId)).size, 100);
  assert.ok(Date.now() - started < 1000);
}

console.log("docs-outline tests ok");
