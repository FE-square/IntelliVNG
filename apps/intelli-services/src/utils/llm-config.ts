import type { AgentModel } from "@mastra/core/agent";

export type LLMProfile = 'primary' | 'backup';

interface EnvConfig {
  apiKey?: string;
  baseURL?: string;
  modelName?: string;
}

const ENV_KEY_MAP: Record<LLMProfile, { apiKey: string; baseURL: string; model: string }> = {
  primary: {
    apiKey: 'OPENAI_API_KEY',
    baseURL: 'OPENAI_BASE_URL',
    model: 'OPENAI_MODEL_NAME',
  },
  backup: {
    apiKey: 'OPENAI_API_KEY_BACKUP',
    baseURL: 'OPENAI_BASE_URL_BACKUP',
    model: 'OPENAI_MODEL_NAME_BACKUP',
  },
};

function readEnvConfig(profile: LLMProfile): EnvConfig {
  const keys = ENV_KEY_MAP[profile];
  return {
    apiKey: process.env[keys.apiKey],
    baseURL: process.env[keys.baseURL],
    modelName: process.env[keys.model],
  };
}

export function hasLLMProfile(profile: LLMProfile): boolean {
  return Boolean(readEnvConfig(profile).apiKey);
}

export function resolveLLMConfig(profile: LLMProfile = 'primary'): Required<EnvConfig> {
  const primary = readEnvConfig(profile);
  const fallbackModelName =
    primary.modelName ||
    readEnvConfig('primary').modelName ||
    'gpt-4.1';

  if (!primary.apiKey) {
    throw new Error(`缺少 ${ENV_KEY_MAP[profile].apiKey}，无法初始化 LLM 配置`);
  }

  return {
    apiKey: primary.apiKey,
    baseURL: primary.baseURL || readEnvConfig('primary').baseURL,
    modelName: fallbackModelName,
  };
}

export function buildMastraModelConfig(profile: LLMProfile = 'primary'): AgentModel {
  const cfg = resolveLLMConfig(profile);
  return {
    id: `openai/${cfg.modelName}` as `${string}/${string}`,
    url: cfg.baseURL,
    apiKey: cfg.apiKey,
  };
}

const RECOVERABLE_ERROR_KEYWORDS = [
  'cannot connect',
  'und_err_socket',
  'socket hang up',
  'timeout',
  'timed out',
  'fetch failed',
  '502',
  '503',
  'connection closed',
];

export function isRecoverableLLMError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message?.toLowerCase() || '';
  if (message.includes('json 解析失败') || message.includes('bad control character')) {
    return false;
  }
  if ((error as any).name === 'AI_APICallError') {
    return true;
  }
  if (RECOVERABLE_ERROR_KEYWORDS.some((kw) => message.includes(kw))) {
    return true;
  }
  const causeCode = (error as any)?.cause?.code;
  if (causeCode && ['UND_ERR_SOCKET', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(causeCode)) {
    return true;
  }
  return false;
}

