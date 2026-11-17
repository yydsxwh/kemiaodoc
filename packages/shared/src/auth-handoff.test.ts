import assert from "node:assert/strict";
import { authHandoffDocument } from "./auth-handoff";

{
  const target =
    "https://account.yydsxwh.com/api/oauth/authorize?client_id=www&redirect_uri=https%3A%2F%2Fwww.yydsxwh.com%2Fcb&scope=openid";
  const doc = authHandoffDocument(target);
  assert.equal(doc.status, 200);
  assert.equal(doc.contentType.includes("text/html"), true);
  assert.equal(doc.cacheControl.includes("no-store"), true);
  assert.equal(doc.body.includes("http-equiv=\"refresh\""), true);
  assert.equal(doc.body.includes(`href="${target.replace(/&/g, "&amp;")}"`), true);
  assert.equal(doc.body.includes("<script"), false);
  assert.equal(doc.body.includes("307"), false);
}

console.log("auth handoff tests passed");
