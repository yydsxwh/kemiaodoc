/**
 * GET /api/auth/account/start?mode=login|register&next=/path&client=www|course
 *
 * 发起前确定本次产品客户端。client 只接受白名单；缺省时按 next 识别网课资料。
 * 选定结果写入签名事务，回调不再相信 URL 上的 client。
 */

import { NextResponse } from "next/server";
import {
  ACCOUNT_LOGIN_INVALID_CLIENT_MESSAGE,
  ACCOUNT_LOGIN_UNCONFIGURED_MESSAGE,
  accountClientKeyForReturnTo,
  resolveAccountClientSelection,
  type AccountClientKey,
} from "@andyyyds/shared/account-clients";
import {
  buildAccountRegisterUrl,
  buildAuthorizeUrl,
  createOidcRandoms,
  readAccountClientConfig,
  resolveCanonicalAuthStartUrl,
  resolveAccountRedirectUri,
} from "@andyyyds/shared/account-oidc";
import {
  ACCOUNT_OIDC_TX_COOKIE,
  oidcTransactionCookieOptions,
  signAccountOidcTransaction,
} from "@andyyyds/shared/account-oidc-cookie";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";
import { getRequestPublicOrigin } from "@andyyyds/shared/request-origin";
import { safeNextPath } from "@andyyyds/shared/safe-next-path";

export const dynamic = "force-dynamic";

function redirectToLogin(input: {
  origin: string;
  mode: "login" | "register";
  returnTo: string;
  error?: string;
  client?: AccountClientKey;
  ref?: string;
}) {
  const path = input.mode === "register" ? "/register" : "/login";
  const dest = new URL(path, input.origin);
  const next = safeNextPath(input.returnTo);
  if (next !== "/") dest.searchParams.set("next", next);
  if (input.client) dest.searchParams.set("client", input.client);
  if (input.ref) dest.searchParams.set("ref", input.ref);
  if (input.error) dest.searchParams.set("error", input.error);
  const res = NextResponse.redirect(dest);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "register" ? "register" : "login";
  const returnTo = safeNextPath(url.searchParams.get("next"));
  const referralCode = (url.searchParams.get("ref") || "").trim().slice(0, 32);
  const origin = getRequestPublicOrigin(req) || url.origin;
  const selection = resolveAccountClientSelection({
    explicit: url.searchParams.get("client"),
    returnTo,
  });

  if (!selection.ok) {
    return redirectToLogin({
      origin,
      mode,
      returnTo,
      error: ACCOUNT_LOGIN_INVALID_CLIENT_MESSAGE,
      client: accountClientKeyForReturnTo(returnTo),
    });
  }

  const loaded = readAccountClientConfig(selection.key);
  if (!loaded.ok) {
    if (selection.key === "www") {
      return redirectToLogin({
        origin,
        mode,
        returnTo,
        ref: referralCode,
      });
    }
    console.error(
      `[auth/account/start] missing account client config: ${loaded.missing.join(", ")}`,
    );
    return redirectToLogin({
      origin,
      mode,
      returnTo,
      error: ACCOUNT_LOGIN_UNCONFIGURED_MESSAGE,
      client: "course",
      ref: referralCode,
    });
  }

  const publicSiteUrl = await getPublicSiteUrl();
  const requestPublicOrigin = getRequestPublicOrigin(req) || url.origin;
  const redirectUri = resolveAccountRedirectUri({
    envRedirectUri: loaded.config.redirectUri,
    requestOrigin: requestPublicOrigin,
    publicSiteUrl,
  });
  const canonicalStartUrl = resolveCanonicalAuthStartUrl({
    requestUrl: url.toString(),
    requestPublicOrigin,
    redirectUri,
  });
  if (canonicalStartUrl) {
    const res = NextResponse.redirect(canonicalStartUrl, { status: 307 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const config = { ...loaded.config, redirectUri };
  const randoms = createOidcRandoms();
  const authorize = buildAuthorizeUrl(config, {
    state: randoms.state,
    nonce: randoms.nonce,
    codeVerifier: randoms.verifier,
    codeChallenge: randoms.challenge,
  });
  const dest =
    mode === "register"
      ? buildAccountRegisterUrl(authorize, referralCode)
      : authorize;

  const token = await signAccountOidcTransaction({
    state: randoms.state,
    nonce: randoms.nonce,
    codeVerifier: randoms.verifier,
    returnTo,
    mode,
    clientKey: selection.key,
  });

  const res = NextResponse.redirect(dest.toString());
  res.cookies.set(
    ACCOUNT_OIDC_TX_COOKIE,
    token,
    oidcTransactionCookieOptions(),
  );
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
