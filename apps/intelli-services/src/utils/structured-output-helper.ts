/**
 * Structured Output 辅助函数
 * 
 * 用于处理不同模型对 structured output 的支持差异
 * 当 Mastra 的 structuredOutput 失败时，回退到 JSON 解析
 */
import { z } from 'zod';

/**
 * 从文本中提取 JSON 并验证
 */
export function extractAndValidateJson<T>(text: string, schema: z.ZodType<T>): T {
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
function enhancePromptForJson<T>(prompt: string, schema: z.ZodType<T>): string {
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
 */
export async function generateStructuredOutput<T>(
  agent: any,
  prompt: string,
  schema: z.ZodType<T>,
  options?: {
    maxSteps?: number;
    fallbackOnly?: boolean; // 是否只使用回退模式
    temperature?: number; // 模型温度参数
  }
): Promise<T> {
  const { maxSteps, fallbackOnly = false, temperature = 1 } = options || {};

  // 模型设置，用于支持 o1 等不支持 temperature=0 的模型
  const modelSettings = { temperature };

  // 如果指定只使用回退模式，直接使用 JSON 解析
  if (fallbackOnly) {
    const enhancedPrompt = enhancePromptForJson(prompt, schema);
    const response = await agent.generate(enhancedPrompt, { modelSettings });
    return extractAndValidateJson(response.text, schema);
  }

  try {
    // 首先尝试 structuredOutput
    const response = await agent.generate(prompt, {
      structuredOutput: { schema },
      modelSettings,
      ...(maxSteps && { maxSteps }),
    });

    // 检查返回值是否有效
    if (response.object !== undefined && response.object !== null) {
      return response.object as T;
    }

    // 如果 object 无效，尝试从 text 解析（如果有）
    if (response.text) {
      console.warn('[StructuredOutput] object 为空，尝试从 text 解析 JSON');
      return extractAndValidateJson(response.text, schema);
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
    
    return extractAndValidateJson(response.text, schema);
  }
}

