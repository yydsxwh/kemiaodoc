/**
 * 隔离的 SQLite。不连接生产库，不打印分享凭证。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dir = mkdtempSync(path.join(path.resolve(tmpdir()), "docs-wiki-"));
const databaseFile = path.join(dir, "test.db");
writeFileSync(databaseFile, "", { flag: "wx" });
const databaseUrl = "file:" + databaseFile.split(path.sep).join("/");
process.env.DATABASE_URL = databaseUrl;
execFileSync(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"], {
  cwd: root,
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "pipe",
});

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const store = await import("./docs-store");
  const wiki = await import("./docs-wiki-store");
  const shares = await import("./docs-share-store");
  const owner = await db.user.create({
    data: { name: "作者", email: "docs-owner@example.test", passwordHash: "x", referralCode: "docs-owner" },
  });
  const other = await db.user.create({
    data: { name: "别人", email: "docs-other@example.test", passwordHash: "x", referralCode: "docs-other" },
  });
  const long = storeCreateContent();
  const article = await store.createDocsDocument(owner.id, {
    title: "颗秒文档功能演示",
    content: long,
  });
  const privateDoc = await store.createDocsDocument(owner.id, {
    title: "不要分享",
    content: { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "私有标题" }] }, { type: "paragraph", content: [{ type: "text", text: "私有正文机密词" }] }] },
  });
  const third = await store.createDocsDocument(owner.id, { title: "第二篇" });
  const outsider = await store.createDocsDocument(other.id, { title: "别人的文档" });

  const reloaded = await store.getDocsDocument(owner.id, article.id);
  const firstAnchor = reloaded.content.content?.find((node) => node.type === "heading")?.attrs?.anchorId;
  assert.equal(typeof firstAnchor, "string");
  const renamed = structuredClone(reloaded.content);
  const heading = renamed.content?.find((node) => node.type === "heading");
  if (heading?.content?.[0]) heading.content[0].text = "改过的标题";
  const saved = await store.updateDocsDocument(owner.id, article.id, {
    content: renamed,
    baseUpdatedAt: reloaded.updatedAt,
  });
  assert.equal(saved.content.content?.find((node) => node.attrs?.anchorId === firstAnchor)?.content?.[0]?.text, "改过的标题");
  await assert.rejects(
    () => store.updateDocsDocument(owner.id, article.id, { title: "旧写入", baseUpdatedAt: reloaded.updatedAt }),
    (error: unknown) => error instanceof store.DocsConflictError,
  );
  const afterConflict = await store.getDocsDocument(owner.id, article.id);
  assert.equal(afterConflict.title, "颗秒文档功能演示");

  const library = await wiki.applyDocsWikiAction(owner.id, { action: "createSpace", name: "演示库" });
  const spaceId = library.spaces[0].id;
  await wiki.applyDocsWikiAction(owner.id, { action: "createFolder", spaceId, name: "一层" });
  let current = await wiki.getDocsLibrary(owner.id);
  const folder = current.nodes.find((node) => node.name === "一层");
  assert.ok(folder);
  await wiki.applyDocsWikiAction(owner.id, { action: "createFolder", spaceId, parentId: folder.id, name: "二层" });
  current = await wiki.getDocsLibrary(owner.id);
  const nested = current.nodes.find((node) => node.name === "二层");
  assert.ok(nested);
  await assert.rejects(
    () => wiki.applyDocsWikiAction(owner.id, { action: "moveNode", nodeId: folder.id, parentId: nested.id }),
    (error: unknown) => error instanceof wiki.DocsWikiError,
  );
  await wiki.applyDocsWikiAction(owner.id, {
    action: "placeDocument",
    documentId: article.id,
    spaceId,
    parentId: nested.id,
  });
  await wiki.applyDocsWikiAction(owner.id, {
    action: "placeDocument",
    documentId: third.id,
    spaceId,
    parentId: folder.id,
  });
  await wiki.applyDocsWikiAction(owner.id, { action: "trashFolder", nodeId: folder.id });
  current = await wiki.getDocsLibrary(owner.id);
  assert.equal(current.nodes.find((node) => node.id === folder.id)?.status, "trashed");
  assert.equal(current.documents.find((doc) => doc.id === article.id)?.title, "颗秒文档功能演示");
  assert.equal(await db.docsDocument.count({ where: { userId: owner.id } }), 3);

  await wiki.addDocumentTag(owner.id, article.id, "演示");
  await wiki.addDocumentTag(owner.id, privateDoc.id, "机密");
  const found = await wiki.searchOwnedDocs(owner.id, "改过的标题");
  assert.equal(found.some((hit) => hit.documentId === article.id), true);
  assert.equal(found.some((hit) => hit.documentId === outsider.id), false);
  const secret = await wiki.searchOwnedDocs(other.id, "机密");
  assert.equal(secret.length, 0);

  const docShare = await shares.openDocsShare(owner.id, { scope: "document", documentId: article.id });
  const publicDoc = await shares.readPublicDocs(docShare.token);
  assert.equal(publicDoc.document?.id, article.id);
  assert.equal(publicDoc.documents.some((item) => item.id === privateDoc.id), false);
  await assert.rejects(() => shares.readPublicDocs(docShare.token, privateDoc.id), shares.DocsShareClosedError);
  const publicSearch = await shares.searchPublicDocs(docShare.token, "机密");
  assert.equal(publicSearch.length, 0);

  const spaceShare = await shares.openDocsShare(owner.id, {
    scope: "space",
    spaceId,
    documentIds: [article.id, privateDoc.id, third.id],
  });
  const publicSpace = await shares.readPublicDocs(spaceShare.token);
  const visible = new Set(publicSpace.documents.map((item) => item.id));
  assert.equal(visible.has(privateDoc.id), false);
  assert.equal(publicSpace.breadcrumb.some((crumb) => crumb.label.includes("私有")), false);

  await shares.updateDocsShare(owner.id, docShare.id, { action: "revoke" });
  await assert.rejects(() => shares.readPublicDocs(docShare.token), shares.DocsShareClosedError);
  await assert.rejects(
    () => wiki.applyDocsWikiAction(other.id, { action: "renameSpace", spaceId, name: "越权" }),
    (error: unknown) => error instanceof wiki.DocsWikiError,
  );

  console.log("docs-wiki integration ok");
  await db.$disconnect();
}

function storeCreateContent() {
  const content = [];
  for (let index = 0; index < 12; index += 1) {
    content.push({
      type: "heading",
      attrs: { level: (index % 3) + 1 },
      content: [{ type: "text", text: index === 0 ? "原标题" : `标题 ${index} 😀` }],
    });
    content.push({
      type: "paragraph",
      content: [{ type: "text", text: "正文" }],
    });
  }
  content.push({
    type: "image",
    attrs: { src: "/uploads/demo/tall.png", alt: "细长", width: 80, height: 640 },
  });
  return { type: "doc" as const, content };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
