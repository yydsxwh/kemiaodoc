/**
 * 主站 ↔ Platform Config Center 适配层。
 *
 * 主站后台是「全局默认配置」的主要编辑入口：保存共享配置时先写 Platform，再把同一份值
 * 镜像进本地 SiteSettings 作为兜底。运行时读取走 ConfigResolver（内存缓存 + revision 轮询 +
 * Last-Known-Good），Platform 不可达时仍用 SiteSettings，主站不会因此挂掉。
 *
 * 只有明确在配置中心里存在的值（GLOBAL / PRODUCT_OVERRIDE / LAST_KNOWN_GOOD）才覆盖本地值；
 * Platform 自己的环境变量兜底与内置默认不参与，避免迁移前把生产 OSS 悄悄切成 LOCAL。
 */

import {
  CONFIG_GROUP_LABELS,
  catalogEntry,
  productsUsingGroup,
  type ConfigCacheState,
  type ConfigGroup,
  type ConfigSource,
  type ProductId,
} from "@yydsxwh/shared/contracts/config";
import {
  ConfigClient,
  ConfigResolver,
  PlatformApiError,
  PlatformHttpClient,
} from "@yydsxwh/shared/platform-client/index";

import type { SiteSettingsRow } from "./site-settings";

export const MAIN_PRODUCT_ID: ProductId = "main";

/** SiteSettings 字段 ↔ canonical key。ossPrefix 等主站本地业务参数不在这里。 */
export const MAIN_CONFIG_FIELDS: ReadonlyArray<{
  field: keyof SiteSettingsRow;
  key: string;
  /** SiteSettings 里是 boolean 的字段，配置中心存 "true" / "false" */
  boolean?: boolean;
  /** 只作为全局默认迁出，运行时不用配置中心的值覆盖本地（主站自己的地址 / 支付语义不变） */
  seedOnly?: boolean;
}> = [
  { field: "storageProvider", key: "storage.provider" },
  { field: "ossRegion", key: "storage.oss.region" },
  { field: "ossBucket", key: "storage.oss.bucket" },
  { field: "ossAccessKeyId", key: "storage.oss.accessKeyId" },
  { field: "ossAccessKeySecret", key: "storage.oss.accessKeySecret" },
  { field: "ossEndpoint", key: "storage.oss.endpoint" },
  { field: "ossPublicBaseUrl", key: "storage.oss.publicBaseUrl" },
  { field: "videoStorageProvider", key: "video.provider" },
  { field: "vodRegionId", key: "video.vod.regionId" },
  { field: "vodAccessKeyId", key: "video.vod.accessKeyId" },
  { field: "vodAccessKeySecret", key: "video.vod.accessKeySecret" },
  { field: "vodTemplateGroupId", key: "video.vod.templateGroupId" },
  { field: "vodPlayDomain", key: "video.vod.playDomain" },
  { field: "translateApiBaseUrl", key: "ai.baseUrl" },
  { field: "translateApiKey", key: "ai.apiKey" },
  { field: "translateApiModel", key: "ai.model" },
  { field: "amapWebKey", key: "maps.amap.webServiceKey" },
  { field: "smsEnabled", key: "sms.enabled", boolean: true },
  { field: "smsProvider", key: "sms.provider" },
  { field: "smsAccessKeyId", key: "sms.accessKeyId" },
  { field: "smsAccessKeySecret", key: "sms.accessKeySecret" },
  { field: "smsSignName", key: "sms.signName" },
  { field: "smsTemplateCode", key: "sms.template.login" },
  { field: "smsTestMode", key: "sms.testMode", boolean: true },
  { field: "jamendoClientId", key: "links.jamendoClientId" },
  { field: "siteUrl", key: "links.mainSite", seedOnly: true },
  { field: "paymentMode", key: "payment.mode", seedOnly: true },
  { field: "wechatMchId", key: "payment.wechat.mchId", seedOnly: true },
  { field: "wechatMchSerialNo", key: "payment.wechat.mchSerialNo", seedOnly: true },
  { field: "wechatApiV3Key", key: "payment.wechat.apiV3Key", seedOnly: true },
  { field: "wechatMchPrivateKey", key: "payment.wechat.mchPrivateKey", seedOnly: true },
  { field: "alipayAppId", key: "payment.alipay.appId", seedOnly: true },
  { field: "alipayPrivateKey", key: "payment.alipay.privateKey", seedOnly: true },
  { field: "alipayPublicKey", key: "payment.alipay.publicKey", seedOnly: true },
  { field: "alipayGateway", key: "payment.alipay.gateway", seedOnly: true },
];

const FIELD_BY_KEY = new Map(MAIN_CONFIG_FIELDS.map((item) => [item.key, item]));
const KEY_BY_FIELD = new Map(MAIN_CONFIG_FIELDS.map((item) => [item.field, item]));

export function configKeyForField(field: string): string | null {
  return KEY_BY_FIELD.get(field as keyof SiteSettingsRow)?.key ?? null;
}

/** 后台分区 → 配置组 */
export const SECTION_GROUP: Record<string, ConfigGroup> = {
  oss: "storage",
  vod: "video",
  ai: "ai",
  geo: "maps",
  sms: "sms",
};

export type MainConfigScope = "global" | "main";

// ---------------------------------------------------------------------------
// 客户端与解析器（服务端单例）
// ---------------------------------------------------------------------------

type ConfigCenterEnv = { baseUrl: string; token: string; clientId: string };

export function configCenterEnv(source: NodeJS.ProcessEnv = process.env): ConfigCenterEnv | null {
  const baseUrl = (source.PLATFORM_API_URL || source.PLATFORM_BASE_URL || "").trim();
  const token = (source.PLATFORM_SERVICE_TOKEN || "").trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token, clientId: (source.PLATFORM_CLIENT_ID || "andyyyds").trim() };
}

export function configCenterEnabled(): boolean {
  return configCenterEnv() !== null;
}

let clientSingleton: ConfigClient | null | undefined;
let resolverSingleton: ConfigResolver | null | undefined;

/** 管理面用：写全局、看影响范围。只在服务端构造，token 不进浏览器。 */
export function configCenterClient(): ConfigClient | null {
  if (clientSingleton !== undefined) return clientSingleton;
  const env = configCenterEnv();
  clientSingleton = env
    ? new ConfigClient(
        new PlatformHttpClient({ baseUrl: env.baseUrl, serviceToken: env.token, clientId: env.clientId, timeoutMs: 8_000 }),
      )
    : null;
  return clientSingleton;
}

/** 运行时用：带缓存的有效配置；单次请求超时 2.5 秒，超时走 Last-Known-Good。 */
export function mainConfigResolver(): ConfigResolver | null {
  if (resolverSingleton !== undefined) return resolverSingleton;
  const env = configCenterEnv();
  if (!env) {
    resolverSingleton = null;
    return null;
  }
  const client = new ConfigClient(
    new PlatformHttpClient({ baseUrl: env.baseUrl, serviceToken: env.token, clientId: env.clientId, timeoutMs: 2_500 }),
  );
  resolverSingleton = new ConfigResolver({ client, productId: MAIN_PRODUCT_ID, reveal: true, ttlMs: 45_000 });
  return resolverSingleton;
}

/** 测试注入 */
export function setConfigCenterForTests(input: { client: ConfigClient | null; resolver: ConfigResolver | null } | undefined) {
  clientSingleton = input ? input.client : undefined;
  resolverSingleton = input ? input.resolver : undefined;
  lastSources = {};
  lastStates = {};
}

// ---------------------------------------------------------------------------
// 运行时叠加
// ---------------------------------------------------------------------------

const OVERLAY_SOURCES: ReadonlySet<ConfigSource> = new Set(["GLOBAL", "PRODUCT_OVERRIDE", "LAST_KNOWN_GOOD"]);
const RUNTIME_GROUPS: ConfigGroup[] = ["storage", "video", "ai", "maps", "sms", "links"];

let lastSources: Record<string, ConfigSource> = {};
let lastStates: Partial<Record<ConfigGroup, ConfigCacheState>> = {};

/**
 * 把配置中心里明确存在的值叠加到 SiteSettings 行上。任何异常都返回原行。
 * 迁移前配置中心是空的，主站行为与现在完全一致；迁移后有效值与迁移前相同（CONFIG-14）。
 */
export async function applyGlobalConfig(row: SiteSettingsRow): Promise<SiteSettingsRow> {
  const resolver = mainConfigResolver();
  if (!resolver) return row;
  const next: Record<string, unknown> = { ...row };
  const sources: Record<string, ConfigSource> = {};
  const states: Partial<Record<ConfigGroup, ConfigCacheState>> = {};
  await Promise.all(
    RUNTIME_GROUPS.map(async (group) => {
      try {
        const snapshot = await resolver.getGroup(group);
        states[group] = snapshot.state;
        for (const entry of snapshot.group.entries) {
          const mapping = FIELD_BY_KEY.get(entry.key);
          if (!mapping || mapping.seedOnly) continue;
          if (!OVERLAY_SOURCES.has(entry.source)) continue;
          if (entry.value === null) continue;
          sources[mapping.field] = entry.source;
          next[mapping.field] = mapping.boolean ? entry.value === "true" : entry.value;
        }
      } catch {
        states[group] = "UNCONFIGURED";
      }
    }),
  );
  lastSources = sources;
  lastStates = states;
  return next as SiteSettingsRow;
}

/** 各字段当前有效值来自哪里；没有出现的字段来自主站本地 SiteSettings */
export function mainConfigSources(): Record<string, ConfigSource> {
  return { ...lastSources };
}

export function mainConfigStates(): Partial<Record<ConfigGroup, ConfigCacheState>> {
  return { ...lastStates };
}

// ---------------------------------------------------------------------------
// 管理面写入
// ---------------------------------------------------------------------------

export type SharedConfigWrite = { key: string; value: string | boolean; result: "written" | "unchanged" };

export class ConfigCenterUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigCenterUnavailable";
  }
}

/**
 * 把一次后台保存里的共享字段写进 Platform。
 * scope=global 写全局默认；scope=main 写主站自己的覆盖。Secret 的遮罩占位符与空串不会发出去。
 */
export async function writeSharedConfig(
  patch: Record<string, unknown>,
  scope: MainConfigScope,
): Promise<SharedConfigWrite[]> {
  const client = configCenterClient();
  const writes: SharedConfigWrite[] = [];
  if (!client) return writes;
  const extra: Array<{ key: string; value: string | boolean }> = [];
  for (const [field, raw] of Object.entries(patch)) {
    const mapping = KEY_BY_FIELD.get(field as keyof SiteSettingsRow);
    if (!mapping || raw === undefined) continue;
    const definition = catalogEntry(mapping.key);
    if (!definition) continue;
    let value: string | boolean;
    if (mapping.boolean) value = Boolean(raw);
    else if (typeof raw === "string") value = raw.trim();
    else continue;
    if (definition.sensitivity === "SECRET" && (value === "" || /^\*+/.test(String(value)))) continue;
    extra.push({ key: mapping.key, value });
    if (mapping.key === "maps.amap.webServiceKey" && value) extra.push({ key: "maps.provider", value: "AMAP" });
  }
  for (const item of extra) {
    try {
      if (scope === "global") await client.setGlobal(item.key, { value: item.value });
      else await client.setOverride(MAIN_PRODUCT_ID, item.key, { value: item.value });
      writes.push({ key: item.key, value: item.value, result: "written" });
    } catch (error) {
      if (error instanceof PlatformApiError && (error.status === 0 || error.status >= 500)) {
        throw new ConfigCenterUnavailable(`配置中心不可达，共享配置未保存：${error.message}`);
      }
      throw error;
    }
  }
  mainConfigResolver()?.invalidate();
  return writes;
}

/** 恢复整组跟随全局：删除主站在该组的所有覆盖 */
export async function clearMainOverrides(group: ConfigGroup): Promise<number> {
  const client = configCenterClient();
  if (!client) return 0;
  const current = await client.getOverrides(MAIN_PRODUCT_ID, group);
  for (const entry of current.entries) {
    await client.clearOverride(MAIN_PRODUCT_ID, entry.key, entry.version);
  }
  mainConfigResolver()?.invalidate(group);
  return current.entries.length;
}

export type MainConfigStatus = {
  enabled: boolean;
  group: ConfigGroup;
  label: string;
  /** 主站在该组的作用域：global=跟随全局默认；main=主站独立配置；local=尚未迁入配置中心 */
  scope: MainConfigScope | "local";
  state: ConfigCacheState;
  revision: number;
  /** 当前跟随该组全局默认的产品（不含主站自己） */
  followingProducts: ProductId[];
  overridingProducts: ProductId[];
  /** SiteSettings 字段 → 来源 */
  fieldSources: Record<string, ConfigSource>;
};

export async function mainConfigStatus(group: ConfigGroup): Promise<MainConfigStatus> {
  const client = configCenterClient();
  const label = CONFIG_GROUP_LABELS[group];
  if (!client) {
    return { enabled: false, group, label, scope: "local", state: "UNCONFIGURED", revision: 0, followingProducts: [], overridingProducts: [], fieldSources: {} };
  }
  const effective = await client.getEffectiveGroup(MAIN_PRODUCT_ID, group);
  const fieldSources: Record<string, ConfigSource> = {};
  let overridden = 0;
  let configured = 0;
  for (const entry of effective.entries) {
    const mapping = FIELD_BY_KEY.get(entry.key);
    if (!mapping) continue;
    fieldSources[mapping.field] = entry.source;
    if (entry.source === "PRODUCT_OVERRIDE") overridden += 1;
    if (entry.source === "GLOBAL" || entry.source === "PRODUCT_OVERRIDE") configured += 1;
  }
  const representative = effective.entries.find((entry) => entry.sharePolicy === "GLOBAL_INHERITABLE");
  let following: ProductId[] = productsUsingGroup(group).filter((id) => id !== MAIN_PRODUCT_ID);
  let overriding: ProductId[] = [];
  if (representative) {
    try {
      const impact = await client.getImpact(representative.key);
      following = impact.inheriting.filter((id) => id !== MAIN_PRODUCT_ID);
      overriding = impact.overriding.filter((id) => id !== MAIN_PRODUCT_ID);
    } catch {
      // 影响范围拿不到时退回 Catalog 的静态登记
    }
  }
  return {
    enabled: true,
    group,
    label,
    scope: configured === 0 ? "local" : overridden > 0 ? "main" : "global",
    state: mainConfigStates()[group] ?? "LIVE",
    revision: effective.revision,
    followingProducts: following,
    overridingProducts: overriding,
    fieldSources,
  };
}
