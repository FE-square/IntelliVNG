/**
 * Structured Output 辅助函数
 * 
 * 用于处理不同模型对 structured output 的支持差异
 * 当 Mastra 的 structuredOutput 失败时，回退到 JSON 解析
 * 
 * 支持本地缓存机制，避免重复调用 LLM
 */
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============ 缓存配置 ============

const CACHE_DIR = path.join(process.cwd(), '.cache', 'llm');
const CACHE_ENABLED = process.env.LLM_CACHE_ENABLED !== 'false'; // 默认启用

// 确保缓存目录存在
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`[Cache] 创建缓存目录: ${CACHE_DIR}`);
  }
}

/**
 * 生成缓存键
 * 基于 agent name、prompt 和 schema 生成唯一的哈希值
 */
function generateCacheKey(agentName: string, prompt: string, schemaName?: string): string {
  const content = `${agentName}::${schemaName || 'default'}::${prompt}`;
  const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  return `${agentName}_${hash}`;
}

/**
 * 从缓存读取
 */
function readFromCache<T>(cacheKey: string): T | null {
  if (!CACHE_ENABLED) return null;
  
  ensureCacheDir();
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  if (fs.existsSync(cachePath)) {
    try {
      const content = fs.readFileSync(cachePath, 'utf-8');
      const cached = JSON.parse(content);
      console.log(`[Cache] ✅ 命中缓存: ${cacheKey}`);
      return cached.data as T;
    } catch (error) {
      console.warn(`[Cache] ⚠️ 读取缓存失败: ${cacheKey}`, error);
      return null;
    }
  }
  
  return null;
}

/**
 * 写入缓存
 */
function writeToCache<T>(cacheKey: string, data: T, metadata?: Record<string, any>): void {
  if (!CACHE_ENABLED) return;
  
  ensureCacheDir();
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  try {
    const cacheContent = {
      cacheKey,
      timestamp: new Date().toISOString(),
      metadata,
      data,
    };
    fs.writeFileSync(cachePath, JSON.stringify(cacheContent, null, 2), 'utf-8');
    console.log(`[Cache] 💾 已保存缓存: ${cacheKey}`);
  } catch (error) {
    console.warn(`[Cache] ⚠️ 写入缓存失败: ${cacheKey}`, error);
  }
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
  if (fs.existsSync(CACHE_DIR)) {
    const files = fs.readdirSync(CACHE_DIR);
    files.forEach(file => {
      fs.unlinkSync(path.join(CACHE_DIR, file));
    });
    console.log(`[Cache] 🗑️ 已清除 ${files.length} 个缓存文件`);
  }
}

/**
 * 获取缓存统计
 */
export function getCacheStats(): { count: number; size: number; files: string[] } {
  ensureCacheDir();
  const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
  let totalSize = 0;
  
  files.forEach(file => {
    const stat = fs.statSync(path.join(CACHE_DIR, file));
    totalSize += stat.size;
  });
  
  return {
    count: files.length,
    size: totalSize,
    files,
  };
}

/**
 * 从文本中提取 JSON 并验证
 */
export function extractAndValidateJson<T>(text: string, schema: z.ZodType<T, any, any>): T {
  // 尝试多种 JSON 提取方式
  const jsonPatterns = [
    // 完整的 JSON 代码块
    /```(?:json)?\s*([\s\S]*?)```/,
    // 以 { 开始的 JSON 对象
    /(\{[\s\S]*\})/,
    // 以 [ 开始的 JSON 数组
    /(\[[\s\S]*\])/,
  ];

  let jsonStr: string | null = null;

  for (const pattern of jsonPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      jsonStr = match[1].trim();
      break;
    }
  }

  if (!jsonStr) {
    throw new Error('无法从响应中提取 JSON');
  }

  // 清理 JSON 字符串（处理常见问题）
  jsonStr = jsonStr
    // 移除尾部逗号
    .replace(/,(\s*[}\]])/g, '$1')
    // 移除注释
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  try {
    const parsed = JSON.parse(jsonStr);
    return schema.parse(parsed);
  } catch (parseError) {
    // 尝试修复常见的 JSON 问题
    try {
      // 尝试使用更宽松的解析
      const relaxedJson = jsonStr
        .replace(/'/g, '"')  // 单引号替换为双引号
        .replace(/(\w+):/g, '"$1":');  // 未引用的键名
      
      const parsed = JSON.parse(relaxedJson);
      return schema.parse(parsed);
    } catch {
      throw new Error(`JSON 解析失败: ${parseError}`);
    }
  }
}

/**
 * 增强提示词，要求模型返回 JSON
 */
function enhancePromptForJson<T>(prompt: string, schema: z.ZodType<T, any, any>): string {
  // 尝试获取 schema 的描述
  let schemaDescription = '';
  try {
    // Zod schema 可能有 _def 属性
    const def = (schema as any)._def;
    if (def?.shape) {
      const keys = Object.keys(def.shape());
      schemaDescription = `JSON 对象应包含以下字段: ${keys.join(', ')}`;
    }
  } catch {
    // 忽略错误
  }

  return `${prompt}

重要：请直接返回 JSON 格式的响应，不要添加任何额外的文字说明。
${schemaDescription}
确保输出是有效的 JSON 格式。`;
}

/**
 * 使用 Agent 生成结构化输出的包装函数
 * 
 * 首先尝试使用 Mastra 的 structuredOutput，
 * 如果失败则回退到 JSON 解析
 * 
 * 支持缓存机制：
 * - 默认启用缓存（设置 LLM_CACHE_ENABLED=false 禁用）
 * - 缓存基于 agent name + prompt + schema 生成唯一键
 * - 成功解析后自动保存缓存
 */
export async function generateStructuredOutput<T>(
  agent: any,
  prompt: string,
  schema: z.ZodType<T, any, any>,
  options?: {
    maxSteps?: number;
    fallbackOnly?: boolean; // 是否只使用回退模式
    temperature?: number; // 模型温度参数
    cacheKey?: string; // 自定义缓存键（用于更细粒度的控制）
    skipCache?: boolean; // 跳过缓存（强制重新生成）
  }
): Promise<T> {
  const { maxSteps, fallbackOnly = false, temperature = 1, cacheKey: customCacheKey, skipCache = false } = options || {};

  // 获取 agent 名称和 schema 名称
  const agentName = agent.name || 'unknown-agent';
  const schemaName = (schema as any)._def?.typeName || 'schema';
  
  // 生成缓存键
  const cacheKey = customCacheKey || generateCacheKey(agentName, prompt, schemaName);
  
    // 检查缓存（除非明确跳过）
  if (!skipCache) {
    const cached = readFromCache<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  console.log(`[StructuredOutput] 🤖 调用 Agent: ${agentName}, Schema: ${schemaName}`);

  // 模型设置，用于支持 o1 等不支持 temperature=0 的模型
  const modelSettings = { temperature };
  
  let result: T;

  // 如果指定只使用回退模式，直接使用 JSON 解析
  if (fallbackOnly) {
    const enhancedPrompt = enhancePromptForJson(prompt, schema);
    const response = await agent.generate(enhancedPrompt, { modelSettings });
    result = extractAndValidateJson(response.text, schema);
    
    // 保存到缓存
    writeToCache(cacheKey, result, { agentName, schemaName, mode: 'fallback' });
    return result;
  }

  try {
    // 首先尝试 structuredOutput
    const response = await agent.generate(prompt, {
      structuredOutput: { schema },
      modelSettings,
      ...(maxSteps && { maxSteps }),
    });

    console.log(`[StructuredOutput] 📦 收到响应 (Length: ${response.text?.length || 0}, Object: ${!!response.object})`);

    // 检查返回值是否有效
    if (response.object !== undefined && response.object !== null) {
      result = response.object as T;
      
      // 保存到缓存
      writeToCache(cacheKey, result, { agentName, schemaName, mode: 'structured' });
      return result;
    }

    // 如果 object 无效，尝试从 text 解析（如果有）
    if (response.text) {
      console.warn('[StructuredOutput] object 为空，尝试从 text 解析 JSON');
      result = extractAndValidateJson(response.text, schema);
      
      // 保存到缓存
      writeToCache(cacheKey, result, { agentName, schemaName, mode: 'text-parse' });
      return result;
    }

    // 都没有，抛出错误触发回退
    throw new Error('structuredOutput 返回了空值');

  } catch (error) {
    // structuredOutput 失败，回退到 JSON 解析
    console.warn('[StructuredOutput] structuredOutput 失败，回退到纯文本 JSON 解析:', 
      error instanceof Error ? error.message : error);

    // 重新生成，使用增强的提示词要求返回 JSON
    const enhancedPrompt = enhancePromptForJson(prompt, schema);
    const response = await agent.generate(enhancedPrompt, { modelSettings });
    
    if (!response.text) {
      throw new Error('Agent 没有返回任何文本内容');
    }
    
    result = extractAndValidateJson(response.text, schema);
    
    // 保存到缓存
    writeToCache(cacheKey, result, { agentName, schemaName, mode: 'fallback-retry' });
    return result;
  }
}

