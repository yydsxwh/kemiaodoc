import { DEFAULT_SITE_HERO_URL } from "@andyyyds/shared/cover-images";
import { academicPublicHref } from "@andyyyds/shared/portal";
import {
  DEFAULT_HOME_WIDGET_LAYOUT,
  normalizeHomeWidgetLayout,
  type HomeWidgetLayoutConfig,
} from "@andyyyds/decorate/lib/home-widget-layout";
import {
  DEFAULT_BACKGROUND_ID,
  DEFAULT_FONT_SIZES,
  DEFAULT_LAYOUT_DENSITY,
  DEFAULT_PALETTE_ID,
  DEFAULT_THEME_PACK_ID,
  backgroundById,
  normalizeFontSizes,
  normalizeLayoutDensity,
  paletteById,
  themePackById,
  type FontSizesConfig,
  type LayoutDensity,
} from "@andyyyds/decorate/lib/site-theme";
import {
  DEFAULT_TYPOGRAPHY,
  normalizeTypography,
  type TypographyConfig,
} from "@andyyyds/decorate/lib/site-typography";
import {
  DEFAULT_HOME_CLOCK,
  normalizeHomeClock,
  type HomeClockConfig,
} from "@andyyyds/decorate/lib/home-clock";
import {
  DEFAULT_HOME_LOGO,
  normalizeHomeLogo,
  type HomeLogoConfig,
} from "@andyyyds/decorate/lib/home-logo";
import {
  DEFAULT_HOME_FLOAT_CARDS,
  normalizeHomeFloatCards,
  type HomeFloatCardsConfig,
} from "@andyyyds/decorate/lib/home-float-cards";

export type { HomeWidgetBox, HomeWidgetLayoutConfig } from "@andyyyds/decorate/lib/home-widget-layout";

export type DecorateBanner = {
  id: string;
  url: string;
  alt: string;
  /**
   * 点击跳转地址（站内路径或 https）。
   * 空则前台不可点，兼容旧库无此字段的配置。
   */
  href?: string;
  /**
   * 是否新标签打开。
   * 未配置时：首页主图（banners[0]）默认 true；其它横幅默认 true（投放链常见外链）。
   */
  openInNewTab?: boolean;
  /** 缺省视为启用，避免旧 Banner 升级后消失 */
  enabled?: boolean;
  /** ISO 时间；空表示不限制 */
  startsAt?: string;
  endsAt?: string;
  /** 窄屏可选图；空则仍用 url */
  mobileUrl?: string;
};

export type DecorateAnnouncement = {
  enabled: boolean;
  text: string;
  href: string;
  openInNewTab?: boolean;
};

export type DecorateSeo = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  canonical: string;
  organizationName: string;
};

/** 风格预设只是写入同一套 theme 字段的快捷方式 */
export type HomeStylePresetId = "enterprise" | "education" | "ecosystem" | "minimal" | "";

/** 首页主视觉区 CTA 按钮（站长可改文案与跳转） */
export type DecorateCta = {
  label: string;
  href: string;
  /** 未配置时同页打开，保持原先 Link 行为 */
  openInNewTab?: boolean;
};

export type DecorateConfig = {
  logoUrl: string;
  /**
   * 首页品牌 Logo 点击地址；空则不可点（顶栏 Logo 仍回首页，不受此字段影响）。
   */
  logoHref?: string;
  logoOpenInNewTab?: boolean;
  /** 浏览器标题 / 安装提示等处显示的网站名称 */
  siteName: string;
  brandName: string;
  showBrandText: boolean;
  heroHeadline: string;
  heroSubtext: string;
  /** 首页右侧主视觉；若 banners 非空则优先用 banners[0] */
  heroImageUrl: string;
  banners: DecorateBanner[];
  /** 主视觉主按钮（默认「进入知识付费」） */
  heroPrimaryCta: DecorateCta;
  /** 主视觉次按钮（默认「了解公司」） */
  heroSecondaryCta: DecorateCta;
  /** 一键主题包 id（仅记录来源；实际生效看 palette/background） */
  themePackId: string;
  /** 配色方案 id → CSS 变量 */
  paletteId: string;
  /** 背景方案 id → body 背景层 */
  backgroundId: string;
  /** 轻量版式密度 */
  layoutDensity: LayoutDensity;
  /** 各区块字号（px），站长在「网站装扮 → 文字」调整 */
  fontSizes: FontSizesConfig;
  /** 各文本角色的字体 / 特效 / 动画；缺省兼容旧 decorateJson */
  typography: TypographyConfig;
  /** 首页时钟样式与摆放；未配置时用右上默认角 */
  homeClock: HomeClockConfig;
  /** 首页颗秒标摆放；未配置时默认左上，与时钟对称 */
  homeLogo: HomeLogoConfig;
  /** 首页时钟与门户卡片的自由位置/尺寸；未启用时保持顶栏时钟 + 栅格 */
  homeWidgetLayout: HomeWidgetLayoutConfig;
  /** 首页内容卡片（找人私聊/联系我们/客户端下载）的自由摆放；空 = 全部留在文档流 */
  homeFloatCards: HomeFloatCardsConfig;
  /** 顶栏上方公告。默认关闭，避免旧站突然多一条。 */
  announcement: DecorateAnnouncement;
  /** 首页 SEO。空字段回落到网站名与默认描述。 */
  seo: DecorateSeo;
  /** 最近一次套用的风格预设；真正生效的仍是 palette / background / density */
  stylePresetId: HomeStylePresetId;
  /** 最近若干次装扮快照，存在同一份 JSON 里，不另建表 */
  revisions: DecorateRevision[];
};

export type DecorateSnapshot = Omit<DecorateConfig, "revisions">;

export type DecorateRevision = {
  id: string;
  savedAt: string;
  note: string;
  snapshot: DecorateSnapshot;
};

export const DEFAULT_LOGO_URL = "/brand/logo.png";

/** 首页主视觉：本地 public/covers，与课程封面图库一致 */
const DEFAULT_HERO_IMAGE = DEFAULT_SITE_HERO_URL;

export const DEFAULT_HERO_PRIMARY_CTA: DecorateCta = {
  label: "找学业辅导",
  href: academicPublicHref(),
  openInNewTab: false,
};

export const DEFAULT_HERO_SECONDARY_CTA: DecorateCta = {
  label: "探索全部产品",
  href: "/products",
  openInNewTab: false,
};

/** 种子文案。库里两句都没改过时才换成公司官网表述，改过任一句就保留。 */
export const LEGACY_HERO_HEADLINE = "把你的经验，做成一门真正能卖出去的课";
export const LEGACY_HERO_SUBTEXT =
  "课程上架、支付购买、在线学习、创作者后台、优惠券与邀请分销，一站备齐。先跑通卖课闭环，再按你的业务升级改造。";
export const LEGACY_HERO_PRIMARY_CTA: DecorateCta = {
  label: "进入知识付费",
  href: "/courses",
  openInNewTab: false,
};
export const LEGACY_HERO_SECONDARY_CTA: DecorateCta = {
  label: "了解公司",
  href: "/about/company",
  openInNewTab: false,
};

export const DEFAULT_SEO_DESCRIPTION =
  "连接学习、知识、人与数字产品。学业辅导、课程资料、知识社区与软件服务，用统一账号进入。";

export const DEFAULT_ANNOUNCEMENT: DecorateAnnouncement = {
  enabled: false,
  text: "",
  href: "",
  openInNewTab: false,
};

export const DEFAULT_SEO: DecorateSeo = {
  title: "",
  description: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  canonical: "",
  organizationName: "",
};

export const HOME_STYLE_PRESETS: {
  id: Exclude<HomeStylePresetId, "">;
  name: string;
  themePackId: string;
  layoutDensity: "default" | "compact" | "airy";
}[] = [
  { id: "enterprise", name: "企业官网", themePackId: "pack-cool-slate", layoutDensity: "airy" },
  { id: "education", name: "教育服务", themePackId: "pack-seminar", layoutDensity: "default" },
  { id: "ecosystem", name: "产品生态", themePackId: "pack-sky-fresh", layoutDensity: "default" },
  { id: "minimal", name: "极简", themePackId: "pack-cool-slate", layoutDensity: "compact" },
];

export const DEFAULT_DECORATE: DecorateConfig = {
  logoUrl: DEFAULT_LOGO_URL,
  logoHref: "",
  logoOpenInNewTab: false,
  siteName: "歪歪艾斯",
  brandName: "歪歪艾斯",
  showBrandText: false,
  heroHeadline: "连接学习、知识、人与数字产品",
  heroSubtext:
    "从学业辅导到课程资料、知识社区与软件服务。一个账号，进入公司的产品与服务。",
  heroImageUrl: DEFAULT_HERO_IMAGE,
  banners: [
    {
      id: "default-hero",
      url: DEFAULT_HERO_IMAGE,
      alt: "学员在线学习",
      href: "",
      openInNewTab: true,
    },
  ],
  heroPrimaryCta: { ...DEFAULT_HERO_PRIMARY_CTA },
  heroSecondaryCta: { ...DEFAULT_HERO_SECONDARY_CTA },
  themePackId: DEFAULT_THEME_PACK_ID,
  paletteId: DEFAULT_PALETTE_ID,
  backgroundId: DEFAULT_BACKGROUND_ID,
  layoutDensity: DEFAULT_LAYOUT_DENSITY,
  fontSizes: { ...DEFAULT_FONT_SIZES },
  typography: structuredClone(DEFAULT_TYPOGRAPHY),
  homeClock: { ...DEFAULT_HOME_CLOCK },
  homeLogo: { ...DEFAULT_HOME_LOGO },
  homeWidgetLayout: structuredClone(DEFAULT_HOME_WIDGET_LAYOUT),
  homeFloatCards: { ...DEFAULT_HOME_FLOAT_CARDS },
  announcement: { ...DEFAULT_ANNOUNCEMENT },
  seo: { ...DEFAULT_SEO },
  stylePresetId: "ecosystem",
  revisions: [],
};

function newId() {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeOptionalHref(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .slice(0, 800);
}

function normalizeCta(
  raw: Partial<DecorateCta> | undefined,
  fallback: DecorateCta,
): DecorateCta {
  const label =
    String(raw?.label ?? fallback.label)
      .trim()
      .slice(0, 40) || fallback.label;
  const href =
    String(raw?.href ?? fallback.href)
      .trim()
      .slice(0, 800) || fallback.href;
  return {
    label,
    href,
    openInNewTab:
      typeof raw?.openInNewTab === "boolean"
        ? raw.openInNewTab
        : Boolean(fallback.openInNewTab),
  };
}

function normalizeSchedule(raw: unknown): string {
  const value = String(raw ?? "").trim().slice(0, 40);
  if (!value) return "";
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

export function newBanner(partial?: Partial<DecorateBanner>): DecorateBanner {
  return {
    id: partial?.id || newId(),
    url: (partial?.url || "").trim(),
    alt: (partial?.alt || "").trim(),
    href: normalizeOptionalHref(partial?.href),
    // 横幅默认可新标签；站长可在后台关掉
    openInNewTab:
      typeof partial?.openInNewTab === "boolean" ? partial.openInNewTab : true,
    enabled: partial?.enabled !== false,
    startsAt: normalizeSchedule(partial?.startsAt),
    endsAt: normalizeSchedule(partial?.endsAt),
    mobileUrl: normalizeOptionalHref(partial?.mobileUrl),
  };
}

/** 未写 enabled 的旧 Banner 视为在线；时间窗外的不展示 */
export function bannerIsLive(banner: DecorateBanner, now = Date.now()): boolean {
  if (!banner.url || banner.enabled === false) return false;
  const start = banner.startsAt ? Date.parse(banner.startsAt) : NaN;
  const end = banner.endsAt ? Date.parse(banner.endsAt) : NaN;
  if (Number.isFinite(start) && start > now) return false;
  if (Number.isFinite(end) && end < now) return false;
  return true;
}

export function liveBanners(config: DecorateConfig, now = Date.now()): DecorateBanner[] {
  return config.banners.filter((banner) => bannerIsLive(banner, now));
}

/** 横幅/主图：未显式配置时默认新标签（首页大图投放链常见需求） */
export function resolveBannerOpenInNewTab(banner: DecorateBanner): boolean {
  return banner.openInNewTab !== false;
}

function ctaMatches(raw: Partial<DecorateCta> | undefined, legacy: DecorateCta) {
  if (!raw) return true;
  const label = String(raw.label || "").trim();
  const href = String(raw.href || "").trim();
  if (!label && !href) return true;
  return label === legacy.label && href === legacy.href;
}

/** 两句种子文案都还在时，换成公司官网默认；只改过其中一句则原样保留。 */
export function resolveStoredHeroCopy(parsed: Partial<DecorateConfig>) {
  const headline = String(parsed.heroHeadline || "").trim();
  const subtext = String(parsed.heroSubtext || "").trim();
  const untouched =
    (!headline || headline === LEGACY_HERO_HEADLINE) &&
    (!subtext || subtext === LEGACY_HERO_SUBTEXT);
  const primaryUntouched = ctaMatches(parsed.heroPrimaryCta, LEGACY_HERO_PRIMARY_CTA);
  const secondaryUntouched = ctaMatches(parsed.heroSecondaryCta, LEGACY_HERO_SECONDARY_CTA);
  return {
    heroHeadline: untouched
      ? DEFAULT_DECORATE.heroHeadline
      : headline || DEFAULT_DECORATE.heroHeadline,
    heroSubtext: untouched
      ? DEFAULT_DECORATE.heroSubtext
      : subtext || DEFAULT_DECORATE.heroSubtext,
    heroPrimaryCta: normalizeCta(
      untouched && primaryUntouched ? DEFAULT_HERO_PRIMARY_CTA : parsed.heroPrimaryCta,
      untouched && primaryUntouched ? DEFAULT_HERO_PRIMARY_CTA : DEFAULT_HERO_PRIMARY_CTA,
    ),
    heroSecondaryCta: normalizeCta(
      untouched && secondaryUntouched
        ? DEFAULT_HERO_SECONDARY_CTA
        : parsed.heroSecondaryCta,
      untouched && secondaryUntouched
        ? DEFAULT_HERO_SECONDARY_CTA
        : DEFAULT_HERO_SECONDARY_CTA,
    ),
  };
}

function normalizeAnnouncement(raw: Partial<DecorateAnnouncement> | undefined): DecorateAnnouncement {
  return {
    enabled: raw?.enabled === true,
    text: String(raw?.text || "").trim().slice(0, 160),
    href: normalizeOptionalHref(raw?.href),
    openInNewTab: Boolean(raw?.openInNewTab),
  };
}

function normalizeSeo(raw: Partial<DecorateSeo> | undefined): DecorateSeo {
  return {
    title: String(raw?.title || "").trim().slice(0, 120),
    description: String(raw?.description || "").trim().slice(0, 300),
    ogTitle: String(raw?.ogTitle || "").trim().slice(0, 120),
    ogDescription: String(raw?.ogDescription || "").trim().slice(0, 300),
    ogImage: normalizeOptionalHref(raw?.ogImage),
    canonical: normalizeOptionalHref(raw?.canonical),
    organizationName: String(raw?.organizationName || "").trim().slice(0, 80),
  };
}

function normalizeStylePreset(raw: unknown): HomeStylePresetId {
  return raw === "enterprise" || raw === "education" || raw === "ecosystem" || raw === "minimal"
    ? raw
    : "";
}

function normalizeRevisions(raw: unknown): DecorateRevision[] {
  if (!Array.isArray(raw)) return [];
  const revisions: DecorateRevision[] = [];
  for (const item of raw.slice(0, 6)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<DecorateRevision>;
    if (!row.snapshot || typeof row.snapshot !== "object") continue;
    revisions.push({
      id: String(row.id || "").trim().slice(0, 40) || `rev_${revisions.length + 1}`,
      savedAt: String(row.savedAt || "").trim().slice(0, 40),
      note: String(row.note || "保存").trim().slice(0, 80) || "保存",
      snapshot: row.snapshot,
    });
  }
  return revisions;
}

function resolveThemeFields(parsed: Partial<DecorateConfig>) {
  // 若只存了 themePackId，用主题包补齐配色/背景，保证旧数据与一键装扮一致
  const pack = themePackById(parsed.themePackId);
  const paletteId = paletteById(
    parsed.paletteId || pack?.paletteId || DEFAULT_PALETTE_ID,
  ).id;
  const backgroundId = backgroundById(
    parsed.backgroundId || pack?.backgroundId || DEFAULT_BACKGROUND_ID,
  ).id;
  const themePackId =
    (parsed.themePackId || "").trim() ||
    (pack ? pack.id : DEFAULT_THEME_PACK_ID);
  return {
    themePackId,
    paletteId,
    backgroundId,
    layoutDensity: normalizeLayoutDensity(parsed.layoutDensity),
    fontSizes: normalizeFontSizes(parsed.fontSizes),
    typography: normalizeTypography(parsed.typography),
  };
}

export function parseDecorate(raw: string | null | undefined): DecorateConfig {
  if (!raw?.trim()) return structuredClone(DEFAULT_DECORATE);
  try {
    const parsed = JSON.parse(raw) as Partial<DecorateConfig>;
    const banners = Array.isArray(parsed.banners)
      ? parsed.banners
          .filter((b): b is DecorateBanner => Boolean(b && typeof b === "object"))
          .map((b) => ({
            id: String(b.id || newId()),
            url: String(b.url || "").trim(),
            alt: String(b.alt || "").trim(),
            href: normalizeOptionalHref(b.href),
            // 旧配置无 openInNewTab：主图/横幅默认新标签，填了链接即可外跳
            openInNewTab:
              typeof b.openInNewTab === "boolean" ? b.openInNewTab : true,
            enabled: b.enabled !== false,
            startsAt: normalizeSchedule(b.startsAt),
            endsAt: normalizeSchedule(b.endsAt),
            mobileUrl: normalizeOptionalHref(b.mobileUrl),
          }))
          .filter((b) => b.url)
      : DEFAULT_DECORATE.banners;

    const brandName =
      (parsed.brandName || DEFAULT_DECORATE.brandName).trim() || "歪歪艾斯";
    const theme = resolveThemeFields(parsed);
    const heroCopy = resolveStoredHeroCopy(parsed);
    return {
      logoUrl: (parsed.logoUrl || DEFAULT_DECORATE.logoUrl).trim() || DEFAULT_LOGO_URL,
      logoHref: normalizeOptionalHref(parsed.logoHref),
      logoOpenInNewTab:
        typeof parsed.logoOpenInNewTab === "boolean"
          ? parsed.logoOpenInNewTab
          : false,
      siteName:
        (parsed.siteName || brandName || DEFAULT_DECORATE.siteName).trim() ||
        DEFAULT_DECORATE.siteName,
      brandName,
      showBrandText:
        typeof parsed.showBrandText === "boolean"
          ? parsed.showBrandText
          : DEFAULT_DECORATE.showBrandText,
      heroHeadline: heroCopy.heroHeadline,
      heroSubtext: heroCopy.heroSubtext,
      heroImageUrl:
        (parsed.heroImageUrl || banners[0]?.url || DEFAULT_DECORATE.heroImageUrl).trim() ||
        DEFAULT_HERO_IMAGE,
      banners: banners.length ? banners : structuredClone(DEFAULT_DECORATE.banners),
      heroPrimaryCta: heroCopy.heroPrimaryCta,
      heroSecondaryCta: heroCopy.heroSecondaryCta,
      ...theme,
      homeClock: normalizeHomeClock(parsed.homeClock),
      homeLogo: normalizeHomeLogo(parsed.homeLogo),
      homeWidgetLayout: normalizeHomeWidgetLayout(parsed.homeWidgetLayout),
      homeFloatCards: normalizeHomeFloatCards(parsed.homeFloatCards),
      announcement: normalizeAnnouncement(parsed.announcement),
      seo: normalizeSeo(parsed.seo),
      stylePresetId: normalizeStylePreset(parsed.stylePresetId),
      revisions: normalizeRevisions(parsed.revisions),
    };
  } catch {
    return structuredClone(DEFAULT_DECORATE);
  }
}

export function stringifyDecorate(config: DecorateConfig) {
  return JSON.stringify(config);
}

/** 首页主视觉：优先第一张仍在展示期内的 Banner */
export function resolveHeroImage(config: DecorateConfig, now = Date.now()) {
  return liveBanners(config, now)[0]?.url || config.heroImageUrl || DEFAULT_HERO_IMAGE;
}

export function resolveSeo(config: DecorateConfig) {
  const siteName = config.siteName?.trim() || config.brandName?.trim() || DEFAULT_DECORATE.siteName;
  const title = config.seo.title.trim() || siteName;
  const description = config.seo.description.trim() || DEFAULT_SEO_DESCRIPTION;
  return {
    title,
    description,
    ogTitle: config.seo.ogTitle.trim() || title,
    ogDescription: config.seo.ogDescription.trim() || description,
    ogImage: config.seo.ogImage.trim() || resolveHeroImage(config),
    canonical: config.seo.canonical.trim(),
    organizationName: config.seo.organizationName.trim() || config.brandName?.trim() || siteName,
  };
}

/** 保存前压入一条快照。内容没变则不增加版本。 */
export function pushDecorateRevision(
  previous: DecorateConfig,
  note = "保存",
): DecorateRevision[] {
  const snapshot = { ...previous };
  delete (snapshot as { revisions?: DecorateRevision[] }).revisions;
  const serialized = JSON.stringify(snapshot);
  const latest = previous.revisions[0];
  if (latest && JSON.stringify(latest.snapshot) === serialized) return previous.revisions;
  const next: DecorateRevision = {
    id: `rev_${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
    note: note.slice(0, 80) || "保存",
    snapshot,
  };
  return [next, ...previous.revisions].slice(0, 6);
}
