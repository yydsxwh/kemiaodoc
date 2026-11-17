/**
 * 结账渠道和已发起订单的账户选择。
 * 支付中心接上之后，缺渠道不能再降级成模拟支付。
 * 已经发出去的付款单继续用当时的商户，不跟随后来的账户切换。
 */

export type AccountKind = "SKIP" | "READY" | "OFF" | "INVALID" | "UNAVAILABLE" | "UNCONFIGURED";

export type PaymentMode = "mock" | "wechat" | "alipay" | "both";

export type ChannelDecision = {
  mode: PaymentMode;
  wechat: boolean;
  alipay: boolean;
  mockOnly: boolean;
  closed: boolean;
  unavailable: boolean;
  invalid: boolean;
};

export type LocalChannelInput = {
  modeSetting: string;
  envMode: string;
  wechatReady: boolean;
  alipayReady: boolean;
  wechatEnabled: boolean;
  alipayEnabled: boolean;
};

const NONE: Pick<ChannelDecision, "closed" | "unavailable" | "invalid"> = {
  closed: false,
  unavailable: false,
  invalid: false,
};

export function decidePaymentChannels(input: {
  centerConfigured: boolean;
  /** 生产环境必须传 false。未配置、关闭、无效或超时都不能改成模拟收款。 */
  allowMock?: boolean;
  wechat: AccountKind;
  alipay: AccountKind;
  local: LocalChannelInput;
}): ChannelDecision {
  const allowMock = input.allowMock !== false;
  if (!input.centerConfigured) {
    const local = decideLocalChannels(input.local);
    if (!allowMock && local.mockOnly) {
      return {
        mode: "mock",
        wechat: false,
        alipay: false,
        mockOnly: false,
        closed: true,
        unavailable: false,
        invalid: false,
      };
    }
    return local;
  }
  const local = decideLocalChannels(input.local);
  // 中心还没有这个渠道时，沿用主站已经配好的真实商户。关闭、无效和超时不改去别的商户，也不改成模拟。
  const wechat = input.wechat === "READY" || (input.wechat === "UNCONFIGURED" && local.wechat);
  const alipay = input.alipay === "READY" || (input.alipay === "UNCONFIGURED" && local.alipay);
  if (wechat && alipay) return { mode: "both", wechat: true, alipay: true, mockOnly: false, ...NONE };
  if (wechat) return { mode: "wechat", wechat: true, alipay: false, mockOnly: false, ...NONE };
  if (alipay) return { mode: "alipay", wechat: false, alipay: true, mockOnly: false, ...NONE };
  const kinds = [input.wechat, input.alipay];
  const unavailable = kinds.every((kind) => kind === "UNAVAILABLE" || kind === "SKIP");
  const invalid = kinds.some((kind) => kind === "INVALID");
  const closed = !unavailable && (invalid || kinds.some((kind) => kind === "OFF" || kind === "UNCONFIGURED"));
  return {
    mode: "mock",
    wechat: false,
    alipay: false,
    mockOnly: false,
    closed,
    unavailable,
    invalid,
  };
}

function decideLocalChannels(local: LocalChannelInput): ChannelDecision {
  if (local.modeSetting === "mock" || local.envMode === "mock") {
    return { mode: "mock", wechat: false, alipay: false, mockOnly: true, ...NONE };
  }
  let wechat = local.wechatEnabled && local.wechatReady;
  let alipay = local.alipayEnabled && local.alipayReady;
  if (local.modeSetting === "wechat" || local.envMode === "wechat") {
    wechat = local.wechatReady;
    alipay = false;
  } else if (local.modeSetting === "alipay" || local.envMode === "alipay") {
    wechat = false;
    alipay = local.alipayReady;
  } else if (local.modeSetting === "both") {
    wechat = local.wechatReady && local.wechatEnabled;
    alipay = local.alipayReady && local.alipayEnabled;
  }
  if (!wechat && !alipay) {
    return { mode: "mock", wechat: false, alipay: false, mockOnly: true, ...NONE };
  }
  if (wechat && alipay) return { mode: "both", wechat: true, alipay: true, mockOnly: false, ...NONE };
  if (wechat) return { mode: "wechat", wechat: true, alipay: false, mockOnly: false, ...NONE };
  return { mode: "alipay", wechat: false, alipay: true, mockOnly: false, ...NONE };
}

export type StartedOrder = {
  payProfileId: string;
  payMerchantId: string;
  payChannel: string;
};

export type AccountChoice =
  | { kind: "current" }
  | { kind: "legacy" }
  | { kind: "locked"; profileId: string; merchantId: string }
  | { kind: "merchant"; merchantId: string };

/** 这个渠道已经发起过付款时，不再读取当前绑定。 */
export function orderAccountChoice(order: StartedOrder, provider: "WECHAT" | "ALIPAY"): AccountChoice {
  if (!order.payChannel.startsWith(provider)) return { kind: "current" };
  if (order.payProfileId) {
    return { kind: "locked", profileId: order.payProfileId, merchantId: order.payMerchantId };
  }
  if (order.payMerchantId) return { kind: "merchant", merchantId: order.payMerchantId };
  return { kind: "legacy" };
}

export type AccountLoad = {
  legacy?: boolean;
  profileId?: string;
  merchantId?: string;
  appId?: string;
};

export type AttemptIdentity = {
  profileId: string;
  profileVersion: number;
  merchantId: string;
  appId: string;
};

function loadFromAttempt(attempt: AttemptIdentity): AccountLoad {
  if (attempt.profileId) {
    return { profileId: attempt.profileId, merchantId: attempt.merchantId, appId: attempt.appId };
  }
  if (attempt.merchantId) return { merchantId: attempt.merchantId, appId: attempt.appId };
  return { legacy: true };
}

/** 发起新的支付。已有尝试沿用当时的账户；还没有尝试时才读当前绑定。 */
export function checkoutAccountLoad(
  attempt: AttemptIdentity | null,
  order: StartedOrder,
  provider: "WECHAT" | "ALIPAY",
): AccountLoad | undefined {
  if (attempt) return loadFromAttempt(attempt);
  if (order.payChannel.startsWith(provider) && (order.payProfileId || order.payMerchantId)) {
    return accountLoad(order, provider);
  }
  return undefined;
}

/**
 * 回调、查单和退款。
 * 有尝试就只用那一次锁定的账户。
 * 没有尝试的旧订单，仅当渠道标记对得上时才走原来的站点配置；对不上就拒绝，不改用当前商户。
 */
export function notifyAccountLoad(
  attempt: AttemptIdentity | null,
  order: StartedOrder,
  provider: "WECHAT" | "ALIPAY",
): AccountLoad | null {
  if (attempt) return loadFromAttempt(attempt);
  if (!order.payChannel.startsWith(provider)) return null;
  return accountLoad(order, provider) ?? null;
}

export function accountLoad(order: StartedOrder, provider: "WECHAT" | "ALIPAY"): AccountLoad | undefined {
  const choice = orderAccountChoice(order, provider);
  if (choice.kind === "current") return undefined;
  if (choice.kind === "legacy") return { legacy: true };
  if (choice.kind === "merchant") return { merchantId: choice.merchantId };
  return { profileId: choice.profileId, merchantId: choice.merchantId };
}
