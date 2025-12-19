/**
 * 测试 Qwen 模型的结构化输出
 * 
 * 使用方法:
 *   npx tsx src/tests/test-qwen-structured-output.ts
 * 
 * 确保环境变量设置：
 *   - OPENAI_API_KEY: 阿里云 API Key
 *   - OPENAI_BASE_URL: 阿里云 API 地址 (https://dashscope.aliyuncs.com/compatible-mode/v1)
 *   - OPENAI_MODEL_NAME: Qwen 模型名称 (如 qwen-plus, qwen-turbo, qwen-max)
 * 
 * 测试说明：
 *   本测试验证 generateStructuredOutput 函数对 Qwen 模型的支持
 *   通过 jsonPromptInjection 模式实现结构化输出
 */

import 'dotenv/config';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { generateStructuredOutput, extractAndValidateJson } from '../utils/structured-output-helper';
import { buildMastraModelConfig } from '../utils/llm-config';

// 颜色工具
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color: string, prefix: string, message: string) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

// ============ 测试 Schema 定义 ============

// 简单的结构化输出 schema
const SimpleOutputSchema = z.object({
  summary: z.string().describe('简短总结'),
  keywords: z.array(z.string()).describe('关键词列表'),
  sentiment: z.enum(['positive', 'negative', 'neutral']).describe('情感倾向'),
});

// 更复杂的 schema (模拟故事节点)
const StoryNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['scene', 'branch', 'ending']),
  brief: z.string(),
  dialogues: z.array(z.object({
    characterId: z.string(),
    text: z.string(),
    emotion: z.string().optional(),
  })),
  narration: z.string().optional(),
});

// ============ 测试函数 ============

async function testSimpleStructuredOutput(agent: Agent<any>) {
  log(colors.cyan, '📝', '测试 1: 简单结构化输出');
  
  const prompt = `分析以下文本并返回结构化结果：

"今天天气真好，阳光明媚，适合出去散步。公园里有很多人在锻炼身体，孩子们在草地上奔跑嬉戏。"

请返回一个包含 summary(总结), keywords(关键词数组), sentiment(情感: positive/negative/neutral) 的 JSON 对象。`;

  try {
    const startTime = Date.now();
    const result = await generateStructuredOutput(
      agent,
      prompt,
      SimpleOutputSchema,
      { temperature: 0.7, skipCache: true }
    );
    const elapsed = Date.now() - startTime;

    log(colors.green, '✅', `测试通过 (${elapsed}ms)`);
    console.log(`   Summary: ${result.summary}`);
    console.log(`   Keywords: ${result.keywords.join(', ')}`);
    console.log(`   Sentiment: ${result.sentiment}`);
    return true;
  } catch (error) {
    log(colors.red, '❌', `测试失败: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function testComplexStructuredOutput(agent: Agent<any>) {
  log(colors.cyan, '📝', '测试 2: 复杂结构化输出 (故事节点)');
  
  const prompt = `你是一个互动故事作家。请为以下场景创建一个故事节点：

场景: 主角小明来到了一家神秘的咖啡馆，遇到了店长老王。
要求: 这是一个普通场景节点(scene)，包含 2-3 句对话。

请返回一个 JSON 对象，包含:
- id: 节点唯一标识
- title: 节点标题
- type: 节点类型 (scene/branch/ending)
- brief: 简短描述
- dialogues: 对话数组，每个对话包含 characterId, text, emotion(可选)
- narration: 旁白文本(可选)`;

  try {
    const startTime = Date.now();
    const result = await generateStructuredOutput(
      agent,
      prompt,
      StoryNodeSchema,
      { temperature: 0.8, skipCache: true }
    );
    const elapsed = Date.now() - startTime;

    log(colors.green, '✅', `测试通过 (${elapsed}ms)`);
    console.log(`   ID: ${result.id}`);
    console.log(`   Title: ${result.title}`);
    console.log(`   Type: ${result.type}`);
    console.log(`   Brief: ${result.brief.slice(0, 50)}...`);
    console.log(`   Dialogues: ${result.dialogues.length} 条`);
    result.dialogues.forEach((d, i) => {
      console.log(`     ${i + 1}. [${d.characterId}]: ${d.text.slice(0, 30)}...`);
    });
    return true;
  } catch (error) {
    log(colors.red, '❌', `测试失败: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function testEnumValidation(agent: Agent<any>) {
  log(colors.cyan, '📝', '测试 3: Enum 值验证 (大小写处理)');
  
  const EnumTestSchema = z.object({
    status: z.enum(['active', 'inactive', 'pending']),
    priority: z.enum(['low', 'medium', 'high']),
    type: z.enum(['scene', 'branch', 'ending']),
  });

  const prompt = `返回一个任务状态对象，包含：
- status: 状态 (active/inactive/pending)
- priority: 优先级 (low/medium/high) 
- type: 类型 (scene/branch/ending)

请返回 JSON 格式。`;

  try {
    const startTime = Date.now();
    const result = await generateStructuredOutput(
      agent,
      prompt,
      EnumTestSchema,
      { temperature: 0.5, skipCache: true }
    );
    const elapsed = Date.now() - startTime;

    log(colors.green, '✅', `测试通过 (${elapsed}ms)`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Priority: ${result.priority}`);
    console.log(`   Type: ${result.type}`);
    return true;
  } catch (error) {
    log(colors.red, '❌', `测试失败: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function testDirectAgentGenerate(agent: Agent<any>) {
  log(colors.cyan, '📝', '测试 4: 直接 Agent.generate with jsonPromptInjection');
  
  const prompt = `分析这段话的情感：
"这部电影太棒了！剧情紧凑，演员演技精湛，我看得热泪盈眶。"

返回 JSON：{ "sentiment": "positive/negative/neutral", "score": 1-10 }`;

  const TestSchema = z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    score: z.number().min(1).max(10),
  });

  try {
    const startTime = Date.now();
    
    // 检测是否是 Qwen 模型
    const modelId = (process.env.OPENAI_MODEL_NAME || '').toLowerCase();
    const isQwen = modelId.includes('qwen');
    
    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema: TestSchema,
        jsonPromptInjection: isQwen, // Qwen 需要启用
      },
    });
    const elapsed = Date.now() - startTime;

    if (response.object) {
      log(colors.green, '✅', `测试通过 (${elapsed}ms)`);
      console.log(`   Sentiment: ${response.object.sentiment}`);
      console.log(`   Score: ${response.object.score}`);
      return true;
    } else if (response.text) {
      // 尝试从 text 解析
      const parsed = extractAndValidateJson(response.text, TestSchema);
      log(colors.yellow, '⚠️', `从 text 解析成功 (${elapsed}ms)`);
      console.log(`   Sentiment: ${parsed.sentiment}`);
      console.log(`   Score: ${parsed.score}`);
      return true;
    } else {
      throw new Error('response.object 和 response.text 都为空');
    }
  } catch (error) {
    log(colors.red, '❌', `测试失败: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

// ============ 主函数 ============

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}${colors.cyan}🧪 Qwen 结构化输出测试${colors.reset}`);
  console.log('='.repeat(60) + '\n');

  // 显示环境配置
  const modelName = process.env.OPENAI_MODEL_NAME || '未设置';
  const baseUrl = process.env.OPENAI_BASE_URL || '未设置';
  const isQwen = modelName.toLowerCase().includes('qwen');

  console.log(`${colors.dim}📝 环境配置:${colors.reset}`);
  console.log(`   Model: ${modelName}`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Is Qwen: ${isQwen ? '是 ✓' : '否'}`);
  console.log(`   jsonPromptInjection: ${isQwen ? '启用' : '禁用'}`);
  console.log('');

  if (!process.env.OPENAI_API_KEY) {
    log(colors.red, '❌', '缺少 OPENAI_API_KEY 环境变量');
    console.log(`
${colors.yellow}请设置以下环境变量后重新运行:${colors.reset}

  # 对于阿里云千问 Qwen:
  export OPENAI_API_KEY="sk-xxx"  # 阿里云 API Key
  export OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
  export OPENAI_MODEL_NAME="qwen-plus"  # 或 qwen-turbo, qwen-max

  # 对于 OpenAI:
  export OPENAI_API_KEY="sk-xxx"
  export OPENAI_MODEL_NAME="gpt-4o-mini"

运行测试:
  pnpm tsx src/tests/test-qwen-structured-output.ts
`);
    process.exit(1);
  }

  // 创建测试 Agent
  const agent = new Agent({
    name: 'test-structured-output',
    instructions: '你是一个测试助手，专门用于测试结构化输出功能。请严格按照要求返回 JSON 格式。',
    model: buildMastraModelConfig('primary'),
  });

  console.log(`${colors.bright}开始测试...${colors.reset}\n`);

  const results: boolean[] = [];

  // 运行测试
  results.push(await testSimpleStructuredOutput(agent));
  console.log('');
  
  results.push(await testComplexStructuredOutput(agent));
  console.log('');
  
  results.push(await testEnumValidation(agent));
  console.log('');
  
  results.push(await testDirectAgentGenerate(agent));
  console.log('');

  // 汇总结果
  console.log('='.repeat(60));
  console.log(`${colors.bright}📊 测试结果汇总${colors.reset}`);
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r).length;
  const total = results.length;

  if (passed === total) {
    log(colors.green, '🎉', `所有测试通过 (${passed}/${total})`);
  } else {
    log(colors.yellow, '⚠️', `部分测试通过 (${passed}/${total})`);
  }

  console.log('\n');
  process.exit(passed === total ? 0 : 1);
}

main().catch(console.error);

