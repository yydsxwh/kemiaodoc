/**
 * OIDC 事务 Cookie：把 state / nonce / PKCE verifier / returnTo 签进主站自己的
 * AUTH_SECRET。这是主站密钥，不是 account 的，也不能发到浏览器 JS。
 */

import { SignJWT, jwtVerify } from "jose";
import { parseAccountClientKey } from "./account-clients";
import {
  ACCOUNT_OIDC_TX_COOKIE,
  ACCOUNT_OIDC_TX_MAX_AGE_SEC,
  oidcTransactionCookieOptions,
  type AccountOidcTransaction,
} from "./account-oidc";
import { safeNextPath } from "./safe-next-path";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export async function signAccountOidcTransaction(
  tx: AccountOidcTransaction,
): Promise<string> {
  return signStoredTransaction(tx, Math.floor(Date.now() / 1000));
}

async function signStoredTransaction(tx: AccountOidcTransaction, issuedAt: number): Promise<string> {
  return new SignJWT({
    state: tx.state,
    nonce: tx.nonce,
    cv: tx.codeVerifier,
    returnTo: safeNextPath(tx.returnTo),
    mode: tx.mode === "register" ? "register" : "login",
    clientKey: tx.clientKey,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ACCOUNT_OIDC_TX_MAX_AGE_SEC)
    .sign(getSecret());
}

/**
 * 同一浏览器的多个标签页会共享这枚 Cookie。只存一笔事务时，后打开的
 * 登录会盖掉先打开的 state / PKCE / 来源页。这里把多笔已签名事务放在
 * 同一枚 HttpOnly Cookie 里，回调只取走对得上的那一笔。
 *
 * 单笔时仍写原来的 JWT，旧回调可以读。两笔及以上才用 v2 容器。
 */
const TX_JAR_PREFIX = "v2.";
const TX_JAR_SEPARATOR = "~";
const TX_JAR_LIMIT = 4;
const TX_JAR_MAX_CHARS = 3200;

function splitOidcTransactionCookie(raw: string | undefined): string[] {
  if (!raw) return [];
  if (raw.startsWith(TX_JAR_PREFIX)) {
    return raw.slice(TX_JAR_PREFIX.length).split(TX_JAR_SEPARATOR).filter(Boolean);
  }
  return [raw];
}

function packOidcTransactionCookie(tokens: string[]): string | null {
  if (tokens.length === 0) return null;
  if (tokens.length === 1) return tokens[0];
  return `${TX_JAR_PREFIX}${tokens.join(TX_JAR_SEPARATOR)}`;
}

async function liveOidcTransactionTokens(raw: string | undefined): Promise<string[]> {
  const kept: string[] = [];
  for (const token of splitOidcTransactionCookie(raw)) {
    for (const stored of await readSignedTransactions(token)) {
      // The return-origin release used one signed JWT containing a txs array.
      // Migrate each live transaction without extending its original lifetime.
      kept.push(stored.compact ? await signStoredTransaction(stored.tx, stored.issuedAt) : token);
    }
  }
  return kept;
}

export async function rememberAccountOidcTransaction(
  raw: string | undefined,
  tx: AccountOidcTransaction,
): Promise<string> {
  const signed = await signAccountOidcTransaction(tx);
  const kept: string[] = [];
  for (const token of await liveOidcTransactionTokens(raw)) {
    const existing = await verifyAccountOidcTransaction(token);
    if (!existing || existing.state === tx.state) continue;
    kept.push(token);
  }
  kept.push(signed);
  while (kept.length > TX_JAR_LIMIT) kept.shift();
  while (kept.length > 1 && (packOidcTransactionCookie(kept)?.length ?? 0) > TX_JAR_MAX_CHARS) {
    kept.shift();
  }
  const packed = packOidcTransactionCookie(kept);
  if (!packed) throw new Error("failed to store oidc transaction");
  return packed;
}

export async function readAccountOidcTransactionByState(
  raw: string | undefined,
  state: string,
): Promise<AccountOidcTransaction | null> {
  if (!state) return null;
  for (const token of splitOidcTransactionCookie(raw)) {
    const found = (await readSignedTransactions(token)).find((item) => item.tx.state === state);
    if (found) return found.tx;
  }
  return null;
}

/** 成功回调后去掉这笔 state。没有剩余事务时返回 null，调用方清掉 Cookie。 */
export async function withoutAccountOidcTransaction(
  raw: string | undefined,
  state: string,
): Promise<string | null> {
  const kept: string[] = [];
  for (const token of await liveOidcTransactionTokens(raw)) {
    const tx = await verifyAccountOidcTransaction(token);
    if (!tx || tx.state === state) continue;
    kept.push(token);
  }
  return packOidcTransactionCookie(kept);
}

export async function verifyAccountOidcTransaction(
  token: string | undefined,
  state?: string,
): Promise<AccountOidcTransaction | null> {
  if (state !== undefined) return readAccountOidcTransactionByState(token, state);
  if (!token || token.startsWith(TX_JAR_PREFIX)) return null;
  const list = await readSignedTransactions(token);
  return list.at(-1)?.tx ?? null;
}

/** Compatibility with the return-origin callback name. */
export const forgetAccountOidcTransaction = withoutAccountOidcTransaction;

async function readSignedTransactions(token: string | undefined): Promise<Array<{
  tx: AccountOidcTransaction;
  issuedAt: number;
  compact: boolean;
}>> {
  if (!token) return [];
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const now = Math.floor(Date.now() / 1000);
    const compact = Array.isArray(payload.txs);
    const rows = compact ? payload.txs as unknown[] : [payload];
    return rows.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Record<string, unknown>;
      const state = String(item.state || "");
      const nonce = String(item.nonce || "");
      const codeVerifier = String(item.cv || item.codeVerifier || "");
      const clientKey = parseAccountClientKey(typeof item.clientKey === "string" ? item.clientKey : "");
      const issuedAt = Number(item.iat || payload.iat || now);
      if (!state || !nonce || !codeVerifier || !clientKey || !Number.isFinite(issuedAt)) return [];
      if (now - issuedAt >= ACCOUNT_OIDC_TX_MAX_AGE_SEC) return [];
      return [{
        tx: {
          state, nonce, codeVerifier, clientKey,
          returnTo: safeNextPath(String(item.returnTo || "/")),
          mode: item.mode === "register" ? "register" as const : "login" as const,
        },
        issuedAt,
        compact,
      }];
    });
  } catch {
    return [];
  }
}

export { ACCOUNT_OIDC_TX_COOKIE, oidcTransactionCookieOptions };

