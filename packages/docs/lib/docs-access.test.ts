import assert from "node:assert/strict";
import {
  documentContainsMediaSrc,
  hashShareToken,
  isShareToken,
  mediaSrcAllowedForReader,
  shareAllowsDocument,
  shareIsActive,
  userOwnsUploadUrl,
  visibleSharedDocumentIds,
  createShareToken,
} from "./docs-access";

const token = createShareToken();
assert.equal(isShareToken(token), true);
assert.equal(hashShareToken(token), hashShareToken(token));
assert.notEqual(hashShareToken(token), hashShareToken(createShareToken()));

const space = {
  scope: "space" as const,
  documentId: null,
  spaceId: "space",
  documentIds: ["a", "c"],
  expiresAt: null,
  revokedAt: null,
};
assert.deepEqual(visibleSharedDocumentIds(space, ["a", "b", "c"]), ["a", "c"]);
assert.equal(shareAllowsDocument(space, "b", ["a", "b", "c"]), false);
assert.equal(shareIsActive({ ...space, revokedAt: new Date().toISOString() }), false);
assert.equal(shareIsActive({ ...space, expiresAt: new Date(Date.now() - 1000).toISOString() }), false);

const single = {
  scope: "document" as const,
  documentId: "a",
  spaceId: null,
  documentIds: ["b"],
  expiresAt: null,
  revokedAt: null,
};
assert.deepEqual(visibleSharedDocumentIds(single, ["a", "b"]), ["a"]);

const content = {
  type: "doc",
  content: [{ type: "image", attrs: { src: "/uploads/user-a/one.png" } }],
};
assert.equal(documentContainsMediaSrc(content, "/uploads/user-a/one.png"), true);
assert.equal(documentContainsMediaSrc(content, "/uploads/user-a/two.png"), false);
assert.equal(userOwnsUploadUrl("cm1234567890abcd", "/uploads/cm1234567890abcd/a.png"), true);
assert.equal(userOwnsUploadUrl("cm1234567890abcd", "/uploads/other-user/a.png"), false);
assert.equal(mediaSrcAllowedForReader({
  src: "https://cdn.example/secret.png",
  userId: "cm1234567890abcd",
  contents: [],
}), false);
assert.equal(mediaSrcAllowedForReader({
  src: "https://cdn.example/secret.png",
  contents: [{ type: "image", attrs: { src: "https://cdn.example/secret.png" } }],
}), true);

console.log("docs-access tests ok");
