import assert from "node:assert/strict";
import { breadcrumbForDocument, createsTreeCycle, folderTrashPlan, siblingSortOrders } from "./docs-tree";

const nodes = [
  { id: "root", parentId: null, kind: "folder" as const, status: "active" as const },
  { id: "child", parentId: "root", kind: "folder" as const, status: "active" as const },
  { id: "doc", parentId: "child", kind: "document" as const, status: "active" as const },
];

assert.equal(createsTreeCycle(nodes, "root", "child"), true);
assert.equal(createsTreeCycle(nodes, "child", null), false);
assert.deepEqual(siblingSortOrders(["b", "a", "b"]), [
  { id: "b", sortOrder: 0 },
  { id: "a", sortOrder: 1 },
]);

const plan = folderTrashPlan(nodes, "root");
assert.equal(plan?.trashId, "root");
assert.deepEqual(plan?.reparent, [{ id: "child", parentId: null }]);
assert.equal(folderTrashPlan(nodes, "doc"), null);

const crumbs = breadcrumbForDocument({
  spaces: [{ id: "s", name: "演示库" }],
  nodes: [
    {
      id: "f",
      spaceId: "s",
      parentId: null,
      kind: "folder",
      name: "章节",
      documentId: null,
      status: "active",
    },
    {
      id: "n",
      spaceId: "s",
      parentId: "f",
      kind: "document",
      name: "正文",
      documentId: "d1",
      status: "active",
    },
  ],
  documentId: "d1",
  documentTitle: "正文",
});
assert.deepEqual(crumbs.map((item) => item.label), ["颗秒文档", "演示库", "章节", "正文"]);

console.log("docs-tree tests ok");
