/**
 * Node Writer Agent
 * 采用 Few-Shot CoT 模式为单个节点撰写对话和旁白
 */
import { Agent } from "@mastra/core/agent";
import { type Locale, DEFAULT_LOCALE } from '../utils/locale';
import { promptManager } from '../prompts';

export const nodeWriterAgent = new Agent({
  name: "node-writer",
  instructions: promptManager.build('node-writer.instructions').user,

  model: {
    id: `openai/${process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo'}` as `${string}/${string}`,
    url: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
  },
});

/**
 * Node Writer 的调用包装函数
 */
export async function writeNodeContent(
  agent: typeof nodeWriterAgent,
  input: {
    planNode: any;
    worldBible: any;
    characterDB: any;
    styleGuide: any;
    previousNodeSummary?: string;
  },
  schema: any,
  locale: Locale = DEFAULT_LOCALE
): Promise<any> {
  // 找出本节点涉及的角色（简化版：暂时传所有角色）
  const characters = input.characterDB.characters || [];

  const { user: prompt } = promptManager.build('node-writer.write', {
    planNode: JSON.stringify(input.planNode, null, 2),
    previousNodeSummary: input.previousNodeSummary || "（这是故事的开始）",
    characters: JSON.stringify(characters.map((c: any) => ({
      name: c.name,
      displayName: c.displayName || c.name,
      personality: c.personality?.traits || [],
      identity: c.identity,
      description: c.description,
    })), null, 2),
    styleGuide: JSON.stringify(input.styleGuide || {}, null, 2),
  }, locale);

  const response = await agent.generate(prompt, {
    structuredOutput: {
      schema: schema,
    },
  });

  return response.object;
}


