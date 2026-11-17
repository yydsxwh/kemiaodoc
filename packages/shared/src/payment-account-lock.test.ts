import assert from "node:assert/strict";
import { accountLoad, checkoutAccountLoad, decidePaymentChannels, notifyAccountLoad, orderAccountChoice } from "./payment-account-lock";

const localOff = {
  modeSetting: "auto",
  envMode: "",
  wechatReady: false,
  alipayReady: false,
  wechatEnabled: false,
  alipayEnabled: false,
};

const disconnected = decidePaymentChannels({
  centerConfigured: false,
  wechat: "SKIP",
  alipay: "SKIP",
  local: localOff,
});
assert.equal(disconnected.mockOnly, true);
assert.equal(disconnected.closed, false);

const specifiedWechatOnly = decidePaymentChannels({
  centerConfigured: true,
  wechat: "READY",
  alipay: "READY",
  local: localOff,
});
assert.equal(specifiedWechatOnly.wechat, true);
assert.equal(specifiedWechatOnly.alipay, true);
assert.equal(specifiedWechatOnly.mockOnly, false);

const alipayStaysOpen = decidePaymentChannels({
  centerConfigured: true,
  wechat: "INVALID",
  alipay: "READY",
  local: localOff,
});
assert.equal(alipayStaysOpen.mode, "alipay");
assert.equal(alipayStaysOpen.wechat, false);
assert.equal(alipayStaysOpen.mockOnly, false);
assert.equal(alipayStaysOpen.invalid, false);

const noMockWhenInvalid = decidePaymentChannels({
  centerConfigured: true,
  wechat: "INVALID",
  alipay: "UNCONFIGURED",
  local: { ...localOff, modeSetting: "mock" },
});
assert.equal(noMockWhenInvalid.mockOnly, false);
assert.equal(noMockWhenInvalid.invalid, true);
assert.equal(noMockWhenInvalid.wechat, false);
assert.equal(noMockWhenInvalid.alipay, false);

const paused = decidePaymentChannels({
  centerConfigured: true,
  wechat: "OFF",
  alipay: "OFF",
  local: localOff,
});
assert.equal(paused.closed, true);
assert.equal(paused.mockOnly, false);

const down = decidePaymentChannels({
  centerConfigured: true,
  wechat: "UNAVAILABLE",
  alipay: "UNAVAILABLE",
  local: { ...localOff, wechatReady: true, wechatEnabled: true },
});
assert.equal(down.unavailable, true);
assert.equal(down.mockOnly, false);

const fresh = { payProfileId: "", payMerchantId: "", payChannel: "" };
assert.equal(orderAccountChoice(fresh, "WECHAT").kind, "current");

const legacyWechat = { payProfileId: "", payMerchantId: "", payChannel: "WECHAT_NATIVE" };
assert.equal(orderAccountChoice(legacyWechat, "WECHAT").kind, "legacy");
assert.equal(orderAccountChoice(legacyWechat, "ALIPAY").kind, "current");
assert.deepEqual(accountLoad(legacyWechat, "WECHAT"), { legacy: true });

const locked = { payProfileId: "ch_wx", payMerchantId: "mch_old", payChannel: "WECHAT_JSAPI" };
assert.deepEqual(orderAccountChoice(locked, "WECHAT"), {
  kind: "locked",
  profileId: "ch_wx",
  merchantId: "mch_old",
});
assert.equal(orderAccountChoice(locked, "ALIPAY").kind, "current");

const merchantOnly = { payProfileId: "", payMerchantId: "mch_old", payChannel: "ALIPAY_PAGE" };
assert.deepEqual(accountLoad(merchantOnly, "ALIPAY"), { merchantId: "mch_old" });

const keepLocalWechat = decidePaymentChannels({
  centerConfigured: true,
  allowMock: false,
  wechat: "UNCONFIGURED",
  alipay: "UNCONFIGURED",
  local: { ...localOff, wechatReady: true, wechatEnabled: true },
});
assert.equal(keepLocalWechat.mode, "wechat");
assert.equal(keepLocalWechat.wechat, true);
assert.equal(keepLocalWechat.alipay, false);
assert.equal(keepLocalWechat.mockOnly, false);
assert.equal(keepLocalWechat.closed, false);

const productionEmpty = decidePaymentChannels({
  centerConfigured: false,
  allowMock: false,
  wechat: "SKIP",
  alipay: "SKIP",
  local: localOff,
});
assert.equal(productionEmpty.mockOnly, false);
assert.equal(productionEmpty.closed, true);

const centerReadyLocalEmpty = decidePaymentChannels({
  centerConfigured: true,
  allowMock: false,
  wechat: "READY",
  alipay: "READY",
  local: localOff,
});
assert.equal(centerReadyLocalEmpty.mode, "both");
assert.equal(centerReadyLocalEmpty.mockOnly, false);
assert.equal(centerReadyLocalEmpty.wechat, true);
assert.equal(centerReadyLocalEmpty.alipay, true);

const productionInvalid = decidePaymentChannels({
  centerConfigured: true,
  allowMock: false,
  wechat: "INVALID",
  alipay: "OFF",
  local: { ...localOff, modeSetting: "mock", wechatReady: true, wechatEnabled: true },
});
assert.equal(productionInvalid.mockOnly, false);
assert.equal(productionInvalid.wechat, false);
assert.equal(productionInvalid.alipay, false);

const wechatAttempt = {
  profileId: "ch_wx",
  profileVersion: 3,
  merchantId: "mch_wx",
  appId: "wx_app",
};
const alipayAttempt = {
  profileId: "ch_ali",
  profileVersion: 2,
  merchantId: "ali_app",
  appId: "ali_app",
};
const switched = { payProfileId: "ch_wx", payMerchantId: "mch_wx", payChannel: "ALIPAY_PAGE" };
assert.deepEqual(checkoutAccountLoad(wechatAttempt, switched, "WECHAT")?.profileId, "ch_wx");
assert.equal(checkoutAccountLoad(null, switched, "WECHAT"), undefined);
assert.deepEqual(notifyAccountLoad(wechatAttempt, switched, "WECHAT")?.merchantId, "mch_wx");
assert.equal(notifyAccountLoad(null, switched, "WECHAT"), null);
assert.deepEqual(notifyAccountLoad(alipayAttempt, switched, "ALIPAY")?.profileId, "ch_ali");
assert.deepEqual(notifyAccountLoad(null, legacyWechat, "WECHAT"), { legacy: true });

console.log("payment-account-lock.test.ts ok");
