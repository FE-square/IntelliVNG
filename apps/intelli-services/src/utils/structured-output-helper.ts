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
import { tokenTracker } from '../services/token-tracker';

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
function sanitizeControlCharacters(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/**
 * 预处理 LLM 返回的数据，修复常见的大小写问题
 * 
 * LLM 经常返回大写的 enum 值（如 "ENDING"），但 schema 期望小写
 * 这个函数会递归处理所有已知的 enum 字段
 */
function normalizeEnumValues(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // 处理数组
  if (Array.isArray(data)) {
    return data.map(item => normalizeEnumValues(item));
  }

  // 处理对象
  if (typeof data === 'object') {
    const result: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      let normalizedValue = value;
      
      // 处理特定的 enum 字段
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        
        switch (key) {
          // type 字段: scene | branch | ending
          case 'type':
            if (['scene', 'branch', 'ending'].includes(lowerValue)) {
              normalizedValue = lowerValue;
            }
            break;
            
          // branchType 字段: route | relationship | information | ending | identity
          case 'branchType':
            const branchTypeMap: Record<string, string> = {
              'route': 'route',
              'relationship': 'relationship',
              'information': 'information',
              'ending': 'ending',
              // 修复常见的 LLM 错误值
              'identity': 'information', // identity 映射到 information
              'choice': 'route',
              'path': 'route',
            };
            normalizedValue = branchTypeMap[lowerValue] || 'route'; // 默认为 route
            break;
            
          // functionTag 字段
          case 'functionTag':
            const functionTags = ['setup', 'rising', 'conflict', 'twist', 'climax', 'falling', 'resolution'];
            if (functionTags.includes(lowerValue)) {
              normalizedValue = lowerValue;
            }
            break;
            
          // severity 字段
          case 'severity':
            if (['minor', 'major', 'critical'].includes(lowerValue)) {
              normalizedValue = lowerValue;
            }
            break;
            
          // regenerateTarget 字段
          case 'regenerateTarget':
            if (['none', 'specific_nodes', 'all'].includes(lowerValue)) {
              normalizedValue = lowerValue;
            }
            break;
        }
      } else {
        // 递归处理嵌套对象/数组
        normalizedValue = normalizeEnumValues(value);
      }
      
      result[key] = normalizedValue;
    }
    
    return result;
  }

  // 其他类型直接返回
  return data;
}

export function extractAndValidateJson<T>(text: string, schema: z.ZodType<T, any, any>): T {
  /**
   * 说明：
   * LLM 经常输出多段 ```...``` 代码块、示例、解释文本等。
   * 如果我们“只取第一个代码块”很容易误抓到示例而非最终 JSON。
   * 这里改为：收集候选片段 -> 逐个尝试 JSON.parse + schema.parse，选第一个能通过的。
   */

  const candidates: string[] = [];

  // 1) 收集所有 ```json ... ``` 或 ``` ... ``` 代码块内容（可能有多个）
  const fenced = /```(?:json)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null = null;
  while ((m = fenced.exec(text)) !== null) {
    if (m[1]) candidates.push(m[1].trim());
  }

  // 2) 追加“看起来像 JSON 对象/数组”的最大跨度候选（贪婪匹配可能跨越过多文本，因此放后面尝试）
  const objectMatch = text.match(/(\{[\s\S]*\})/);
  if (objectMatch?.[1]) candidates.push(objectMatch[1].trim());
  const arrayMatch = text.match(/(\[[\s\S]*\])/);
  if (arrayMatch?.[1]) candidates.push(arrayMatch[1].trim());

  if (candidates.length === 0) {
    throw new Error('无法从响应中提取 JSON');
  }

  const normalizeAndParse = (raw: string): T => {
    // 清理 JSON 字符串（处理常见问题）
    const cleaned = sanitizeControlCharacters(
      raw
        // 移除尾部逗号
        .replace(/,(\s*[}\]])/g, '$1')
        // 移除注释
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
    );

    // 先严格解析
    try {
      const parsed = JSON.parse(cleaned);
      const normalized = normalizeEnumValues(parsed);
      return schema.parse(normalized);
    } catch (parseError) {
      // 再尝试宽松修复
      const relaxedJson = sanitizeControlCharacters(cleaned)
        .replace(/'/g, '"')
        .replace(/(\w+):/g, '"$1":');
      const parsed = JSON.parse(relaxedJson);
      const normalized = normalizeEnumValues(parsed);
      return schema.parse(normalized);
    }
  };

  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      return normalizeAndParse(candidate);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  throw new Error(`JSON 解析失败: ${errors[0] || '未知错误'}`);
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
 * 
 * 对于 Qwen 模型：
 * - 使用 jsonPromptInjection 模式通过 system prompt 注入 JSON 输出要求
 * - 参考：https://help.aliyun.com/zh/model-studio/qwen-structured-output
 */
function isQwenModel(modelId?: string): boolean {
  if (!modelId) {
    const envModel = process.env.OPENAI_MODEL_NAME || '';
    return envModel.toLowerCase().includes('qwen');
  }
  return modelId.toLowerCase().includes('qwen');
}

export async function generateStructuredOutput<T>(
  agent: any,
  prompt: string,
  schema: z.ZodType<T, any, any>,
  options?: {
    maxSteps?: number;
    fallbackOnly?: boolean; // 是否只使用回退模式（完全跳过 structuredOutput）
    temperature?: number; // 模型温度参数
    cacheKey?: string; // 自定义缓存键（用于更细粒度的控制）
    skipCache?: boolean; // 跳过缓存（强制重新生成）
    disableStructuredOutput?: boolean; // 强制禁用 structuredOutput
  }
): Promise<T> {
  const {
    maxSteps,
    fallbackOnly: fallbackOnlyOption = false,
    temperature = 1,
    cacheKey: customCacheKey,
    skipCache = false,
    disableStructuredOutput,
  } = options || {};

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

  // 检测模型类型
  const agentModelId = agent?.model?.id || agent?.modelId || '';
  const useQwenMode = isQwenModel(agentModelId);
  const fallbackOnly = fallbackOnlyOption || disableStructuredOutput === true;

  console.log(`[StructuredOutput] 🤖 调用 Agent: ${agentName}, Schema: ${schemaName}, QwenMode: ${useQwenMode}`);

  // 模型设置，用于支持 o1 等不支持 temperature=0 的模型
  const modelSettings = { temperature };
  
  let result: T;

  // 如果明确指定 fallbackOnly，使用老的纯 JSON 解析模式
  if (fallbackOnly) {
    console.warn('[StructuredOutput] 使用纯文本 JSON 解析模式（fallbackOnly）');
    const enhancedPrompt = enhancePromptForJson(prompt, schema);
    const response = await agent.generate(enhancedPrompt, { modelSettings });
    
    // ✅ 追踪 Token 使用
    tokenTracker.trackMastraAgent({
      agentName,
      model: 'unknown',  // 从 agent 配置获取
      response,
      operation: `structured-output.${schemaName}.fallback`,
    });
    
    result = extractAndValidateJson(response.text, schema);
    
    // 保存到缓存
    writeToCache(cacheKey, result, { agentName, schemaName, mode: 'fallback' });
    return result;
  }

  try {
    // 构建 structuredOutput 选项
    // 对于 Qwen 模型，使用 jsonPromptInjection 模式
    // 参考：https://help.aliyun.com/zh/model-studio/qwen-structured-output
    const structuredOutputOptions: { schema: z.ZodType<T, any, any>; jsonPromptInjection?: boolean } = { schema };
    
    if (useQwenMode) {
      // Qwen 模型不支持原生 response_format schema，使用 jsonPromptInjection
      // 这会让 Mastra 在 system prompt 中注入 JSON 输出要求
      structuredOutputOptions.jsonPromptInjection = true;
      console.log('[StructuredOutput] 🔄 Qwen 模型：使用 jsonPromptInjection 模式');
    }
    
    // 使用 structuredOutput
    const response = await agent.generate(prompt, {
      structuredOutput: structuredOutputOptions,
      modelSettings,
      ...(maxSteps && { maxSteps }),
    });

    // ✅ 追踪 Token 使用
    tokenTracker.trackMastraAgent({
      agentName,
      model: 'unknown',
      response,
      operation: `structured-output.${schemaName}.main`,
    });

    console.log(`[StructuredOutput] 📦 收到响应 (Length: ${response.text?.length || 0}, Object: ${!!response.object})`);

    // 检查返回值是否有效
    if (response.object !== undefined && response.object !== null) {
      // 预处理：修复 LLM 返回的大小写问题（即使是 structuredOutput 也可能有问题）
      const normalized = normalizeEnumValues(response.object);
      // 重新验证 schema
      result = schema.parse(normalized) as T;
      
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
    
    // ✅ 追踪 Token 使用
    tokenTracker.trackMastraAgent({
      agentName,
      model: 'unknown',
      response,
      operation: `structured-output.${schemaName}.retry`,
    });
    
    if (!response.text) {
      throw new Error('Agent 没有返回任何文本内容');
    }
    
    result = extractAndValidateJson(response.text, schema);
    
    // 保存到缓存
    writeToCache(cacheKey, result, { agentName, schemaName, mode: 'fallback-retry' });
    return result;
  }
}

