/**
 * 支付渠道与站点公网地址（核心）
 *
 * 职责：
 * 1. 算出当前前台可用哪些支付方式（微信 / 支付宝 / 仅模拟）
 * 2. 规范化站点公网 URL，供微信/支付宝回调地址拼接
 *
 * 改需求时注意：
 * - 「启用开关」在系统设置；「参数是否齐全」才算真正可用
 * - 开发环境没接支付中心、两边都没配齐时，结账页可以走模拟支付
 * - 生产环境，以及接上支付中心之后，关闭、无效、超时或未配置都不能再降级成模拟支付
 */

import { readCenterAccount } from "./pay-center-account";
import { decidePaymentChannels, type PaymentMode } from "./payment-account-lock";
import { getSiteSettings } from "./site-settings";

export type { PaymentMode };

export type PaymentChannels = {
  mode: PaymentMode;
  wechat: boolean;
  alipay: boolean;
  /** true 表示只能点「模拟支付」，用于未配真实收款时调试 */
  mockOnly: boolean;
  /** 两个渠道都不可用，而且不是暂时读失败。这时不能改显示成模拟收款。 */
  closed: boolean;
  /** 支付中心超时或不可达，没有新鲜账户。 */
  unavailable: boolean;
  /** 指定账户无效，没有改用别的商户。 */
  invalid: boolean;
};

/** 环境变量里是否凑齐微信商户必填项（可作为数据库配置的兜底） */
function envWechatReady() {
  return Boolean(
    process.env.WECHAT_APP_ID &&
      process.env.WECHAT_MCH_ID &&
      process.env.WECHAT_API_V3_KEY &&
      process.env.WECHAT_MCH_SERIAL_NO &&
      (process.env.WECHAT_MCH_PRIVATE_KEY || process.env.WECHAT_MCH_PRIVATE_KEY_PATH),
  );
}

/** 环境变量里是否凑齐支付宝必填项 */
function envAlipayReady() {
  return Boolean(
    process.env.ALIPAY_APP_ID &&
      process.env.ALIPAY_PRIVATE_KEY &&
      process.env.ALIPAY_PUBLIC_KEY,
  );
}

function deploymentSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

/**
 * 把后台填写的「站点公网地址」收成干净的 https://域名 形态。
 * 微信 notify_url 对格式很敏感：缺协议、多路径、空白都会导致下单失败。
 */
export function normalizePublicSiteUrl(raw: string | null | undefined): string {
  let value = (raw || "").trim().replace(/[\\\s\u3000]+/g, "");
  if (!value) return deploymentSiteUrl();

  // 有人误把完整回调 URL 填进「站点地址」时，裁回站点根
  value = value.replace(
    /\/api\/payments\/(wechat|alipay)\/notify\/?$/i,
    "",
  );

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, "")}`;
  }

  try {
    const u = new URL(value);
    if (!u.hostname || !u.hostname.includes(".")) {
      return deploymentSiteUrl();
    }
    // 只保留协议 + 主机（+非常规端口），不带业务路径
    const port =
      u.port && u.port !== "80" && u.port !== "443" ? `:${u.port}` : "";
    return `${u.protocol}//${u.hostname.toLowerCase()}${port}`;
  } catch {
    return deploymentSiteUrl();
  }
}

/** 当前站点对外根地址：优先系统设置，其次环境变量，最后默认正式域名 */
export async function getPublicSiteUrl() {
  const settings = await getSiteSettings();
  const fromDb = settings.siteUrl?.trim();
  if (fromDb) return normalizePublicSiteUrl(fromDb);
  return normalizePublicSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "",
  );
}

/**
 * 结账页用的支付通道开关。
 * 没接支付中心时：强制 mock → 设置/env 指定单通道 → auto。
 * 接上之后按该产品的微信、支付宝分别判断，不再因为其中一个无效就两个一起关掉，
 * 也不再在读失败时改成模拟支付。
 */
export async function getPaymentChannels(product = "main"): Promise<PaymentChannels> {
  const origin = (process.env.PAY_CENTER_ORIGIN || "").replace(/\/+$/, "");
  const token = process.env.PAY_CENTER_CONTROL_TOKEN || "";
  const centerConfigured = Boolean(origin && token);
  const [wechatAccount, alipayAccount] = centerConfigured
    ? await Promise.all([
        readCenterAccount(product, "WECHAT"),
        readCenterAccount(product, "ALIPAY"),
      ])
    : [{ kind: "SKIP" as const }, { kind: "SKIP" as const }];
  const settings = await getSiteSettings();
  const wechatReady =
    Boolean(
      settings.wechatAppId &&
        settings.wechatMchId &&
        settings.wechatApiV3Key &&
        settings.wechatMchSerialNo &&
        settings.wechatMchPrivateKey,
    ) || envWechatReady();
  const alipayReady =
    Boolean(
      settings.alipayAppId &&
        settings.alipayPrivateKey &&
        settings.alipayPublicKey,
    ) || envAlipayReady();

  return decidePaymentChannels({
    centerConfigured,
    allowMock: process.env.NODE_ENV !== "production",
    wechat: wechatAccount.kind,
    alipay: alipayAccount.kind,
    local: {
      modeSetting: (settings.paymentMode || "auto").toLowerCase(),
      envMode: (process.env.PAYMENT_MODE || "").toLowerCase(),
      wechatReady,
      alipayReady,
      wechatEnabled: settings.wechatEnabled,
      alipayEnabled: settings.alipayEnabled,
    },
  });
}

/** @deprecated 请改用 getPaymentChannels；仅保留旧代码兼容 */
export async function getPaymentMode(): Promise<PaymentMode> {
  const channels = await getPaymentChannels();
  return channels.mode;
}
