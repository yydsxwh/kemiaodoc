/**
 * 前台门户配置：顶部导航 + 公司/个人介绍页文案
 *
 * 存 SiteSettings.portalJson；内容管理可改。默认即可先上线门户壳子。
 */

export type PortalNavLink = {
  key: string;
  label: string;
  href: string;
  /** false 时不在导航显示（保留配置） */
  enabled?: boolean;
  /** true 时跳转到「即将开放」提示页也可直接链到 /shop 等占位页 */
  comingSoon?: boolean;
  /**
   * 首页「门户入口」卡片是否新标签打开。
   * 未配置时同页（兼容旧导航）；顶栏仍始终同页，避免汉堡菜单误开外链。
   */
  openInNewTab?: boolean;
  /** 首页产品卡一句话；空则用目录默认文案 */
  summary?: string;
  /** 前台分类，如教育 / 社区 / 软件。不暴露仓库名 */
  category?: string;
  /** 正式 / Beta / 即将推出。未写时由 comingSoon 推导 */
  status?: PortalNavStatus;
  /** 首页产品区优先排在前面；未标记时仍展示，避免旧站产品突然消失 */
  featuredOnHome?: boolean;
  /** 首页排序，越小越靠前 */
  homeRank?: number;
  /** 短标签，最多 8 个 */
  tags?: string[];
  /** 卡片角标用的短图标（emoji 或 1～2 个字） */
  icon?: string;
};

export type PortalNavStatus = "live" | "beta" | "soon";

export type PortalAboutPage = {
  /** 页面主标题 */
  title: string;
  /** 副标题 / 一句话 */
  subtitle: string;
  /** 正文，空行分段 */
  body: string;
  /** 侧栏或底部要点，可选 */
  highlights: { label: string; text: string }[];
};

/** 联系我们：内容管理可改；在首页按 homeSectionOrder 排序展示 */
export type PortalContact = {
  /** 是否在前台显示联系信息 */
  enabled: boolean;
  /** 区块标题旁文案（兼容旧字段） */
  linkLabel: string;
  /** 展示标题 */
  title: string;
  phone: string;
  wechat: string;
  /** QQ 号 */
  qq: string;
  /** 微信公众号 */
  wechatMp: string;
  /** 小红书号 */
  xiaohongshu: string;
  /** 抖音号 */
  douyin: string;
  /** B 站账号 */
  bilibili: string;
  email: string;
  address: string;
  /** 营业/服务时间 */
  hours: string;
  /** 补充说明（多行） */
  note: string;
};

/**
 * 经典首页区块 id：与 page.tsx 渲染分支一一对应。
 * 未保存过顺序时用 DEFAULT_HOME_SECTION_ORDER。
 * 联系我们固定排在品牌首屏之后；社区与交流默认隐藏（私聊已并入 KKChat）。
 */
export const HOME_SECTION_IDS = [
  "hero",
  "contact",
  "trust",
  "businesses",
  "portal",
  "academicFocus",
  "featured",
  "courses",
  "meetup",
  "downloads",
  "company",
  "banners",
  "footerCta",
  "community",
] as const;

/**
 * 上一版公司官网默认顺序（联系我们靠后、社区区块默认展示）。
 * 仅当保存的 id 序列与此完全一致时，迁到新默认并默认隐藏社区区块。
 */
export const PREVIOUS_COMPANY_HOME_SECTION_IDS = [
  "hero",
  "trust",
  "businesses",
  "portal",
  "academicFocus",
  "featured",
  "courses",
  "meetup",
  "community",
  "downloads",
  "company",
  "contact",
  "banners",
  "footerCta",
] as const;

/** 升级前的默认六段。仅当保存顺序与此完全一致时才整表迁移，自定义顺序不动。 */
export const LEGACY_HOME_SECTION_IDS = [
  "contact",
  "hero",
  "banners",
  "portal",
  "courses",
  "meetup",
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

/** 单个首页区块：顺序 + 是否前台可见（CMS「首页区块顺序」） */
export type HomeSectionEntry = {
  id: HomeSectionId;
  /**
   * 是否在前台渲染该区块。
   * 与位次解耦：隐藏后仍保留排序，重新显示时不必重排。
   * 旧库仅存 id 字符串、无 visible 时视为 true，避免升级后区块突然消失。
   */
  visible: boolean;
};

/** 独立账号中心（account 子域）。必须用绝对地址，避免被当成主站相对路径。 */
export const ACCOUNT_CENTER_HREF = "https://account.yydsxwh.com/";

/**
 * Academic 教务独立站点。只在这里读取 ACADEMIC_URL，导航组件不要再写死域名。
 * 未配置时使用正式子域，主站渲染导航不请求 Academic。
 */
export function academicPublicHref() {
  const configured =
    process.env.ACADEMIC_URL ||
    process.env.NEXT_PUBLIC_ACADEMIC_URL ||
    "https://academic.yydsxwh.com";
  return `${configured.replace(/\/$/, "")}/`;
}

export const ACADEMIC_HREF = academicPublicHref();

/**
 * 知识社区独立站点。导航只读 KNOWLEDGE_URL，不在组件里写死域名。
 * 未配置时使用规划中的子域，主站渲染导航不请求 Knowledge。
 */
export function knowledgePublicHref() {
  const configured =
    process.env.KNOWLEDGE_URL ||
    process.env.NEXT_PUBLIC_KNOWLEDGE_URL ||
    "https://knowledge.yydsxwh.com";
  return `${configured.replace(/\/$/, "")}/`;
}

export const KNOWLEDGE_HREF = knowledgePublicHref();

/**
 * KKChat 独立站点。导航只读 KKCHAT_URL，不在组件里写死域名。
 * 未配置时使用规划中的子域。
 */
export function kkchatPublicHref() {
  const configured =
    process.env.KKCHAT_URL ||
    process.env.NEXT_PUBLIC_KKCHAT_URL ||
    "https://kkchat.yydsxwh.com";
  return `${configured.replace(/\/$/, "")}/`;
}

export const KKCHAT_HREF = kkchatPublicHref();

/** 官网默认层级：品牌首屏之后立刻是联系我们；社区与交流默认不单独占一块。 */
const HOME_SECTIONS_HIDDEN_BY_DEFAULT = new Set<HomeSectionId>(["community"]);

export const DEFAULT_HOME_SECTION_ORDER: HomeSectionEntry[] =
  HOME_SECTION_IDS.map((id) => ({
    id,
    visible: !HOME_SECTIONS_HIDDEN_BY_DEFAULT.has(id),
  }));

export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  hero: "品牌首屏",
  trust: "信任与能力",
  businesses: "核心业务",
  portal: "产品与服务",
  academicFocus: "学业辅导",
  featured: "精选内容",
  courses: "热门课程",
  meetup: "热门约搭",
  community: "社区与交流（可选）",
  downloads: "客户端下载",
  company: "公司介绍",
  contact: "联系我们",
  banners: "更多横幅",
  footerCta: "页尾引导",
};

export type HomeSectionWidth = "narrow" | "default" | "wide";
export type HomeSectionSpacing = "compact" | "default" | "relaxed";
export type HomeSectionBackground = "plain" | "soft" | "brand" | "contrast";

/** 单个区块的前台文案与版式。缺省走 DEFAULT_SECTION_CHROME，旧库无此字段仍能渲染。 */
export type HomeSectionChrome = {
  title?: string;
  subtitle?: string;
  width?: HomeSectionWidth;
  spacing?: HomeSectionSpacing;
  background?: HomeSectionBackground;
  columns?: 1 | 2 | 3 | 4;
  featured?: boolean;
};

export type HomeTrustItem = {
  id: string;
  text: string;
  enabled?: boolean;
};

export type HomeBusiness = {
  key: string;
  title: string;
  summary: string;
  href: string;
  ctaLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  icon?: string;
  featured?: boolean;
  enabled?: boolean;
  openInNewTab?: boolean;
};

export type HomeAcademicFocus = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  summary: string;
  points: { title: string; text: string }[];
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  tertiaryLabel: string;
  tertiaryHref: string;
};

export type HomeContentMode = "auto" | "manual" | "hidden";

export type HomeContentFeed = {
  mode: HomeContentMode;
  courseIds: string[];
  meetupIds: string[];
  postIds: string[];
  articleIds: string[];
};

export type HomeFooterCta = {
  enabled: boolean;
  title: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

export type PortalConfig = {
  nav: PortalNavLink[];
  company: PortalAboutPage;
  person: PortalAboutPage;
  contact: PortalContact;
  /**
   * 经典首页区块上下顺序与显示开关（内容管理可拖拽 / 点按钮显隐）。
   * DIY 首页仅用其中 contact 相对其它区块的前后：contact 排在 hero 之前则在 DIY 模块上方，否则下方；
   * contact.visible === false 时 DIY 也不渲染联系我们。
   */
  homeSectionOrder: HomeSectionEntry[];
  /** 各区块标题、密度、背景。未配置的项用默认官网层级。 */
  homeSectionChrome: Partial<Record<HomeSectionId, HomeSectionChrome>>;
  /** 首屏下的能力摘要。只展示站长填写的句子，不生成假数据。 */
  trustItems: HomeTrustItem[];
  /** 首页 3～4 个大业务，而不是把导航拆成同级小卡。 */
  businesses: HomeBusiness[];
  academicFocus: HomeAcademicFocus;
  contentFeed: HomeContentFeed;
  footerCta: HomeFooterCta;
};

export const DEFAULT_PORTAL_CONTACT: PortalContact = {
  enabled: true,
  linkLabel: "联系我们",
  title: "联系我们",
  phone: "",
  wechat: "",
  qq: "",
  wechatMp: "",
  xiaohongshu: "",
  douyin: "",
  bilibili: "",
  email: "",
  address: "",
  hours: "",
  note: "欢迎通过微信、QQ 或者电话与我们联系，我们会尽快回复。",
};

export const DEFAULT_TRUST_ITEMS: HomeTrustItem[] = [
  { id: "global", text: "服务全球学习者", enabled: true },
  { id: "skills", text: "大学课程与 AI 数字技能", enabled: true },
  { id: "match", text: "老师与学员匹配", enabled: true },
  { id: "account", text: "多产品统一账号", enabled: true },
  { id: "clients", text: "Web、Android 与 Windows", enabled: true },
];

export const DEFAULT_BUSINESSES: HomeBusiness[] = [
  {
    key: "academic",
    title: "学业辅导",
    summary: "按课程与学习目标匹配老师，发布需求、上课与跟进都在 Academic 完成。",
    href: ACADEMIC_HREF,
    ctaLabel: "我要找辅导",
    secondaryHref: ACADEMIC_HREF,
    secondaryLabel: "申请成为老师",
    icon: "学",
    featured: true,
    enabled: true,
  },
  {
    key: "courses",
    title: "课程、资料与知识",
    summary: "网课、资料与可反复学习的内容，适合自己安排进度。",
    href: "/courses",
    ctaLabel: "查看课程与资料",
    icon: "课",
    featured: false,
    enabled: true,
  },
  {
    key: "ai-skills",
    title: "AI 与数字技能",
    summary: "学习用 AI 做网站、软件和数字内容，服务会随课程持续扩展。",
    href: "/courses",
    ctaLabel: "了解相关课程",
    icon: "AI",
    featured: false,
    enabled: true,
  },
  {
    key: "community",
    title: "社区与连接",
    summary: "知识社区、论坛、约搭与私聊，把学习和人连在一起。",
    href: "/forum",
    ctaLabel: "进入社区",
    secondaryHref: KNOWLEDGE_HREF,
    secondaryLabel: "知识社区",
    icon: "社",
    featured: false,
    enabled: true,
  },
];

export const DEFAULT_ACADEMIC_FOCUS: HomeAcademicFocus = {
  enabled: true,
  eyebrow: "当前重点业务",
  title: "学业辅导，从找到老师开始",
  summary:
    "学员发布学习需求，老师申请入驻。课程形式、科目和上课方式由 Academic 承接，主站只负责说明和跳转。",
  points: [
    { title: "找老师", text: "按学习目标浏览并联系老师。" },
    { title: "发需求", text: "说清想学什么，等待合适的老师响应。" },
    { title: "多种形式", text: "课程辅导、考试与学业支持可以并行。" },
    { title: "老师入驻", text: "老师用同一账号申请，业务留在 Academic。" },
  ],
  primaryLabel: "我要找辅导",
  primaryHref: ACADEMIC_HREF,
  secondaryLabel: "申请成为老师",
  secondaryHref: ACADEMIC_HREF,
  tertiaryLabel: "了解服务",
  tertiaryHref: "/about/company",
};

export const DEFAULT_CONTENT_FEED: HomeContentFeed = {
  mode: "auto",
  courseIds: [],
  meetupIds: [],
  postIds: [],
  articleIds: [],
};

export const DEFAULT_FOOTER_CTA: HomeFooterCta = {
  enabled: true,
  title: "从一件具体的事开始",
  body: "找辅导、看课程，或先浏览全部产品。账号在账号中心统一登录。",
  primaryLabel: "找学业辅导",
  primaryHref: ACADEMIC_HREF,
  secondaryLabel: "探索全部产品",
  secondaryHref: "/products",
};

export const DEFAULT_SECTION_CHROME: Partial<Record<HomeSectionId, HomeSectionChrome>> = {
  trust: { spacing: "compact", background: "soft", columns: 4 },
  businesses: {
    title: "我们做什么",
    subtitle: "先看业务，再进入具体产品。",
    spacing: "relaxed",
    background: "plain",
    columns: 2,
    featured: true,
  },
  portal: {
    title: "产品与服务",
    subtitle: "教育、社区与软件产品从这里进入。未上线的会标明即将推出。",
    background: "soft",
    columns: 4,
  },
  academicFocus: { spacing: "relaxed", background: "brand", featured: true },
  featured: {
    title: "正在发生",
    subtitle: "课程、活动、讨论与公司动态，没有内容时这一段会自动收起。",
    background: "plain",
    columns: 4,
  },
  courses: { background: "plain", columns: 4 },
  meetup: { background: "soft", columns: 4 },
  community: {
    title: "社区与交流",
    subtitle: "找人私聊仍在这里。更完整的会话在消息里继续。",
    background: "plain",
  },
  downloads: {
    title: "客户端下载",
    subtitle: "已上线的平台可以直接下载，其余平台标为即将推出。",
    background: "soft",
    columns: 4,
  },
  company: {
    background: "plain",
    width: "default",
  },
  contact: { background: "soft", spacing: "relaxed" },
  banners: { spacing: "compact", background: "plain" },
  footerCta: { background: "contrast", spacing: "relaxed" },
};

export const DEFAULT_PORTAL: PortalConfig = {
  nav: [
    { key: "home", label: "首页", href: "/", category: "公司" },
    {
      key: "company",
      label: "公司介绍",
      href: "/about/company",
      summary: "公司在做什么，以及怎样合作。",
      category: "公司",
      status: "live",
    },
    {
      key: "person",
      label: "个人介绍",
      href: "/about/person",
      summary: "创始人与个人站点。",
      category: "公司",
      status: "live",
    },
    {
      key: "academic",
      label: "教务",
      href: ACADEMIC_HREF,
      summary: "找老师、发学习需求、申请入驻。",
      category: "教育",
      status: "live",
      featuredOnHome: true,
      homeRank: 1,
      icon: "学",
    },
    // 顶栏只留「网课资料」；课程/资料广场在页内 Tab 同级切换，不与首页/商城抢位
    {
      key: "courses",
      label: "网课资料",
      href: "/courses",
      summary: "课程、专栏与可下载的学习资料。",
      category: "教育",
      status: "live",
      featuredOnHome: true,
      homeRank: 2,
    },
    // 约搭：线下结伴 / 活动匹配广场（类似「一起玩」，非小程序复刻）
    {
      key: "meetup",
      label: "约搭",
      href: "/meetup",
      summary: "线下结伴与活动。",
      category: "社区",
      status: "live",
    },
    {
      key: "shop",
      label: "商城",
      href: "/shop",
      summary: "站内可购买的商品与服务。",
      category: "软件",
      status: "live",
    },
    // 自研软件产品专栏（颗秒会议、颗秒网盘等）；库里无此项时 mergePortalNav 会补到末尾
    {
      key: "products",
      label: "软件产品",
      href: "/products",
      summary: "颗秒系列与站内软件产品。",
      category: "软件",
      status: "live",
      featuredOnHome: true,
      homeRank: 3,
    },
    {
      key: "forum",
      label: "论坛",
      href: "/forum",
      comingSoon: false,
      summary: "按学校、圈子与话题讨论。",
      category: "社区",
      status: "live",
    },
    {
      key: "kkchat",
      label: "KKChat",
      href: KKCHAT_HREF,
      enabled: true,
      comingSoon: false,
      summary: "聊天与社交，也给其他产品当公共能力。",
      category: "社区",
      status: "live",
      featuredOnHome: true,
      homeRank: 5,
    },
    {
      key: "knowledge",
      label: "知识社区",
      href: KNOWLEDGE_HREF,
      summary: "更长的知识内容与讨论。",
      category: "社区",
      status: "live",
      featuredOnHome: true,
      homeRank: 4,
    },
    // 仍出现在 CMS 开关里；顶栏运行时并进「软件产品」分区，不单独占一位
    {
      key: "games",
      label: "游戏中心",
      href: "/games",
      comingSoon: false,
      summary: "站内游戏。",
      category: "软件",
      status: "live",
    },
    // 独立账号中心：顶栏同页跳转完整外链；库里无此项时 mergePortalNav 补到末尾
    { key: "account-center", label: "账号中心", href: ACCOUNT_CENTER_HREF },
  ],
  contact: structuredClone(DEFAULT_PORTAL_CONTACT),
  homeSectionOrder: structuredClone(DEFAULT_HOME_SECTION_ORDER),
  homeSectionChrome: structuredClone(DEFAULT_SECTION_CHROME),
  trustItems: structuredClone(DEFAULT_TRUST_ITEMS),
  businesses: structuredClone(DEFAULT_BUSINESSES),
  academicFocus: structuredClone(DEFAULT_ACADEMIC_FOCUS),
  contentFeed: structuredClone(DEFAULT_CONTENT_FEED),
  footerCta: structuredClone(DEFAULT_FOOTER_CTA),
  company: {
    title: "公司介绍",
    subtitle: "把内容、服务与数字化能力，做成可持续经营的产品。",
    body: [
      "我们是一家面向学习与成长场景的数字化内容公司，专注把专业经验变成可交付、可运营的产品与服务。",
      "当前已上线知识付费、商城与论坛：课程上架、在线学习、商城购物、大学/圈子/同城/单位分区交流、支付收款与创作者后台。后续将逐步开放游戏中心等模块，形成一体多业态门户。",
      "若你希望合作、采购课程或了解企业服务，欢迎通过站内注册账号后与我们联系。",
    ].join("\n\n"),
    highlights: [
      { label: "核心业务", text: "知识付费与内容运营" },
      { label: "产品方向", text: "门户化多模块平台" },
      { label: "服务对象", text: "学员、创作者与合作机构" },
    ],
  },
  person: {
    title: "个人介绍",
    subtitle: "用产品思维做内容，用长期主义做连接。",
    body: [
      "你好，我是本站创始人。我长期关注教育、内容付费与互联网产品，希望把「能学、能买、能互动」放在同一个站点里。",
      "这个网站从知识付费起步，正在扩展为包含介绍、商城、论坛与游戏中心的多功能门户。欢迎关注后续更新，也欢迎交流合作想法。",
    ].join("\n\n"),
    highlights: [
      { label: "角色", text: "创始人 / 产品负责人" },
      { label: "关注", text: "知识付费 · 社区 · 数字产品" },
      { label: "态度", text: "先做可用，再做丰富" },
    ],
  },
};

function normalizeAbout(
  raw: Partial<PortalAboutPage> | undefined,
  fallback: PortalAboutPage,
): PortalAboutPage {
  const highlights = Array.isArray(raw?.highlights)
    ? raw!.highlights
        .map((h) => ({
          label: String(h?.label || "").trim().slice(0, 40),
          text: String(h?.text || "").trim().slice(0, 120),
        }))
        .filter((h) => h.label || h.text)
        .slice(0, 8)
    : fallback.highlights;
  return {
    title: (raw?.title || fallback.title).trim().slice(0, 80) || fallback.title,
    subtitle: (raw?.subtitle || fallback.subtitle).trim().slice(0, 200) || fallback.subtitle,
    body: (raw?.body || fallback.body).trim().slice(0, 20000) || fallback.body,
    highlights: highlights.length ? highlights : fallback.highlights,
  };
}

/** 规范化单条导航；缺字段时用默认项兜底 */
function normalizeNavItem(
  item: Partial<PortalNavLink> | undefined,
  fallback: PortalNavLink,
): PortalNavLink {
  const key = String(item?.key || fallback.key).trim().slice(0, 40) || fallback.key;
  const catalog =
    DEFAULT_PORTAL.nav.find((row) => row.key === key) || fallback;
  const statusRaw = item?.status ?? catalog.status;
  const status: PortalNavStatus | undefined =
    statusRaw === "live" || statusRaw === "beta" || statusRaw === "soon"
      ? statusRaw
      : undefined;
  const tags = Array.isArray(item?.tags)
    ? item.tags
        .map((tag) => String(tag || "").trim().slice(0, 20))
        .filter(Boolean)
        .slice(0, 8)
    : catalog.tags
      ? [...catalog.tags]
      : undefined;
  const rankRaw = item?.homeRank ?? catalog.homeRank;
  const homeRank = Number.isFinite(Number(rankRaw))
    ? Math.max(0, Math.min(999, Math.round(Number(rankRaw))))
    : undefined;
  return {
    key,
    label:
      String(item?.label || fallback.label).trim().slice(0, 40) || fallback.label,
    href:
      String(item?.href || fallback.href).trim().slice(0, 300) || fallback.href,
    enabled: item?.enabled !== false,
    // 商城已上线：旧 CMS 若仍标 comingSoon，运行时清掉，避免顶栏仍进占位页
    comingSoon: key === "shop" || key === "forum" ? false : Boolean(item?.comingSoon),
    openInNewTab: Boolean(item?.openInNewTab),
    summary:
      String(item?.summary ?? catalog.summary ?? "")
        .trim()
        .slice(0, 160) || undefined,
    category:
      String(item?.category ?? catalog.category ?? "")
        .trim()
        .slice(0, 40) || undefined,
    status,
    featuredOnHome:
      typeof item?.featuredOnHome === "boolean"
        ? item.featuredOnHome
        : Boolean(catalog.featuredOnHome),
    homeRank,
    tags: tags?.length ? tags : undefined,
    icon:
      String(item?.icon ?? catalog.icon ?? "")
        .trim()
        .slice(0, 8) || undefined,
  };
}

/**
 * 资料广场不得作为顶栏与「网课资料」同级的项。
 * 生产 CMS 若仍存有旧的 materials 导航，运行时剥离，无需立刻改库。
 */
function isMaterialsTopNavItem(item: PortalNavLink): boolean {
  return (
    item.key === "materials" ||
    item.href === "/materials" ||
    item.label === "资料广场"
  );
}

/**
 * 合并门户导航：优先保留 CMS 已保存的数组顺序（拖拽排序依赖此行为）。
 * 缺省默认项追加到末尾；旧库「知识付费」等自定义 label 会保留。
 * 旧的顶栏「资料广场」会被剥掉（入口改由页内 Tab 承担）。
 */
function mergePortalNav(
  saved: Array<Partial<PortalNavLink> | undefined> | undefined,
): PortalNavLink[] {
  if (!Array.isArray(saved) || saved.length === 0) {
    return structuredClone(DEFAULT_PORTAL.nav);
  }

  const normalizedSaved = saved
    .map((item, index) =>
      normalizeNavItem(item, DEFAULT_PORTAL.nav[index] || DEFAULT_PORTAL.nav[0]),
    )
    .filter((item) => item.label && item.href)
    .filter((item) => !isMaterialsTopNavItem(item));

  const seenKeys = new Set<string>();
  const merged: PortalNavLink[] = [];

  // 按保存顺序输出，同 key 只保留首次出现，避免脏数据打乱排版
  for (const item of normalizedSaved) {
    if (seenKeys.has(item.key)) continue;
    seenKeys.add(item.key);
    merged.push(item);
  }

  // 代码新增的默认导航项：库里还没有时补到末尾，不覆盖管理员排好的顺序。
  // 教务不走这条末尾追加：缺省位置由 ensureAcademicNav 决定，已保存的则原位保留。
  for (const defaultItem of DEFAULT_PORTAL.nav) {
    if (seenKeys.has(defaultItem.key)) continue;
    if (isMaterialsTopNavItem(defaultItem)) continue;
    if (defaultItem.key === "academic" || defaultItem.key === "kkchat") continue;
    merged.push({ ...defaultItem });
    seenKeys.add(defaultItem.key);
  }

  const trimmed = ensureKkchatNav(ensureAcademicNav(merged)).slice(0, 22);
  const hasAccountCenter = trimmed.some(
    (item) =>
      item.key === "account-center" ||
      item.href === ACCOUNT_CENTER_HREF ||
      item.href.startsWith("https://account.yydsxwh.com"),
  );
  // 满 20 项时默认项会被裁掉；账号中心必须留下，宁可少显示一个普通入口
  return ensureKkchatNav(
    ensureAcademicNav(
      ensureAccountCenterNav(hasAccountCenter ? trimmed : merged.slice(0, 21)),
    ),
  );
}

function isPersonNav(item: PortalNavLink) {
  return (
    item.key === "person" ||
    item.href === "/about/person" ||
    item.label === "个人介绍" ||
    item.label === "个人IP" ||
    item.label === "个人 IP"
  );
}

function isCoursesNav(item: PortalNavLink) {
  return item.key === "courses" || item.href === "/courses" || item.label === "网课资料";
}

/**
 * 认教务项时只用稳定 key；旧数据没有 key 时才用 Academic 子域 href。
 * 显示名称可被站长改掉，不能拿「教务」当身份，否则改名后认不出、又会被当成缺失项。
 */
function isAcademicNav(item: PortalNavLink) {
  if (item.key === "academic") return true;
  const href = item.href.trim();
  return (
    href === ACADEMIC_HREF || href.startsWith("https://academic.yydsxwh.com")
  );
}

/**
 * 后台可编辑字段一旦保存，就是单一事实来源。
 * 这里只在完全没有教务项时注入默认项（个人介绍之后、网课资料之前）。
 * 已存在则保留 label / href / enabled / openInNewTab / comingSoon 和排序，
 * 禁止删掉用户配置再造一个默认对象。
 */
function isForumNav(item: PortalNavLink) {
  return item.key === "forum" || item.href === "/forum";
}

function isKnowledgeNav(item: PortalNavLink) {
  const href = item.href.trim();
  return item.key === "knowledge" || href === KNOWLEDGE_HREF || href.startsWith("https://knowledge.yydsxwh.com");
}

function isKkchatNav(item: PortalNavLink) {
  if (item.key === "kkchat") return true;
  const href = item.href.trim();
  return href === KKCHAT_HREF || href.startsWith("https://kkchat.yydsxwh.com");
}

/**
 * 旧 CMS 没有 KKChat 时，插在论坛和知识社区之间。
 * 已经存在则保留站长改过的名称、排序和开关，只把地址纠正到当前配置的 origin。
 */
function ensureKkchatNav(nav: PortalNavLink[]): PortalNavLink[] {
  const index = nav.findIndex(isKkchatNav);
  if (index >= 0) {
    const current = nav[index];
    const next = nav.slice();
    next[index] = {
      ...current,
      key: "kkchat",
      href: KKCHAT_HREF,
      comingSoon: false,
      label: current.label || "KKChat",
    };
    return next;
  }
  const item: PortalNavLink = {
    key: "kkchat",
    label: "KKChat",
    href: KKCHAT_HREF,
    enabled: true,
    comingSoon: false,
  };
  const next = nav.slice();
  const forumIndex = next.findIndex(isForumNav);
  const knowledgeIndex = next.findIndex(isKnowledgeNav);
  if (forumIndex >= 0) next.splice(forumIndex + 1, 0, item);
  else if (knowledgeIndex >= 0) next.splice(knowledgeIndex, 0, item);
  else next.push(item);
  return next;
}

function ensureAcademicNav(nav: PortalNavLink[]): PortalNavLink[] {
  if (nav.some(isAcademicNav)) return nav;
  const academic: PortalNavLink = {
    key: "academic",
    label: "教务",
    href: ACADEMIC_HREF,
    enabled: true,
    comingSoon: false,
  };
  const next = nav.slice();
  const personIndex = next.findIndex(isPersonNav);
  const coursesIndex = next.findIndex(isCoursesNav);
  if (personIndex >= 0) next.splice(personIndex + 1, 0, academic);
  else if (coursesIndex >= 0) next.splice(coursesIndex, 0, academic);
  else next.push(academic);
  return next;
}

/**
 * 账号中心必须始终出现在顶栏，且指向独立子域。
 * href / 启用状态是安全边界：旧数据改成 /account 或关掉时，运行时纠正。
 * 显示名称不是安全边界，站长改过的 label 必须原样保留。
 * 身份只认 key 或账号子域，不认可改的「账号中心」文案。
 */
function ensureAccountCenterNav(nav: PortalNavLink[]): PortalNavLink[] {
  const index = nav.findIndex(
    (item) =>
      item.key === "account-center" ||
      item.href === ACCOUNT_CENTER_HREF ||
      item.href.startsWith("https://account.yydsxwh.com"),
  );
  if (index >= 0) {
    const current = nav[index];
    nav[index] = {
      ...current,
      key: "account-center",
      href: ACCOUNT_CENTER_HREF,
      enabled: true,
      comingSoon: false,
      label: current.label || "账号中心",
    };
    return nav;
  }
  return [
    ...nav,
    { key: "account-center", label: "账号中心", href: ACCOUNT_CENTER_HREF },
  ];
}

function normalizeContact(
  raw: Partial<PortalContact> | undefined,
): PortalContact {
  const base = DEFAULT_PORTAL_CONTACT;
  return {
    enabled: raw?.enabled !== false,
    linkLabel:
      String(raw?.linkLabel || base.linkLabel).trim().slice(0, 20) ||
      base.linkLabel,
    title:
      String(raw?.title || base.title).trim().slice(0, 40) || base.title,
    phone: String(raw?.phone || "").trim().slice(0, 40),
    wechat: String(raw?.wechat || "").trim().slice(0, 60),
    qq: String(raw?.qq || "").trim().slice(0, 40),
    wechatMp: String(raw?.wechatMp || "").trim().slice(0, 60),
    xiaohongshu: String(raw?.xiaohongshu || "").trim().slice(0, 60),
    douyin: String(raw?.douyin || "").trim().slice(0, 60),
    bilibili: String(raw?.bilibili || "").trim().slice(0, 60),
    email: String(raw?.email || "").trim().slice(0, 120),
    address: String(raw?.address || "").trim().slice(0, 200),
    hours: String(raw?.hours || "").trim().slice(0, 80),
    note: String(raw?.note ?? base.note).trim().slice(0, 2000),
  };
}

const HOME_SECTION_ID_SET = new Set<string>(HOME_SECTION_IDS);

/** 从原始项解析区块 id（兼容旧字符串与新 { id, visible }） */
function parseHomeSectionId(item: unknown): HomeSectionId | null {
  if (typeof item === "string") {
    const id = item.trim() as HomeSectionId;
    return HOME_SECTION_ID_SET.has(id) ? id : null;
  }
  if (item && typeof item === "object" && "id" in item) {
    const id = String((item as { id?: unknown }).id || "").trim() as HomeSectionId;
    return HOME_SECTION_ID_SET.has(id) ? id : null;
  }
  return null;
}

function isIdSequence(
  entries: HomeSectionEntry[],
  ids: readonly HomeSectionId[],
) {
  return (
    entries.length === ids.length &&
    entries.every((entry, index) => entry.id === ids[index])
  );
}

function isLegacyHomeSectionSequence(entries: HomeSectionEntry[]) {
  return isIdSequence(entries, LEGACY_HOME_SECTION_IDS);
}

/** 联系我们插到品牌首屏后面；没有首屏时放在最前。其它区块的相对顺序不动。 */
function placeContactAfterHero(entries: HomeSectionEntry[]): HomeSectionEntry[] {
  const contact =
    entries.find((entry) => entry.id === "contact") || {
      id: "contact" as const,
      visible: true,
    };
  const rest = entries.filter((entry) => entry.id !== "contact");
  const heroIndex = rest.findIndex((entry) => entry.id === "hero");
  const insertAt = heroIndex >= 0 ? heroIndex + 1 : 0;
  rest.splice(insertAt, 0, contact);
  return rest;
}

/**
 * 把还没出现的新区块插到推荐层级附近，而不是一律堆到页尾。
 * 已保存的相对顺序保持不变。
 */
function insertMissingHomeSections(ordered: HomeSectionEntry[]): HomeSectionEntry[] {
  const result = ordered.slice();
  const present = new Set(result.map((entry) => entry.id));
  for (const entry of DEFAULT_HOME_SECTION_ORDER) {
    if (present.has(entry.id)) continue;
    const recommendedIndex = DEFAULT_HOME_SECTION_ORDER.findIndex(
      (item) => item.id === entry.id,
    );
    let insertAt = result.length;
    let anchored = false;
    for (let index = recommendedIndex - 1; index >= 0; index -= 1) {
      const at = result.findIndex(
        (item) => item.id === DEFAULT_HOME_SECTION_ORDER[index]?.id,
      );
      if (at >= 0) {
        insertAt = at + 1;
        anchored = true;
        break;
      }
    }
    if (!anchored) {
      for (
        let index = recommendedIndex + 1;
        index < DEFAULT_HOME_SECTION_ORDER.length;
        index += 1
      ) {
        const at = result.findIndex(
          (item) => item.id === DEFAULT_HOME_SECTION_ORDER[index]?.id,
        );
        if (at >= 0) {
          insertAt = at;
          break;
        }
      }
    }
    result.splice(insertAt, 0, { ...entry });
    present.add(entry.id);
  }
  return result;
}

/**
 * 合并首页区块顺序与显隐：保留已保存顺序/visible，过滤未知 id。
 * 旧库无该字段时用新的官网默认顺序。
 * 若保存的仍是升级前的六段默认顺序，则迁到新层级并保留原来的显隐。
 * 其它自定义顺序只补缺，不重排已有区块。
 */
export function normalizeHomeSectionOrder(raw: unknown): HomeSectionEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return structuredClone(DEFAULT_HOME_SECTION_ORDER);
  }

  const seen = new Set<HomeSectionId>();
  const ordered: HomeSectionEntry[] = [];

  for (const item of raw) {
    const id = parseHomeSectionId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    // 仅显式 false 才隐藏；缺省 / true / 旧字符串项一律显示
    const visible =
      item &&
      typeof item === "object" &&
      "visible" in item &&
      (item as { visible?: unknown }).visible === false
        ? false
        : true;
    ordered.push({ id, visible });
  }

  if (ordered.length === 0) return structuredClone(DEFAULT_HOME_SECTION_ORDER);

  if (isLegacyHomeSectionSequence(ordered)) {
    const visibility = new Map(ordered.map((entry) => [entry.id, entry.visible]));
    return placeContactAfterHero(
      DEFAULT_HOME_SECTION_ORDER.map((entry) => ({
        id: entry.id,
        visible: visibility.has(entry.id)
          ? visibility.get(entry.id) !== false
          : entry.visible,
      })),
    );
  }

  const withMissing = insertMissingHomeSections(ordered);
  // 上一版官网默认把联系我们放在靠后，并把社区私聊单独展示。迁到新层级时默认收起社区区块。
  const migrated = isIdSequence(ordered, PREVIOUS_COMPANY_HOME_SECTION_IDS)
    ? withMissing.map((entry) =>
        entry.id === "community" ? { ...entry, visible: false } : entry,
      )
    : withMissing;
  return placeContactAfterHero(migrated);
}

/** 仅返回仍在前台展示的区块 id（按顺序）；供经典首页渲染跳过隐藏项 */
export function visibleHomeSectionIds(
  order: HomeSectionEntry[] | unknown,
): HomeSectionId[] {
  return normalizeHomeSectionOrder(order)
    .filter((entry) => entry.visible !== false)
    .map((entry) => entry.id);
}

/**
 * DIY 首页时：contact 若排在 hero 之前（或未配置 hero），则放在 DIY 模块上方，否则下方。
 * 用 hero 作锚点，与经典首页「联系我们相对主视觉」的语义一致。
 * 不负责 visible：调用方应先判断 contact 是否显示。
 */
export function shouldShowContactBeforeDiyContent(
  order: HomeSectionEntry[] | HomeSectionId[] | unknown,
): boolean {
  const normalized = normalizeHomeSectionOrder(order);
  const contactIndex = normalized.findIndex((e) => e.id === "contact");
  const heroIndex = normalized.findIndex((e) => e.id === "hero");
  if (contactIndex < 0) return true;
  if (heroIndex < 0) return true;
  return contactIndex < heroIndex;
}

/** 首页区块顺序里「联系我们」是否允许前台出现（区块级开关，独立于 contact.enabled 字段内容） */
export function isHomeContactSectionVisible(
  order: HomeSectionEntry[] | unknown,
): boolean {
  const entry = normalizeHomeSectionOrder(order).find((e) => e.id === "contact");
  return entry ? entry.visible !== false : true;
}

/** 是否已填写至少一项可展示的联系方式 */
export function hasContactDetails(contact: PortalContact) {
  return Boolean(
    contact.phone ||
      contact.wechat ||
      contact.qq ||
      contact.wechatMp ||
      contact.xiaohongshu ||
      contact.douyin ||
      contact.bilibili ||
      contact.email ||
      contact.address ||
      contact.hours ||
      contact.note,
  );
}

const SECTION_WIDTHS = new Set<HomeSectionWidth>(["narrow", "default", "wide"]);
const SECTION_SPACINGS = new Set<HomeSectionSpacing>([
  "compact",
  "default",
  "relaxed",
]);
const SECTION_BACKGROUNDS = new Set<HomeSectionBackground>([
  "plain",
  "soft",
  "brand",
  "contrast",
]);

function normalizeSectionChromeMap(
  raw: unknown,
): Partial<Record<HomeSectionId, HomeSectionChrome>> {
  const source =
    raw && typeof raw === "object"
      ? (raw as Partial<Record<string, HomeSectionChrome>>)
      : {};
  const next: Partial<Record<HomeSectionId, HomeSectionChrome>> = {};
  for (const id of HOME_SECTION_IDS) {
    const item = source[id];
    const fallback = DEFAULT_SECTION_CHROME[id] || {};
    if (!item || typeof item !== "object") {
      if (fallback && Object.keys(fallback).length) next[id] = { ...fallback };
      continue;
    }
    const columns = Number(item.columns);
    next[id] = {
      title: String(item.title ?? fallback.title ?? "").trim().slice(0, 80) || undefined,
      subtitle:
        String(item.subtitle ?? fallback.subtitle ?? "").trim().slice(0, 240) ||
        undefined,
      width: SECTION_WIDTHS.has(item.width as HomeSectionWidth)
        ? (item.width as HomeSectionWidth)
        : fallback.width,
      spacing: SECTION_SPACINGS.has(item.spacing as HomeSectionSpacing)
        ? (item.spacing as HomeSectionSpacing)
        : fallback.spacing,
      background: SECTION_BACKGROUNDS.has(item.background as HomeSectionBackground)
        ? (item.background as HomeSectionBackground)
        : fallback.background,
      columns:
        columns === 1 || columns === 2 || columns === 3 || columns === 4
          ? columns
          : fallback.columns,
      featured:
        typeof item.featured === "boolean" ? item.featured : fallback.featured,
    };
  }
  return next;
}

export function resolveSectionChrome(
  chrome: Partial<Record<HomeSectionId, HomeSectionChrome>> | undefined,
  id: HomeSectionId,
): HomeSectionChrome {
  const map = normalizeSectionChromeMap(chrome);
  return map[id] || DEFAULT_SECTION_CHROME[id] || { title: HOME_SECTION_LABELS[id] };
}

function normalizeTrustItems(raw: unknown): HomeTrustItem[] {
  if (!Array.isArray(raw)) return structuredClone(DEFAULT_TRUST_ITEMS);
  const items: HomeTrustItem[] = [];
  for (const [index, item] of raw.entries()) {
    if (items.length >= 8) break;
    const row = item && typeof item === "object" ? (item as Partial<HomeTrustItem>) : {};
    const text = String(row.text || "").trim().slice(0, 80);
    if (!text) continue;
    items.push({
      id: String(row.id || `trust-${index + 1}`).trim().slice(0, 40) || `trust-${index + 1}`,
      text,
      enabled: row.enabled !== false,
    });
  }
  return items.length ? items : structuredClone(DEFAULT_TRUST_ITEMS);
}

function normalizeBusinesses(raw: unknown): HomeBusiness[] {
  const source = Array.isArray(raw) ? raw : DEFAULT_BUSINESSES;
  const items: HomeBusiness[] = [];
  for (const [index, item] of source.entries()) {
    if (items.length >= 6) break;
    const row = item && typeof item === "object" ? (item as Partial<HomeBusiness>) : {};
    const fallback = DEFAULT_BUSINESSES[index] || DEFAULT_BUSINESSES[0];
    const title = String(row.title || fallback?.title || "").trim().slice(0, 40);
    const href = String(row.href || fallback?.href || "").trim().slice(0, 300);
    if (!title || !href) continue;
    items.push({
      key: String(row.key || fallback?.key || `biz-${index + 1}`).trim().slice(0, 40),
      title,
      summary: String(row.summary || fallback?.summary || "").trim().slice(0, 240),
      href,
      ctaLabel: String(row.ctaLabel || fallback?.ctaLabel || "了解").trim().slice(0, 24) || "了解",
      secondaryHref: String(row.secondaryHref || "").trim().slice(0, 300) || undefined,
      secondaryLabel: String(row.secondaryLabel || "").trim().slice(0, 24) || undefined,
      icon: String(row.icon || fallback?.icon || "").trim().slice(0, 8) || undefined,
      featured: typeof row.featured === "boolean" ? row.featured : Boolean(fallback?.featured),
      enabled: row.enabled !== false,
      openInNewTab: Boolean(row.openInNewTab),
    });
  }
  return items.length ? items : structuredClone(DEFAULT_BUSINESSES);
}

function normalizeAcademicFocus(raw: unknown): HomeAcademicFocus {
  const row = raw && typeof raw === "object" ? (raw as Partial<HomeAcademicFocus>) : {};
  const base = DEFAULT_ACADEMIC_FOCUS;
  const points = Array.isArray(row.points)
    ? row.points
        .map((point) => ({
          title: String(point?.title || "").trim().slice(0, 40),
          text: String(point?.text || "").trim().slice(0, 120),
        }))
        .filter((point) => point.title || point.text)
        .slice(0, 6)
    : base.points;
  return {
    enabled: row.enabled !== false,
    eyebrow: String(row.eyebrow || base.eyebrow).trim().slice(0, 40) || base.eyebrow,
    title: String(row.title || base.title).trim().slice(0, 80) || base.title,
    summary: String(row.summary || base.summary).trim().slice(0, 400) || base.summary,
    points: points.length ? points : base.points,
    primaryLabel: String(row.primaryLabel || base.primaryLabel).trim().slice(0, 24) || base.primaryLabel,
    primaryHref: String(row.primaryHref || base.primaryHref).trim().slice(0, 300) || base.primaryHref,
    secondaryLabel: String(row.secondaryLabel || base.secondaryLabel).trim().slice(0, 24) || base.secondaryLabel,
    secondaryHref: String(row.secondaryHref || base.secondaryHref).trim().slice(0, 300) || base.secondaryHref,
    tertiaryLabel: String(row.tertiaryLabel || base.tertiaryLabel).trim().slice(0, 24) || base.tertiaryLabel,
    tertiaryHref: String(row.tertiaryHref || base.tertiaryHref).trim().slice(0, 300) || base.tertiaryHref,
  };
}

function normalizeIdList(raw: unknown, max = 24): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item || "").trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, max);
}

function normalizeContentFeed(raw: unknown): HomeContentFeed {
  const row = raw && typeof raw === "object" ? (raw as Partial<HomeContentFeed>) : {};
  const mode: HomeContentMode =
    row.mode === "manual" || row.mode === "hidden" || row.mode === "auto"
      ? row.mode
      : "auto";
  return {
    mode,
    courseIds: normalizeIdList(row.courseIds),
    meetupIds: normalizeIdList(row.meetupIds),
    postIds: normalizeIdList(row.postIds),
    articleIds: normalizeIdList(row.articleIds),
  };
}

function normalizeFooterCta(raw: unknown): HomeFooterCta {
  const row = raw && typeof raw === "object" ? (raw as Partial<HomeFooterCta>) : {};
  const base = DEFAULT_FOOTER_CTA;
  return {
    enabled: row.enabled !== false,
    title: String(row.title || base.title).trim().slice(0, 80) || base.title,
    body: String(row.body || base.body).trim().slice(0, 240) || base.body,
    primaryLabel: String(row.primaryLabel || base.primaryLabel).trim().slice(0, 24) || base.primaryLabel,
    primaryHref: String(row.primaryHref || base.primaryHref).trim().slice(0, 300) || base.primaryHref,
    secondaryLabel: String(row.secondaryLabel || base.secondaryLabel).trim().slice(0, 24) || base.secondaryLabel,
    secondaryHref: String(row.secondaryHref || base.secondaryHref).trim().slice(0, 300) || base.secondaryHref,
  };
}

/** 首页产品卡排序：精选在前，其次 homeRank，其余保持导航原顺序。 */
export function sortHomePortalLinks(links: PortalNavLink[]): PortalNavLink[] {
  return links
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const featured = Number(b.item.featuredOnHome === true) - Number(a.item.featuredOnHome === true);
      if (featured !== 0) return featured;
      const rankA = a.item.homeRank ?? 500;
      const rankB = b.item.homeRank ?? 500;
      if (rankA !== rankB) return rankA - rankB;
      return a.index - b.index;
    })
    .map((row) => row.item);
}

export function portalLinkStatus(item: PortalNavLink): PortalNavStatus {
  if (item.comingSoon || item.status === "soon") return "soon";
  if (item.status === "beta") return "beta";
  return "live";
}

export function parsePortal(raw: string | null | undefined): PortalConfig {
  if (!raw?.trim()) return structuredClone(DEFAULT_PORTAL);
  try {
    const parsed = JSON.parse(raw) as Partial<PortalConfig>;
    const nav = mergePortalNav(parsed.nav);

    return {
      nav: nav.length ? nav : structuredClone(DEFAULT_PORTAL.nav),
      company: normalizeAbout(parsed.company, DEFAULT_PORTAL.company),
      person: normalizeAbout(parsed.person, DEFAULT_PORTAL.person),
      contact: normalizeContact(parsed.contact),
      homeSectionOrder: normalizeHomeSectionOrder(parsed.homeSectionOrder),
      homeSectionChrome: normalizeSectionChromeMap(parsed.homeSectionChrome),
      trustItems: normalizeTrustItems(parsed.trustItems),
      businesses: normalizeBusinesses(parsed.businesses),
      academicFocus: normalizeAcademicFocus(parsed.academicFocus),
      contentFeed: normalizeContentFeed(parsed.contentFeed),
      footerCta: normalizeFooterCta(parsed.footerCta),
    };
  } catch {
    return structuredClone(DEFAULT_PORTAL);
  }
}

function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  const next: Partial<T> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) next[key as keyof T] = item as T[keyof T];
  }
  return next;
}

export type PortalUpdatePatch = {
  nav?: Array<Partial<PortalNavLink>>;
  company?: Partial<PortalAboutPage>;
  person?: Partial<PortalAboutPage>;
  contact?: Partial<PortalContact>;
  homeSectionOrder?: unknown;
  homeSectionChrome?: Partial<Record<HomeSectionId, HomeSectionChrome>>;
  trustItems?: HomeTrustItem[];
  businesses?: HomeBusiness[];
  academicFocus?: Partial<HomeAcademicFocus>;
  contentFeed?: Partial<HomeContentFeed>;
  footerCta?: Partial<HomeFooterCta>;
};

/**
 * 分区保存只带其中几项时，其余沿用已发布配置。
 * 导航按 key 合并，避免内容管理只改文案时冲掉首页精选等新字段。
 */
export function mergePortalUpdate(
  current: PortalConfig,
  patch: PortalUpdatePatch,
): PortalConfig {
  const nav = patch.nav
    ? patch.nav.map((item) => {
        const prev = current.nav.find((row) => row.key === item.key);
        return { ...(prev || {}), ...omitUndefined(item as Record<string, unknown>) };
      })
    : current.nav;
  return parsePortal(
    JSON.stringify({
      ...current,
      nav,
      company: patch.company
        ? {
            ...current.company,
            ...omitUndefined(patch.company as Record<string, unknown>),
            highlights: patch.company.highlights ?? current.company.highlights,
          }
        : current.company,
      person: patch.person
        ? {
            ...current.person,
            ...omitUndefined(patch.person as Record<string, unknown>),
            highlights: patch.person.highlights ?? current.person.highlights,
          }
        : current.person,
      contact: patch.contact
        ? { ...current.contact, ...omitUndefined(patch.contact as Record<string, unknown>) }
        : current.contact,
      homeSectionOrder:
        patch.homeSectionOrder !== undefined
          ? patch.homeSectionOrder
          : current.homeSectionOrder,
      homeSectionChrome: patch.homeSectionChrome
        ? { ...current.homeSectionChrome, ...patch.homeSectionChrome }
        : current.homeSectionChrome,
      trustItems: patch.trustItems ?? current.trustItems,
      businesses: patch.businesses ?? current.businesses,
      academicFocus: patch.academicFocus
        ? { ...current.academicFocus, ...omitUndefined(patch.academicFocus as unknown as Record<string, unknown>) }
        : current.academicFocus,
      contentFeed: patch.contentFeed
        ? { ...current.contentFeed, ...omitUndefined(patch.contentFeed as unknown as Record<string, unknown>) }
        : current.contentFeed,
      footerCta: patch.footerCta
        ? { ...current.footerCta, ...omitUndefined(patch.footerCta as unknown as Record<string, unknown>) }
        : current.footerCta,
    }),
  );
}

export function stringifyPortal(config: PortalConfig) {
  return JSON.stringify(config);
}

/** 正文按空行切成段落，供介绍页渲染 */
export function splitPortalBody(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
