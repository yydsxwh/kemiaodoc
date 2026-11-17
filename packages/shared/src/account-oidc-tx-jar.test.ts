/**
 * 两个标签页各发起一笔登录时，事务 Cookie 不能只留后一笔。
 * 回调按 state 取走自己的来源页和 PKCE，另一笔还在。
 */

import assert from "node:assert/strict";
import type { AccountOidcTransaction } from "./account-oidc";
import {
  readAccountOidcTransactionByState,
  rememberAccountOidcTransaction,
  verifyAccountOidcTransaction,
  withoutAccountOidcTransaction,
} from "./account-oidc-cookie";

process.env.AUTH_SECRET = "oidc-tx-jar-test-secret";

function tx(partial: Partial<AccountOidcTransaction> & Pick<AccountOidcTransaction, "state" | "returnTo">): AccountOidcTransaction {
  return {
    nonce: `nonce-${partial.state}`,
    codeVerifier: `verifier-${partial.state}`,
    mode: "login",
    clientKey: "www",
    ...partial,
  };
}

const pageA = tx({
  state: "state-a",
  returnTo: "/courses/lesson-a?tab=intro#teachers",
  codeVerifier: "verifier-a",
});
const pageB = tx({
  state: "state-b",
  returnTo: "/forum/post-b?page=2",
  codeVerifier: "verifier-b",
  clientKey: "course",
});

async function main() {
const single = await rememberAccountOidcTransaction(undefined, pageA);
assert.equal(single.includes("~"), false, "只有一笔时仍是原来的 JWT");
assert.equal((await verifyAccountOidcTransaction(single))?.returnTo, pageA.returnTo);
assert.equal((await readAccountOidcTransactionByState(single, pageA.state))?.codeVerifier, "verifier-a");

const both = await rememberAccountOidcTransaction(single, pageB);
assert.ok(both.startsWith("v2."), "两笔事务放进同一个 Cookie");
assert.equal(await verifyAccountOidcTransaction(both), null, "整段容器本身不是一枚 JWT");

const readA = await readAccountOidcTransactionByState(both, "state-a");
const readB = await readAccountOidcTransactionByState(both, "state-b");
assert.equal(readA?.returnTo, pageA.returnTo);
assert.equal(readA?.codeVerifier, "verifier-a");
assert.equal(readA?.clientKey, "www");
assert.equal(readB?.returnTo, pageB.returnTo);
assert.equal(readB?.codeVerifier, "verifier-b");
assert.equal(readB?.clientKey, "course");
assert.equal(await readAccountOidcTransactionByState(both, "missing"), null);

const afterA = await withoutAccountOidcTransaction(both, "state-a");
assert.ok(afterA);
assert.equal(afterA?.startsWith("v2."), false, "剩一笔时回到单枚 JWT");
assert.equal((await readAccountOidcTransactionByState(afterA ?? undefined, "state-b"))?.returnTo, pageB.returnTo);
assert.equal(await readAccountOidcTransactionByState(afterA ?? undefined, "state-a"), null);
assert.equal(await withoutAccountOidcTransaction(afterA ?? undefined, "state-b"), null);

const replaced = await rememberAccountOidcTransaction(both, {
  ...pageA,
  codeVerifier: "verifier-a-2",
  returnTo: "/courses/lesson-a?tab=review",
});
assert.equal((await readAccountOidcTransactionByState(replaced, "state-a"))?.codeVerifier, "verifier-a-2");
assert.equal((await readAccountOidcTransactionByState(replaced, "state-b"))?.codeVerifier, "verifier-b");

let jar: string | undefined;
for (let index = 1; index <= 5; index += 1) {
  jar = await rememberAccountOidcTransaction(
    jar,
    tx({ state: `state-${index}`, returnTo: `/page/${index}` }),
  );
}
assert.equal(await readAccountOidcTransactionByState(jar, "state-1"), null, "超出上限时丢掉最早的一笔");
assert.ok(await readAccountOidcTransactionByState(jar, "state-2"));
assert.equal((await readAccountOidcTransactionByState(jar, "state-5"))?.returnTo, "/page/5");
assert.ok((jar?.length ?? 0) <= 3200);

const evil = await rememberAccountOidcTransaction(undefined, tx({
  state: "state-evil",
  returnTo: "https://evil.example/phish",
}));
assert.equal((await readAccountOidcTransactionByState(evil, "state-evil"))?.returnTo, "/");

console.log("account oidc transaction jar ok");
}

main();
