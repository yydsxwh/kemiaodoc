import assert from "node:assert/strict";
import { emptyDocsContent } from "./docs-content";
import { DEFAULT_DOCS_PAGE_CHROME } from "./docs-page";
import { DEFAULT_DOCS_LIST_SCHEME } from "./docs-scheme";
import {
  createDocsMemorySnapshotStore,
  pickNewerDocsSource,
  readDocsLiveSnapshot,
  writeDocsLiveSnapshot,
} from "./docs-offline";

const store = createDocsMemorySnapshotStore();
const written = writeDocsLiveSnapshot(
  {
    id: "hw-2",
    title: "英语作文",
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "第一段" }] }],
    },
    listScheme: DEFAULT_DOCS_LIST_SCHEME,
    pageChrome: DEFAULT_DOCS_PAGE_CHROME,
    pendingCloud: true,
  },
  store,
);
assert.equal(written.ok, true);
const loaded = readDocsLiveSnapshot("hw-2", store);
assert.equal(loaded?.title, "英语作文");
assert.equal(loaded?.pendingCloud, true);

const remote = {
  id: "hw-2",
  title: "旧稿",
  content: emptyDocsContent(),
  listScheme: DEFAULT_DOCS_LIST_SCHEME,
  pageChrome: DEFAULT_DOCS_PAGE_CHROME,
  updatedAt: "2020-01-01T00:00:00.000Z",
};
assert.equal(pickNewerDocsSource(loaded, remote).title, "英语作文");
assert.equal(readDocsLiveSnapshot("missing", store), null);

console.log("docs-offline tests ok");
