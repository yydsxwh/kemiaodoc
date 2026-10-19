/**
 * GET /api/auth/callback
 * account OIDC Authorization Code 回调。校验 state / nonce / PKCE 后，
 * 用签名事务里的 clientKey 选择 Client ID / Secret，再按 sub=usr_xxx
 * 挂钩本地业务用户并建立主站自己的 Session。
 *
 * 不读取 URL 上的 client。course 登录不能在这里退回 www 的密钥。
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCOUNT_LOGIN_UNCONFIGURED_MESSAGE,
  type AccountClientKey,
} from "@andyyyds/shared/account-clients";
import { upsertLocalUserFromAccount } from "@andyyyds/shared/account-identity";
import {
  accountIdTokenAudience,
  exchangeAuthorizationCode,
  readAccountClientConfig,
  readAccountIdClaims,
  resolveAccountRedirectUri,
  verifyAccountIdToken,
} from "@andyyyds/shared/account-oidc";
import {
  ACCOUNT_OIDC_TX_COOKIE,
  oidcTransactionCookieOptions,
  verifyAccountOidcTransaction,
} from "@andyyyds/shared/account-oidc-cookie";
import { createSession } from "@andyyyds/shared/auth";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";
import { getRequestPublicOrigin } from "@andyyyds/shared/request-origin";
import { safeNextPath } from "@andyyyds/shared/safe-next-path";
import type { Role } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

function failRedirect(
  origin: string,
  message: string,
  returnTo = "/",
  clientKey?: AccountClientKey,
) {
  const dest = new URL("/login", origin);
  dest.searchParams.set("error", message);
  const next = safeNextPath(returnTo);
  if (next !== "/") dest.searchParams.set("next", next);
  if (clientKey) dest.searchParams.set("client", clientKey);
  return NextResponse.redirect(dest);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin =
    getRequestPublicOrigin(req) || (await getPublicSiteUrl()) || url.origin;

  const code = (url.searchParams.get("code") || "").trim();
  const state = (url.searchParams.get("state") || "").trim();
  const oauthError = (url.searchParams.get("error") || "").trim();
  if (oauthError) {
    return failRedirect(origin, "账号中心拒绝了登录");
  }

  const jar = await cookies();
  const tx = await verifyAccountOidcTransaction(
    jar.get(ACCOUNT_OIDC_TX_COOKIE)?.value,
  );
  if (!tx || !code || !state || tx.state !== state) {
    return failRedirect(origin, "登录已过期，请重试");
  }

  const loaded = readAccountClientConfig(tx.clientKey);
  if (!loaded.ok) {
    console.error(
      `[auth/callback] missing account client config: ${loaded.missing.join(", ")}`,
    );
    return failRedirect(
      origin,
      ACCOUNT_LOGIN_UNCONFIGURED_MESSAGE,
      tx.returnTo,
      tx.clientKey,
    );
  }

  const redirectUri = resolveAccountRedirectUri({
    envRedirectUri: loaded.config.redirectUri,
    requestOrigin: origin,
    publicSiteUrl: await getPublicSiteUrl(),
  });
  const config = { ...loaded.config, redirectUri };

  try {
    const tokens = await exchangeAuthorizationCode({
      config,
      code,
      codeVerifier: tx.codeVerifier,
    });
    const payload = await verifyAccountIdToken({
      token: tokens.idToken,
      issuer: config.issuer,
      audience: accountIdTokenAudience(config),
      nonce: tx.nonce,
    });
    const claims = readAccountIdClaims(payload);
    if (!claims) {
      return failRedirect(origin, "账号中心未返回有效身份", tx.returnTo, tx.clientKey);
    }

    const user = await upsertLocalUserFromAccount(claims);
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });
  } catch (error) {
    console.error("[auth/callback]", error);
    return failRedirect(origin, "登录失败，请重试", tx.returnTo, tx.clientKey);
  }

  const res = NextResponse.redirect(new URL(safeNextPath(tx.returnTo), origin));
  res.cookies.set(ACCOUNT_OIDC_TX_COOKIE, "", {
    ...oidcTransactionCookieOptions(0),
    maxAge: 0,
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
