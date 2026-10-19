/**
 * 全站共用的 AI 提供商与模型目录。
 * 主站系统设置和象棋后台都读这里，不要在页面里再抄一份。
 * 模型 ID 按各厂商 2026-10-01 的官方文档核对；下拉只给 active。
 */

export type AiProtocol =
  | "openai-responses"
  | "anthropic-messages"
  | "gemini"
  | "openai-chat"
  | "azure-openai"
  | "vertex"
  | "bedrock"
  | "cohere";

export type AiModelStatus = "active" | "deprecated" | "retired";
export type AiModelTier = "flagship" | "balanced" | "fast";
export type AiProviderRegion = "cn" | "global" | "both";

export interface CatalogModel {
  id: string;
  displayName: string;
  provider: string;
  status: AiModelStatus;
  tier: AiModelTier;
  reasoning: boolean;
  structuredOutput: boolean;
  lastVerifiedAt: string;
  vision?: boolean;
}

export interface CatalogProvider {
  id: string;
  name: string;
  region: AiProviderRegion;
  protocol: AiProtocol;
  baseUrl: string;
  applyUrl: string;
  docsUrl: string;
  credentials: string;
  /** 官方接入步骤，只链到官方控制台和文档。 */
  steps: string[];
  /** 有官方 Models API 时，刷新会拉 live 列表。 */
  modelsApi: "openai" | "anthropic" | "gemini" | "none";
  /** 允许手填模型 ID（Azure 部署名、自定义端点）。 */
  allowCustomModel: boolean;
  /** 思考参数怎么放进请求。不按厂商名字在业务里分支。 */
  reasoningWire?: "none" | "responses" | "chat-effort" | "deepseek-thinking";
  supportedReasoningEfforts?: string[];
  defaultReasoningEffort?: string;
  recommendedMaxOutputTokens?: number;
  supportsToolCalling?: boolean;
  models: CatalogModel[];
}

const VERIFIED = "2026-10-01";

function model(
  provider: string,
  id: string,
  displayName: string,
  status: AiModelStatus,
  tier: AiModelTier,
  flags: { reasoning?: boolean; structuredOutput?: boolean; vision?: boolean } = {},
): CatalogModel {
  return {
    id,
    displayName,
    provider,
    status,
    tier,
    reasoning: Boolean(flags.reasoning),
    structuredOutput: flags.structuredOutput !== false,
    lastVerifiedAt: VERIFIED,
    vision: flags.vision,
  };
}

const STEPS = ["打开官方控制台申请凭据", "把凭据填进对应提供商，不要覆盖其他家", "刷新模型列表", "选择 active 模型", "测试连接"];

export const AI_CATALOG: CatalogProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    region: "global",
    protocol: "openai-responses",
    baseUrl: "https://api.openai.com/v1",
    applyUrl: "https://platform.openai.com/api-keys",
    docsUrl: "https://developers.openai.com/api/docs/models",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: false,
    models: [
      model("openai", "gpt-6-astra", "GPT-6 Astra", "active", "flagship", { reasoning: true, vision: true }),
      model("openai", "gpt-6.1-sol", "GPT-6.1 Sol", "active", "balanced", { reasoning: true, vision: true }),
      model("openai", "gpt-6-luna", "GPT-6 Luna", "active", "fast", { reasoning: true, vision: true }),
      model("openai", "gpt-5.6-sol", "GPT-5.6 Sol", "active", "flagship", { reasoning: true, vision: true }),
      model("openai", "gpt-5.6-terra", "GPT-5.6 Terra", "active", "balanced", { reasoning: true, vision: true }),
      model("openai", "gpt-5.6-luna", "GPT-5.6 Luna", "active", "fast", { reasoning: true, vision: true }),
      model("openai", "gpt-5", "GPT-5", "deprecated", "flagship", { reasoning: true, vision: true }),
      model("openai", "gpt-4o", "GPT-4o", "retired", "balanced", { vision: true }),
      model("openai", "gpt-4o-mini", "GPT-4o mini", "retired", "fast", { vision: true }),
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    region: "global",
    protocol: "anthropic-messages",
    baseUrl: "https://api.anthropic.com",
    applyUrl: "https://console.anthropic.com/settings/keys",
    docsUrl: "https://platform.claude.com/docs/en/about-claude/models",
    credentials: "API Key（x-api-key）",
    steps: STEPS,
    modelsApi: "anthropic",
    allowCustomModel: false,
    models: [
      model("anthropic", "claude-fable-5-1", "Claude Fable 5.1", "active", "flagship", { reasoning: true, vision: true }),
      model("anthropic", "claude-opus-5", "Claude Opus 5", "active", "flagship", { reasoning: true, vision: true }),
      model("anthropic", "claude-sonnet-5-5", "Claude Sonnet 5.5", "active", "balanced", { reasoning: true, vision: true }),
      model("anthropic", "claude-sonnet-5", "Claude Sonnet 5", "active", "balanced", { reasoning: true, vision: true }),
      model("anthropic", "claude-haiku-4-5", "Claude Haiku 4.5", "active", "fast", { reasoning: true, vision: true }),
      model("anthropic", "claude-sonnet-4-5", "Claude Sonnet 4.5", "deprecated", "balanced", { reasoning: true, vision: true }),
      model("anthropic", "claude-3-5-sonnet-latest", "Claude 3.5 Sonnet", "retired", "balanced", { vision: true }),
    ],
  },
  {
    id: "google-gemini",
    name: "Google Gemini",
    region: "global",
    protocol: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    applyUrl: "https://aistudio.google.com/apikey",
    docsUrl: "https://ai.google.dev/gemini-api/docs/models",
    credentials: "API Key（query key）",
    steps: STEPS,
    modelsApi: "gemini",
    allowCustomModel: false,
    models: [
      model("google-gemini", "gemini-2.5-pro", "Gemini 2.5 Pro", "active", "flagship", { reasoning: true, vision: true }),
      model("google-gemini", "gemini-2.5-flash", "Gemini 2.5 Flash", "active", "balanced", { reasoning: true, vision: true }),
      model("google-gemini", "gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite", "active", "fast", { reasoning: true, vision: true }),
      model("google-gemini", "gemini-2.0-flash", "Gemini 2.0 Flash", "deprecated", "fast", { vision: true }),
    ],
  },
  {
    id: "google-vertex",
    name: "Google Vertex AI",
    region: "global",
    protocol: "vertex",
    baseUrl: "https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT/locations/us-central1/publishers/google",
    applyUrl: "https://console.cloud.google.com/vertex-ai",
    docsUrl: "https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference",
    credentials: "Bearer 访问令牌。Base URL 里换成自己的项目和区域。",
    steps: STEPS,
    modelsApi: "none",
    allowCustomModel: true,
    models: [
      model("google-vertex", "gemini-2.5-pro", "Gemini 2.5 Pro", "active", "flagship", { reasoning: true, vision: true }),
      model("google-vertex", "gemini-2.5-flash", "Gemini 2.5 Flash", "active", "balanced", { reasoning: true, vision: true }),
    ],
  },
  {
    id: "xai-grok",
    name: "xAI Grok",
    region: "global",
    protocol: "openai-chat",
    baseUrl: "https://api.x.ai/v1",
    applyUrl: "https://console.x.ai/",
    docsUrl: "https://docs.x.ai/developers/models",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: false,
    models: [
      model("xai-grok", "grok-4.6", "Grok 4.6", "active", "flagship", { reasoning: true, vision: true }),
      model("xai-grok", "grok-4.5", "Grok 4.5", "active", "balanced", { reasoning: true, vision: true }),
      model("xai-grok", "grok-4.3", "Grok 4.3", "active", "fast", { reasoning: true, vision: true }),
      model("xai-grok", "grok-4", "Grok 4", "deprecated", "flagship", { reasoning: true, vision: true }),
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    region: "global",
    protocol: "openai-chat",
    baseUrl: "https://api.mistral.ai/v1",
    applyUrl: "https://console.mistral.ai/api-keys",
    docsUrl: "https://docs.mistral.ai/models/mistral-large-3-25-12",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: false,
    models: [
      model("mistral", "mistral-large-2512", "Mistral Large 3", "active", "flagship", { vision: true }),
    ],
  },
  {
    id: "cohere",
    name: "Cohere",
    region: "global",
    protocol: "cohere",
    baseUrl: "https://api.cohere.com",
    applyUrl: "https://dashboard.cohere.com/api-keys",
    docsUrl: "https://docs.cohere.com/docs/models",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "none",
    allowCustomModel: true,
    models: [
      model("cohere", "command-a-03-2025", "Command A", "active", "flagship"),
      model("cohere", "command-r-plus", "Command R+", "deprecated", "balanced"),
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    region: "global",
    protocol: "openai-chat",
    baseUrl: "https://openrouter.ai/api/v1",
    applyUrl: "https://openrouter.ai/keys",
    docsUrl: "https://openrouter.ai/docs/guides/overview/models",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: true,
    models: [
      model("openrouter", "openai/gpt-6-astra", "OpenAI GPT-6 Astra", "active", "flagship", { reasoning: true, vision: true }),
      model("openrouter", "anthropic/claude-sonnet-5-5", "Claude Sonnet 5.5", "active", "balanced", { reasoning: true, vision: true }),
      model("openrouter", "google/gemini-2.5-pro", "Gemini 2.5 Pro", "active", "flagship", { reasoning: true, vision: true }),
      model("openrouter", "x-ai/grok-4.6", "Grok 4.6", "active", "flagship", { reasoning: true, vision: true }),
      model("openrouter", "deepseek/deepseek-v4-pro", "DeepSeek V4 Pro", "active", "flagship", { reasoning: true }),
      model("openrouter", "openai/gpt-4o-mini", "GPT-4o mini", "retired", "fast", { vision: true }),
    ],
  },
  {
    id: "groq",
    name: "Groq",
    region: "global",
    protocol: "openai-chat",
    baseUrl: "https://api.groq.com/openai/v1",
    applyUrl: "https://console.groq.com/keys",
    docsUrl: "https://console.groq.com/docs/models",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: false,
    models: [
      model("groq", "llama-3.3-70b-versatile", "Llama 3.3 70B", "active", "balanced"),
      model("groq", "mixtral-8x7b-32768", "Mixtral 8x7B", "deprecated", "fast"),
    ],
  },
  {
    id: "together",
    name: "Together AI",
    region: "global",
    protocol: "openai-chat",
    baseUrl: "https://api.together.xyz/v1",
    applyUrl: "https://api.together.ai/settings/api-keys",
    docsUrl: "https://docs.together.ai/docs/serverless-models",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: true,
    models: [
      model("together", "meta-llama/Llama-3.3-70B-Instruct-Turbo", "Llama 3.3 70B Turbo", "active", "balanced"),
      model("together", "Qwen/Qwen2.5-72B-Instruct-Turbo", "Qwen2.5 72B", "deprecated", "balanced"),
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    region: "global",
    protocol: "openai-chat",
    baseUrl: "https://api.perplexity.ai",
    applyUrl: "https://www.perplexity.ai/settings/api",
    docsUrl: "https://docs.perplexity.ai/docs/getting-started/models",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "none",
    allowCustomModel: true,
    models: [
      model("perplexity", "sonar-pro", "Sonar Pro", "active", "flagship"),
      model("perplexity", "sonar", "Sonar", "active", "fast"),
    ],
  },
  {
    id: "azure-openai",
    name: "Azure OpenAI",
    region: "global",
    protocol: "azure-openai",
    baseUrl: "https://YOUR_RESOURCE.openai.azure.com",
    applyUrl: "https://portal.azure.com/",
    docsUrl: "https://learn.microsoft.com/azure/ai-services/openai/reference",
    credentials: "资源密钥（api-key）。模型填部署名，不是裸模型名。",
    steps: STEPS,
    modelsApi: "none",
    allowCustomModel: true,
    models: [
      model("azure-openai", "gpt-6-astra", "部署名示例 gpt-6-astra", "active", "flagship", { reasoning: true, vision: true }),
    ],
  },
  {
    id: "aws-bedrock",
    name: "AWS Bedrock",
    region: "global",
    protocol: "bedrock",
    baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
    applyUrl: "https://console.aws.amazon.com/bedrock/home",
    docsUrl: "https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html",
    credentials: "Bedrock API Key（Bearer）。Base URL 里的区域要和密钥一致。",
    steps: STEPS,
    modelsApi: "none",
    allowCustomModel: true,
    models: [
      model("aws-bedrock", "anthropic.claude-sonnet-5-5", "Claude Sonnet 5.5", "active", "balanced", { reasoning: true, vision: true }),
      model("aws-bedrock", "anthropic.claude-opus-5", "Claude Opus 5", "active", "flagship", { reasoning: true, vision: true }),
    ],
  },
  {
    id: "aliyun-dashscope",
    name: "阿里云百炼 / Qwen",
    region: "cn",
    protocol: "openai-chat",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    applyUrl: "https://bailian.console.aliyun.com/",
    docsUrl: "https://help.aliyun.com/zh/model-studio/models",
    credentials: "DashScope API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: true,
    models: [
      model("aliyun-dashscope", "qwen3.8-max", "Qwen3.8 Max", "active", "flagship", { reasoning: true, vision: true }),
      model("aliyun-dashscope", "qwen3.7-plus", "Qwen3.7 Plus", "active", "balanced", { reasoning: true, vision: true }),
      model("aliyun-dashscope", "qwen3.8-flash", "Qwen3.8 Flash", "active", "fast", { reasoning: true, vision: true }),
      model("aliyun-dashscope", "qwen-vl-max", "Qwen-VL Max", "deprecated", "flagship", { vision: true }),
      model("aliyun-dashscope", "qwen-max", "Qwen Max", "deprecated", "flagship"),
      model("aliyun-dashscope", "qwen-plus", "Qwen Plus", "deprecated", "balanced"),
      model("aliyun-dashscope", "qwen-turbo", "Qwen Turbo", "retired", "fast"),
    ],
  },
  {
    id: "volcengine-ark",
    name: "火山方舟 / 豆包",
    region: "cn",
    protocol: "openai-chat",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    applyUrl: "https://console.volcengine.com/ark",
    docsUrl: "https://www.volcengine.com/docs/82379/1099455",
    credentials: "方舟 API Key（Bearer）。也可填推理接入点 ep-。",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: true,
    models: [
      model("volcengine-ark", "doubao-seed-evolving", "Doubao Seed Evolving", "active", "flagship", { reasoning: true }),
      model("volcengine-ark", "doubao-1-5-pro-32k", "Doubao 1.5 Pro", "deprecated", "balanced"),
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    region: "cn",
    protocol: "openai-chat",
    baseUrl: "https://api.deepseek.com",
    applyUrl: "https://platform.deepseek.com/api_keys",
    docsUrl: "https://api-docs.deepseek.com/quick_start/pricing",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: false,
    reasoningWire: "deepseek-thinking",
    supportedReasoningEfforts: ["low", "high", "max"],
    defaultReasoningEffort: "low",
    recommendedMaxOutputTokens: 16384,
    supportsToolCalling: true,
    models: [
      model("deepseek", "deepseek-v4-pro", "DeepSeek V4 Pro", "active", "flagship", { reasoning: true }),
      model("deepseek", "deepseek-flash", "DeepSeek V4.1 Flash", "active", "fast", { reasoning: true, vision: true }),
      model("deepseek", "deepseek-chat", "deepseek-chat", "retired", "balanced"),
      model("deepseek", "deepseek-reasoner", "deepseek-reasoner", "retired", "flagship", { reasoning: true }),
      model("deepseek", "deepseek-v4-flash-vision-exp", "V4 Flash Vision（已退役）", "retired", "fast", { vision: true }),
    ],
  },
  {
    id: "zhipu-glm",
    name: "智谱 GLM",
    region: "cn",
    protocol: "openai-chat",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    applyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    docsUrl: "https://docs.bigmodel.cn/cn/guide/start/model-overview",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: true,
    models: [
      model("zhipu-glm", "glm-5", "GLM-5", "active", "flagship", { reasoning: true }),
      model("zhipu-glm", "glm-4.5-air", "GLM-4.5 Air", "active", "fast"),
      model("zhipu-glm", "glm-4v-plus", "GLM-4V Plus", "deprecated", "balanced", { vision: true }),
      model("zhipu-glm", "glm-4-flash", "GLM-4 Flash", "deprecated", "fast"),
    ],
  },
  {
    id: "moonshot",
    name: "月之暗面 Kimi",
    region: "cn",
    protocol: "openai-chat",
    baseUrl: "https://api.moonshot.cn/v1",
    applyUrl: "https://platform.moonshot.cn/console/api-keys",
    docsUrl: "https://platform.moonshot.cn/docs/api/chat",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: true,
    models: [
      model("moonshot", "kimi-latest", "Kimi Latest", "active", "flagship", { reasoning: true }),
      model("moonshot", "moonshot-v1-8k", "Moonshot v1 8K", "deprecated", "fast"),
      model("moonshot", "moonshot-v1-128k", "Moonshot v1 128K", "deprecated", "balanced"),
    ],
  },
  {
    id: "baidu-qianfan",
    name: "百度千帆 / ERNIE",
    region: "cn",
    protocol: "openai-chat",
    baseUrl: "https://qianfan.baidubce.com/v2",
    applyUrl: "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
    docsUrl: "https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j",
    credentials: "千帆 API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: true,
    models: [
      model("baidu-qianfan", "ernie-4.5-turbo-128k", "ERNIE 4.5 Turbo", "active", "flagship"),
      model("baidu-qianfan", "ernie-4.0-8k", "ERNIE 4.0", "deprecated", "balanced"),
    ],
  },
  {
    id: "tencent-hunyuan",
    name: "腾讯混元",
    region: "cn",
    protocol: "openai-chat",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    applyUrl: "https://console.cloud.tencent.com/hunyuan/api-key",
    docsUrl: "https://cloud.tencent.com/document/product/1729/101832",
    credentials: "混元 API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: true,
    models: [
      model("tencent-hunyuan", "hunyuan-t1-latest", "混元 T1", "active", "flagship", { reasoning: true }),
      model("tencent-hunyuan", "hunyuan-turbos-latest", "混元 TurboS", "active", "fast"),
    ],
  },
  {
    id: "minimax",
    name: "MiniMax",
    region: "cn",
    protocol: "openai-chat",
    baseUrl: "https://api.minimaxi.com/v1",
    applyUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    docsUrl: "https://platform.minimaxi.com/docs/api-reference/text-openai-api",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: true,
    models: [
      model("minimax", "MiniMax-M2.5", "MiniMax M2.5", "active", "flagship", { reasoning: true }),
      model("minimax", "MiniMax-Text-01", "MiniMax Text 01", "deprecated", "balanced"),
    ],
  },
  {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow",
    region: "cn",
    protocol: "openai-chat",
    baseUrl: "https://api.siliconflow.cn/v1",
    applyUrl: "https://cloud.siliconflow.cn/account/ak",
    docsUrl: "https://docs.siliconflow.cn/cn/api-reference/models/get-model-list",
    credentials: "API Key（Bearer）",
    steps: STEPS,
    modelsApi: "openai",
    allowCustomModel: true,
    models: [
      model("siliconflow", "Qwen/Qwen3.6-27B", "Qwen3.6 27B", "active", "balanced", { reasoning: true }),
      model("siliconflow", "zai-org/GLM-5.2", "GLM-5.2", "active", "flagship", { reasoning: true }),
      model("siliconflow", "tencent/Hy4-preview", "混元 Hy4 Preview", "active", "flagship", { reasoning: true }),
    ],
  },
  {
    id: "custom",
    name: "自定义 OpenAI-Compatible",
    region: "both",
    protocol: "openai-chat",
    baseUrl: "",
    applyUrl: "",
    docsUrl: "",
    credentials: "该端点要求的 API Key（Bearer）",
    steps: ["向端点提供方拿到 Base URL 和 Key", "填入后刷新模型", "选择模型并测试连接"],
    modelsApi: "openai",
    allowCustomModel: true,
    models: [],
  },
];

const BY_ID = new Map(AI_CATALOG.map((item) => [item.id, item]));

export function catalogProvider(id: string): CatalogProvider | undefined {
  return BY_ID.get(id);
}

export function catalogModel(providerId: string, modelId: string): CatalogModel | undefined {
  return catalogProvider(providerId)?.models.find((item) => item.id === modelId);
}

/** 新选择列表。liveIds 来自 Models API 时，退役型号仍排除，新 ID 会补进来。 */
export function selectableModels(providerId: string, liveIds?: readonly string[]): CatalogModel[] {
  const provider = catalogProvider(providerId);
  if (!provider) return [];
  const known = new Map(provider.models.map((item) => [item.id, item]));
  if (!liveIds) {
    return provider.models.filter((item) => item.status === "active");
  }
  const out: CatalogModel[] = [];
  const seen = new Set<string>();
  for (const id of liveIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const found = known.get(id);
    if (found && found.status !== "active") continue;
    out.push(found ?? model(providerId, id, id, "active", "balanced"));
  }
  return out;
}

export function flagshipModel(providerId: string): CatalogModel | undefined {
  const active = selectableModels(providerId);
  return active.find((item) => item.tier === "flagship") ?? active[0];
}

export function providerByBaseUrl(baseUrl: string): CatalogProvider {
  const base = baseUrl.trim().replace(/\/+$/, "");
  return AI_CATALOG.find((item) => item.baseUrl && item.baseUrl.replace(/\/+$/, "") === base) ?? BY_ID.get("custom")!;
}

export interface VaultProvider {
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModel: string;
  timeoutMs: number;
  maxRetries: number;
}

export function parseProviderVault(raw: string | null | undefined): { activeProvider: string; providers: Record<string, VaultProvider> } {
  const empty = { activeProvider: "", providers: {} as Record<string, VaultProvider> };
  if (!raw?.trim()) return empty;
  try {
    const parsed = JSON.parse(raw) as { activeProvider?: string; providers?: Record<string, Partial<VaultProvider>> };
    const providers: Record<string, VaultProvider> = {};
    for (const [id, row] of Object.entries(parsed.providers ?? {})) {
      if (!catalogProvider(id) || !row) continue;
      providers[id] = {
        baseUrl: String(row.baseUrl || catalogProvider(id)?.baseUrl || "").slice(0, 300),
        apiKey: String(row.apiKey || ""),
        model: String(row.model || "").slice(0, 120),
        fallbackModel: String(row.fallbackModel || "").slice(0, 120),
        timeoutMs: Number(row.timeoutMs) || 45000,
        maxRetries: Number(row.maxRetries ?? 1),
      };
    }
    return { activeProvider: String(parsed.activeProvider || ""), providers };
  } catch {
    return empty;
  }
}

export function mergeProviderVault(
  currentRaw: string,
  incoming: { activeProvider?: string; providers?: Record<string, Partial<VaultProvider>> } | undefined,
  masked: (value: string) => boolean,
): string {
  const current = parseProviderVault(currentRaw);
  if (!incoming?.providers) return currentRaw || "";
  for (const [id, row] of Object.entries(incoming.providers)) {
    if (!catalogProvider(id) || !row) continue;
    const prev = current.providers[id];
    const key = String(row.apiKey || "");
    current.providers[id] = {
      baseUrl: String(row.baseUrl ?? prev?.baseUrl ?? catalogProvider(id)?.baseUrl ?? "").slice(0, 300),
      apiKey: !key || masked(key) ? (prev?.apiKey || "") : key.trim(),
      model: String(row.model ?? prev?.model ?? "").slice(0, 120),
      fallbackModel: String(row.fallbackModel ?? prev?.fallbackModel ?? "").slice(0, 120),
      timeoutMs: Number(row.timeoutMs ?? prev?.timeoutMs ?? 45000),
      maxRetries: Number(row.maxRetries ?? prev?.maxRetries ?? 1),
    };
  }
  if (incoming.activeProvider && catalogProvider(incoming.activeProvider)) {
    current.activeProvider = incoming.activeProvider;
  }
  return JSON.stringify(current);
}

export const LEGACY_MAX_OUTPUT_TOKENS = 800;

export interface ModelCapabilities {
  supportsReasoning: boolean;
  supportedReasoningEfforts: string[];
  defaultReasoningEffort: string;
  recommendedMaxOutputTokens: number;
  supportsJsonOutput: boolean;
  supportsToolCalling: boolean;
  reasoningWire: "none" | "responses" | "chat-effort" | "deepseek-thinking";
}

export function modelCapabilities(providerId: string, modelId: string): ModelCapabilities {
  const provider = catalogProvider(providerId);
  const known = catalogModel(providerId, modelId);
  const supportsReasoning = Boolean(known?.reasoning);
  const wire = provider?.reasoningWire
    ?? (provider?.protocol === "openai-responses" ? "responses" : "none");
  return {
    supportsReasoning,
    supportedReasoningEfforts: provider?.supportedReasoningEfforts ?? (supportsReasoning ? ["low", "medium", "high"] : []),
    defaultReasoningEffort: provider?.defaultReasoningEffort ?? (supportsReasoning ? "low" : ""),
    recommendedMaxOutputTokens: provider?.recommendedMaxOutputTokens ?? LEGACY_MAX_OUTPUT_TOKENS,
    supportsJsonOutput: known?.structuredOutput !== false,
    supportsToolCalling: Boolean(provider?.supportsToolCalling),
    reasoningWire: wire,
  };
}

/** 旧默认 800 对思考模型太小。站长改过的值保持不变。 */
export function resolveMaxOutputTokens(configured: number, caps: ModelCapabilities): number {
  if (!configured || configured === LEGACY_MAX_OUTPUT_TOKENS) {
    return Math.max(configured || 0, caps.recommendedMaxOutputTokens);
  }
  return configured;
}

export function modelIsSelectable(providerId: string, modelId: string): boolean {
  if (!modelId) return false;
  const provider = catalogProvider(providerId);
  if (!provider) return false;
  if (provider.allowCustomModel && !catalogModel(providerId, modelId)) return true;
  return selectableModels(providerId).some((item) => item.id === modelId);
}
