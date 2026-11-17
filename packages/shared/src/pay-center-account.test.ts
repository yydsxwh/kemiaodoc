import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  payCenterClock,
  productKeyFromType,
  publicChannelState,
  pushChannelToCenter,
  readCenterAccount,
  resetPayCenterAccountCache,
} from "./pay-center-account";

assert.equal(productKeyFromType("MATHCODE"), "mathcode");
assert.equal(productKeyFromType("MATERIAL"), "material");
assert.equal(productKeyFromType("PRODUCT"), "shop");
assert.equal(productKeyFromType("COURSE"), "course");

const secret = "api-v3-key-should-not-leak-0123456789";

async function main() {
  delete process.env.PAY_CENTER_ORIGIN;
  delete process.env.PAY_CENTER_CONTROL_TOKEN;
  resetPayCenterAccountCache();
  assert.equal((await readCenterAccount("course", "WECHAT")).kind, "SKIP");

  let mode: "ready" | "off" | "hang" | "invalid" = "ready";
  const server = createServer(async (req, res) => {
    if (mode === "hang") {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "PUT") {
      const raw = await new Promise<string>((resolve) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(chunk as Buffer));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      });
      assert.equal(raw.includes(secret), true);
      res.writeHead(mode === "off" ? 500 : 200, { "content-type": "application/json" });
      res.end(JSON.stringify(mode === "off" ? { error: "支付中心没有保存渠道" } : { id: "ch_wx" }));
      return;
    }
    const state = mode === "off" ? "OFF" : mode === "invalid" ? "INVALID" : "READY";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      state,
      profileId: "ch_wx",
      version: 3,
      provider: url.searchParams.get("provider") || "WECHAT",
      merchantId: "mch_ready",
      public: { appId: "wx_ready", mchId: "mch_ready" },
      secrets: { apiV3Key: secret, privateKeyPem: "PRIVATE" },
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  process.env.PAY_CENTER_ORIGIN = `http://127.0.0.1:${address.port}`;
  process.env.PAY_CENTER_CONTROL_TOKEN = "control-token";
  process.env.PAY_CENTER_TIMEOUT_MS = "80";
  resetPayCenterAccountCache();

  const ready = await readCenterAccount("course", "WECHAT");
  assert.equal(ready.kind, "READY");
  if (ready.kind === "READY") assert.equal(ready.version, 3);
  const shown = publicChannelState(ready);
  assert.equal(shown.merchantId, "mch_ready");
  assert.equal(JSON.stringify(shown).includes(secret), false);

  mode = "hang";
  const cached = await readCenterAccount("course", "WECHAT");
  assert.equal(cached.kind, "READY");
  payCenterClock.now = () => Date.now() + 6 * 60 * 1000;
  const expired = await readCenterAccount("course", "WECHAT");
  assert.equal(expired.kind, "UNAVAILABLE");

  resetPayCenterAccountCache();
  mode = "off";
  const closed = await readCenterAccount("shop", "ALIPAY");
  assert.equal(closed.kind, "OFF");
  mode = "hang";
  const closedCached = await readCenterAccount("shop", "ALIPAY");
  assert.equal(closedCached.kind, "OFF");

  resetPayCenterAccountCache();
  mode = "invalid";
  const invalid = await readCenterAccount("mathcode", "WECHAT");
  assert.equal(invalid.kind, "INVALID");

  mode = "off";
  const pushed = await pushChannelToCenter({
    provider: "WECHAT",
    publicConfig: { mchId: "mch_ready" },
    secrets: { apiV3Key: secret },
  });
  assert.equal(pushed.ok, false);
  if (!pushed.ok && "error" in pushed) {
    assert.equal(pushed.error.includes(secret), false);
  }

  server.close();
  delete process.env.PAY_CENTER_ORIGIN;
  delete process.env.PAY_CENTER_CONTROL_TOKEN;
  delete process.env.PAY_CENTER_TIMEOUT_MS;
  console.log("pay-center-account.test.ts ok");
}

void main();
