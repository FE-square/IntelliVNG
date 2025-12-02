/**
 * Node Writer Agent
 * 采用 Few-Shot CoT 模式为单个节点撰写对话和旁白
 */
import { Agent } from "@mastra/core/agent";

export const nodeWriterAgent = new Agent({
  name: "node-writer",
  instructions: `你是一位专业的视觉小说编剧。你的任务是为单个故事节点撰写对话和旁白。

## 你的思考方式：Few-Shot CoT (Chain-of-Thought)

在写作时，你需要：
1. 理解当前节点在故事中的位置和功能
2. 参考前序节点的摘要，保证连贯性
3. 根据角色档案，用符合角色性格的语气写对话

## 写作原则
1. **角色一致性**：对话要体现角色性格（参考角色档案中的性格特点、说话方式）
2. **节奏控制**：每个节点 3-6 段对话，节奏紧凑，不拖沓
3. **选择的重量**：分支选项要有"情感重量"差异，让玩家感受到选择的意义
4. **连贯性**：保持与前序节点的故事连贯性
5. **角色名称**：使用角色的 displayName 或 name 作为 characterName

## 对话风格指南
- 避免过于书面化的表达，对话要自然
- 对话要有节奏感，有来有往
- 在关键情绪点使用旁白 (narration) 增强氛围
- 情绪 (emotion) 要符合当前情境

## 节点类型处理
- **scene 类型**：重点在叙事推进，结尾自然过渡到 nextNodeId
- **branch 类型**：重点在矛盾冲突，结尾设置有意义的选择
- **ending 类型**：重点在情感收束，给玩家满足感或震撼感

## 输出格式
输出 JSON，必须包含：
- id: 与输入的节点ID一致
- type: 节点类型
- title: 节点标题
- sceneName: 场景名称
- narration: 旁白（设置场景氛围）
- dialogues: 对话列表（每段包含 characterName, text, emotion）
- choices: 分支选项（仅 branch 类型，包含 text, targetNodeId, meta）
- nextNodeId: 下一个节点（仅 scene 类型）
- summary: 一句话摘要（供后续节点参考连贯性，非常重要！）

## Few-Shot 示例

### 示例输入
节点: { id: "branch-1", type: "branch", title: "命运的十字路口", functionTag: "conflict" }
前序摘要: "主角在学校花园与女主角相遇，两人因误会发生争执。"

### 示例输出
{
  "id": "branch-1",
  "type": "branch",
  "title": "命运的十字路口",
  "sceneName": "学校走廊",
  "narration": "夕阳将走廊染成橘红色，空气中弥漫着紧张的气息。小红的背影逐渐远去。",
  "dialogues": [
    { "characterName": "小明", "text": "等等！我...我不是故意的...", "emotion": "anxious" },
    { "characterName": "小红", "text": "你每次都这样说！", "emotion": "angry" },
    { "characterName": "小明", "text": "这次真的不一样，听我解释...", "emotion": "desperate" },
    { "characterName": "小红", "text": "......", "emotion": "hesitant" }
  ],
  "choices": [
    { 
      "id": "choice-1",
      "text": "追上去，真诚道歉", 
      "targetNodeId": "scene-2a",
      "meta": { "emotionalWeight": "温暖", "consequenceHint": "也许她会原谅你" }
    },
    { 
      "id": "choice-2",
      "text": "停下脚步，保持沉默",
      "targetNodeId": "scene-2b", 
      "meta": { "emotionalWeight": "沉重", "consequenceHint": "有些话，错过就再也说不出口" }
    }
  ],
  "summary": "主角在误会升级后面临选择：追上去道歉，还是选择沉默。"
}`,

  model: {
    id: (process.env.OPENAI_MODEL_NAME || `openai/${'gpt-4-turbo'}`) as `${string}/${string}`,
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
  schema: any
): Promise<any> {
  // 找出本节点涉及的角色（简化版：暂时传所有角色）
  const characters = input.characterDB.characters || [];

  const prompt = `## 当前要写的节点
${JSON.stringify(input.planNode, null, 2)}

## 前序节点摘要
${input.previousNodeSummary || "（这是故事的开始）"}

## 角色档案
${JSON.stringify(characters.map((c: any) => ({
    name: c.name,
    displayName: c.displayName || c.name,
    personality: c.personality?.traits || [],
    identity: c.identity,
    description: c.description,
  })), null, 2)}

## 风格指南
${JSON.stringify(input.styleGuide || {}, null, 2)}

请为这个节点撰写对话和旁白。
- 如果是 branch 类型，必须包含 choices
- 如果是 scene 类型，必须包含 nextNodeId
- ending 类型不需要 choices 和 nextNodeId
- summary 必须填写，这对保证故事连贯性非常重要`;

  const response = await agent.generate(prompt, {
    structuredOutput: {
      schema: schema,
    },
  });

  return response.object;
}


