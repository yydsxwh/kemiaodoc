import assert from "node:assert/strict";
import { SignJWT, decodeJwt } from "jose";
import { ACCOUNT_OIDC_TX_MAX_AGE_SEC, type AccountOidcTransaction } from "./account-oidc";
import { rememberAccountOidcTransaction, readAccountOidcTransactionByState, verifyAccountOidcTransaction, forgetAccountOidcTransaction } from "./account-oidc-cookie";

process.env.AUTH_SECRET = "oidc-cookie-migration-regression-only";
const key = new TextEncoder().encode(process.env.AUTH_SECRET);
const now = Math.floor(Date.now() / 1000);
const tx = (state: string): AccountOidcTransaction => ({ state, nonce: `nonce-${state}`, codeVerifier: `pkce-${state}`, clientKey: "course", mode: "login", returnTo: `/courses/${state}?tab=intro#details` });

async function main() {
  const compact = await new SignJWT({ txs: [
    { ...tx("a"), iat: now - 25 },
    { ...tx("b"), iat: now - 10 },
    { ...tx("expired"), iat: now - ACCOUNT_OIDC_TX_MAX_AGE_SEC - 1 },
  ] }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(now).setExpirationTime(now + ACCOUNT_OIDC_TX_MAX_AGE_SEC).sign(key);
  assert.equal((await readAccountOidcTransactionByState(compact, "a"))?.codeVerifier, "pkce-a");
  assert.equal((await verifyAccountOidcTransaction(compact, "b"))?.returnTo, tx("b").returnTo);
  assert.equal(await readAccountOidcTransactionByState(compact, "expired"), null);

  const migrated = await rememberAccountOidcTransaction(compact, tx("c"));
  for (const state of ["a", "b", "c"]) assert.equal((await readAccountOidcTransactionByState(migrated, state))?.returnTo, tx(state).returnTo);
  const tokenA = migrated.slice(3).split("~").find((token) => decodeJwt(token).state === "a");
  assert.ok(tokenA);
  assert.equal(decodeJwt(tokenA).iat, now - 25);
  assert.equal(decodeJwt(tokenA).exp, now - 25 + ACCOUNT_OIDC_TX_MAX_AGE_SEC);

  const remaining = await forgetAccountOidcTransaction(compact, "a");
  assert.ok(remaining);
  assert.equal(await readAccountOidcTransactionByState(remaining, "a"), null);
  assert.equal((await readAccountOidcTransactionByState(remaining, "b"))?.returnTo, tx("b").returnTo);
  assert.equal(await forgetAccountOidcTransaction(remaining, "b"), null);
  const malformed = compact.slice(0, -2) + "xx";
  assert.equal(await readAccountOidcTransactionByState(malformed, "a"), null);
  console.log("OIDC cookie format migration and original expiry regression passed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
