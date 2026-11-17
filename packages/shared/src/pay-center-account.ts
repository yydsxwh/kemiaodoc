/**
 * 主站服务端读取支付中心的同一份账户。
 * 浏览器拿不到商户私钥。支付中心没配管理口令时，调用方继续用主站原配置。
 */

export const PAY_PRODUCTS = ["main", "shop", "course", "material", "mathcode"] as const;

export function productKeyFromType(productType: string | null | undefined): (typeof PAY_PRODUCTS)[number] {
  const value = (productType || "").toUpperCase();
  if (value.includes("MATH")) return "mathcode";
  if (value.includes("DOC") || value.includes("MATERIAL") || value.includes("FILE")) return "material";
  if (value.includes("PRODUCT") || value.includes("MALL") || value.includes("SHOP") || value.includes("GOOD")) return "shop";
  return "course";
}

type CenterBody = {
  state: "OFF" | "INVALID" | "UNCONFIGURED" | "READY";
  profileId?: string;
  version?: number;
  provider?: string;
  merchantId?: string;
  historical?: boolean;
  gatewayMode?: string;
  public?: { appId?: string; mchId?: string; serialNo?: string; platformSerialNo?: string; gatewayMode?: string; sellerId?: string };
  secrets?: {
    apiV3Key?: string;
    privateKeyPem?: string;
    platformPublicKeyPem?: string;
    appSecret?: string;
    alipayPublicKeyPem?: string;
  };
};

export type CenterAccount =
  | { kind: "SKIP" }
  | { kind: "UNCONFIGURED" }
  | { kind: "OFF" }
  | { kind: "INVALID" }
  | { kind: "UNAVAILABLE" }
  | { kind: "READY"; profileId: string; version: number; provider?: "WECHAT" | "ALIPAY"; body: CenterBody };

export type CallbackAccount = {
  profileId: string;
  provider: "WECHAT" | "ALIPAY";
  merchantId: string;
  historical: boolean;
  appId: string;
  mchId: string;
  serialNo: string;
  apiV3Key: string;
  privateKeyPem: string;
  platformPublicKeyPem: string;
  alipayPublicKeyPem: string;
  gatewayMode: string;
};

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; account: CenterAccount }>();
const profileCache = new Map<string, { at: number; account: CenterAccount }>();
const callbackCache = new Map<string, { at: number; accounts: CallbackAccount[] }>();

/** 测试可以把时钟往前拨，用来检查缓存过期后不再沿用旧账户。 */
export const payCenterClock = { now: () => Date.now() };

export function resetPayCenterAccountCache(): void {
  cache.clear();
  profileCache.clear();
  callbackCache.clear();
  payCenterClock.now = () => Date.now();
}

function timeoutMs() {
  const raw = Number(process.env.PAY_CENTER_TIMEOUT_MS || 2500);
  return Number.isFinite(raw) && raw > 0 ? raw : 2500;
}

function freshCache(saved: { at: number; account: CenterAccount } | undefined): CenterAccount | null {
  if (!saved) return null;
  if (payCenterClock.now() - saved.at >= CACHE_MS) return null;
  if (saved.account.kind === "READY" || saved.account.kind === "OFF" || saved.account.kind === "INVALID") {
    return saved.account;
  }
  return null;
}

export async function readCenterAccount(product: string, provider: "WECHAT" | "ALIPAY"): Promise<CenterAccount> {
  const origin = (process.env.PAY_CENTER_ORIGIN || "").replace(/\/+$/, "");
  const token = process.env.PAY_CENTER_CONTROL_TOKEN || "";
  if (!origin || !token) return { kind: "SKIP" };
  const key = `${product}:${provider}`;
  try {
    const response = await fetch(
      `${origin}/pay/internal/runtime?product=${encodeURIComponent(product)}&provider=${provider}`,
      { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeoutMs()) },
    );
    if (!response.ok) throw new Error("pay center status");
    const body = (await response.json()) as CenterBody;
    const account = mapBody(body);
    cache.set(key, { at: payCenterClock.now(), account });
    return account;
  } catch {
    return freshCache(cache.get(key)) ?? { kind: "UNAVAILABLE" };
  }
}

/** 已锁定的历史账户。停用后仍要能查单和验签，读不到就不要改用当前商户。 */
export async function readCenterProfile(profileId: string): Promise<CenterAccount> {
  const origin = centerOrigin();
  const token = process.env.PAY_CENTER_CONTROL_TOKEN || "";
  if (!origin || !token || !profileId) return { kind: "UNAVAILABLE" };
  try {
    const response = await fetch(`${origin}/pay/internal/profiles/${encodeURIComponent(profileId)}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs()),
    });
    if (response.status === 404) return { kind: "INVALID" };
    if (!response.ok) return { kind: "UNAVAILABLE" };
    const account = mapBody((await response.json()) as CenterBody);
    if (account.kind === "READY") profileCache.set(profileId, { at: payCenterClock.now(), account });
    return account;
  } catch {
    return freshCache(profileCache.get(profileId)) ?? { kind: "UNAVAILABLE" };
  }
}

/** 回调可能属于旧版本。支付中心短暂不可达时沿用刚才读到的原账户，过期后不再猜别的密钥。 */
export async function readCallbackAccounts(provider: "WECHAT" | "ALIPAY"): Promise<CallbackAccount[]> {
  const origin = centerOrigin();
  const token = process.env.PAY_CENTER_CONTROL_TOKEN || "";
  if (!origin || !token) return [];
  try {
    const response = await fetch(`${origin}/pay/internal/callback-accounts?provider=${provider}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs()),
    });
    if (!response.ok) return cachedCallbacks(provider);
    const body = (await response.json()) as { accounts?: CenterBody[] };
    const accounts = (body.accounts || []).map((item) => ({
      profileId: item.profileId || "",
      provider,
      merchantId: item.merchantId || item.public?.mchId || item.public?.appId || "",
      historical: Boolean(item.historical),
      appId: item.public?.appId || "",
      mchId: item.public?.mchId || "",
      serialNo: item.public?.serialNo || "",
      apiV3Key: item.secrets?.apiV3Key || "",
      privateKeyPem: item.secrets?.privateKeyPem || "",
      platformPublicKeyPem: item.secrets?.platformPublicKeyPem || "",
      alipayPublicKeyPem: item.secrets?.alipayPublicKeyPem || "",
      gatewayMode: item.public?.gatewayMode || item.gatewayMode || "production",
    }));
    callbackCache.set(provider, { at: payCenterClock.now(), accounts });
    return accounts;
  } catch {
    return cachedCallbacks(provider);
  }
}

function cachedCallbacks(provider: string): CallbackAccount[] {
  const saved = callbackCache.get(provider);
  if (!saved || payCenterClock.now() - saved.at >= CACHE_MS) return [];
  return saved.accounts;
}

function centerOrigin() {
  return (process.env.PAY_CENTER_ORIGIN || "").replace(/\/+$/, "");
}

function mapBody(body: CenterBody): CenterAccount {
  if (body.state === "READY") {
    const provider = body.provider === "ALIPAY" ? "ALIPAY" : body.provider === "WECHAT" ? "WECHAT" : undefined;
    return { kind: "READY", profileId: body.profileId || "", version: body.version || 0, provider, body };
  }
  if (body.state === "OFF" || body.state === "INVALID" || body.state === "UNCONFIGURED") return { kind: body.state };
  return { kind: "UNAVAILABLE" };
}

/** 给后台页面看的生效账户。不含私钥、APIv3 密钥或应用密钥。 */
export function publicChannelState(account: CenterAccount): {
  state: string;
  profileId: string;
  version: number;
  merchantId: string;
} {
  if (account.kind !== "READY") {
    return { state: account.kind, profileId: "", version: 0, merchantId: "" };
  }
  const pub = account.body.public || {};
  return {
    state: "READY",
    profileId: account.profileId,
    version: account.version,
    merchantId: account.body.merchantId || pub.mchId || pub.appId || "",
  };
}

export async function pushChannelToCenter(input: {
  provider: "WECHAT" | "ALIPAY";
  publicConfig: Record<string, unknown>;
  secrets: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; skipped: true } | { ok: false; error: string }> {
  const origin = (process.env.PAY_CENTER_ORIGIN || "").replace(/\/+$/, "");
  const token = process.env.PAY_CENTER_CONTROL_TOKEN || "";
  if (!origin || !token) return { ok: false, skipped: true };
  try {
    const response = await fetch(`${origin}/pay/internal/channels`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(Math.max(timeoutMs(), 8000)),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error || "支付中心没有保存渠道" };
    }
    resetPayCenterAccountCache();
    return { ok: true };
  } catch {
    return { ok: false, error: "支付中心暂时不可用，渠道没有保存" };
  }
}
