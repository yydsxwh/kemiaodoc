/**
 * 站长进入支付后台的判断，以及把主站已有微信资料整理成支付中心能保存的形状。
 * 不读取显示名做授权。网络调用只发生在显式传入的地址和凭证上。
 */

export type PayEntryDecision = "login" | "forbidden" | "enter";

export function decidePayEntry(input: { loggedIn: boolean; admin: boolean }): PayEntryDecision {
  if (!input.loggedIn) return "login";
  if (!input.admin) return "forbidden";
  return "enter";
}

export function roleTokens(role: string, roles: string): string[] {
  return [role, ...roles.split(",")].map((item) => item.trim()).filter(Boolean);
}

/**
 * 只有唯一一个已经挂上账号中心的站长可以首次绑定。
 * 没有 accountSub 的历史管理员不能借这次交接变成支付超级管理员。
 */
export function allowFirstOwnerBind(input: {
  sessionHasAccountSub: boolean;
  linkedAdminCount: number;
  isTheLinkedAdmin: boolean;
}): boolean {
  return input.sessionHasAccountSub && input.linkedAdminCount === 1 && input.isTheLinkedAdmin;
}

export type WechatSiteFields = {
  appId: string;
  mchId: string;
  serialNo: string;
  apiV3Key: string;
  privateKeyPem: string;
  appSecret: string;
};

export type WechatCopyPlan = {
  canSave: boolean;
  missing: string[];
  publicConfig?: Record<string, unknown>;
  secrets?: Record<string, string>;
};

/** 主站旧配置没有微信支付公钥。能保存的先保存，缺的字段留给渠道页补。 */
export function wechatCopyPlan(fields: WechatSiteFields): WechatCopyPlan {
  const missing: string[] = [];
  if (!fields.appId.trim()) missing.push("AppID");
  if (!fields.mchId.trim()) missing.push("商户号");
  if (!fields.serialNo.trim()) missing.push("商户证书序列号");
  if (fields.apiV3Key.trim().length !== 32) missing.push("APIv3 密钥");
  if (!fields.privateKeyPem.trim()) missing.push("商户私钥");
  const later = ["微信支付公钥", "微信支付公钥 ID"];
  if (missing.length > 0) return { canSave: false, missing: [...missing, ...later] };
  const secrets: Record<string, string> = {
    apiV3Key: fields.apiV3Key.trim(),
    privateKeyPem: fields.privateKeyPem.trim(),
  };
  if (fields.appSecret.trim()) secrets.appSecret = fields.appSecret.trim();
  return {
    canSave: true,
    missing: later,
    publicConfig: {
      appId: fields.appId.trim(),
      mchId: fields.mchId.trim(),
      serialNo: fields.serialNo.trim(),
      methods: ["NATIVE"],
      source: "site-settings",
    },
    secrets,
  };
}

type FetchLike = typeof fetch;

function payCenterTarget(): { origin: string; token: string } | null {
  const origin = (process.env.PAY_CENTER_ORIGIN || "").replace(/\/+$/, "");
  const token = process.env.PAY_CENTER_CONTROL_TOKEN || "";
  if (!origin || !token) return null;
  return { origin, token };
}

export async function copyWechatIfAbsent(plan: WechatCopyPlan, fetchImpl: FetchLike = fetch): Promise<"saved" | "present" | "skipped" | "failed"> {
  const target = payCenterTarget();
  if (!target || !plan.canSave || !plan.publicConfig || !plan.secrets) return "skipped";
  try {
    const listed = await fetchImpl(`${target.origin}/pay/internal/callback-accounts?provider=WECHAT`, {
      headers: { authorization: `Bearer ${target.token}` },
      signal: AbortSignal.timeout(2500),
    });
    if (!listed.ok) return "failed";
    const body = await listed.json() as { accounts?: unknown[] };
    if ((body.accounts || []).length > 0) return "present";
    const saved = await fetchImpl(`${target.origin}/pay/internal/channels`, {
      method: "PUT",
      headers: { authorization: `Bearer ${target.token}`, "content-type": "application/json" },
      body: JSON.stringify({ provider: "WECHAT", publicConfig: plan.publicConfig, secrets: plan.secrets }),
      signal: AbortSignal.timeout(8000),
    });
    return saved.ok ? "saved" : "failed";
  } catch {
    return "failed";
  }
}

export async function requestOwnerHandoff(input: {
  accountSub: string;
  mainUserId: string;
  displayName: string;
  allowCreate: boolean;
}, fetchImpl: FetchLike = fetch): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const target = payCenterTarget();
  if (!target) return { ok: false, error: "支付后台还没接上，请稍后再试" };
  try {
    const response = await fetchImpl(`${target.origin}/pay/internal/owner-handoff`, {
      method: "POST",
      headers: { authorization: `Bearer ${target.token}`, "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(8000),
    });
    const body = await response.json().catch(() => null) as { code?: string; error?: string } | null;
    if (!response.ok || !body?.code) return { ok: false, error: body?.error || "暂时不能进入支付后台" };
    return { ok: true, code: body.code };
  } catch {
    return { ok: false, error: "支付后台暂时不可用" };
  }
}

export async function revokeOwnerPaySessions(input: { accountSub: string; mainUserId: string }, fetchImpl: FetchLike = fetch): Promise<void> {
  const target = payCenterTarget();
  if (!target) return;
  await fetchImpl(`${target.origin}/pay/internal/owner-revoke`, {
    method: "POST",
    headers: { authorization: `Bearer ${target.token}`, "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(1500),
  });
}

