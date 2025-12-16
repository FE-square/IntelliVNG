/**
 * Editor Chat Agent
 * 
 * 为编辑器提供对话式交互的 AI Agent，支持：
 * - 节点 CRUD 操作（增删改查剧情节点）
 * - 调用 MCP Server 进行剧本分析
 * - 触发对白、立绘等生成功能
 */
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { buildMastraModelConfig, type LLMProfile } from "../utils/llm-config";
import { promptManager } from "../prompts";
import { type Locale, DEFAULT_LOCALE } from "../utils/locale";

// ============ Schema 定义 ============

const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const DialogueSchema = z.object({
  id: z.string().optional(),
  characterId: z.string().optional(),
  text: z.string(),
  emotion: z.string().optional(),
});

const ChoiceSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  targetNodeId: z.string().optional(),
  condition: z.string().optional(),
});

const StoryNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["scene", "branch", "ending"]).optional(),
  title: z.string().optional(),
  sceneName: z.string().optional(),
  backgroundId: z.string().optional(),
  isStart: z.boolean().optional(),
  isEnding: z.boolean().optional(),
  nextNodeId: z.string().optional(),
  narration: z.string().optional(),
  dialogues: z.array(DialogueSchema).optional(),
  choices: z.array(ChoiceSchema).optional(),
  position: NodePositionSchema.optional(),
});

// ============ 工具定义 ============

/**
 * 添加节点工具
 */
export const addNodeTool = createTool({
  id: "add-node",
  description: `添加一个新的剧情节点。
参数说明：
- type: 节点类型 (scene=场景节点, branch=分支节点, ending=结局节点)
- title: 节点标题
- isStart: 是否为开始节点（整个剧本只能有一个）
- position: 节点在画布上的位置 {x, y}
- dialogues: 对话列表
- choices: 分支选项（仅 branch 类型需要）
- nextNodeId: 下一个节点ID（非分支节点使用）
返回新创建的节点数据。`,
  inputSchema: z.object({
    type: z.enum(["scene", "branch", "ending"]).describe("节点类型"),
    title: z.string().describe("节点标题"),
    isStart: z.boolean().optional().describe("是否为开始节点"),
    sceneName: z.string().optional().describe("场景名称"),
    backgroundId: z.string().optional().describe("背景ID"),
    narration: z.string().optional().describe("旁白文本"),
    dialogues: z.array(DialogueSchema).optional().describe("对话列表"),
    choices: z.array(ChoiceSchema).optional().describe("分支选项"),
    nextNodeId: z.string().optional().describe("下一个节点ID"),
    position: NodePositionSchema.optional().describe("画布位置"),
  }),
  execute: async ({ context }) => {
    // 生成唯一ID
    const nodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const node = {
      id: nodeId,
      type: context.type,
      title: context.title,
      isStart: context.isStart || false,
      isEnding: context.type === "ending",
      sceneName: context.sceneName,
      backgroundId: context.backgroundId,
      narration: context.narration,
      dialogues: context.dialogues?.map((d, i) => ({
        ...d,
        id: d.id || `dialogue-${nodeId}-${i}`,
      })) || [],
      choices: context.choices?.map((c, i) => ({
        ...c,
        id: c.id || `choice-${nodeId}-${i}`,
      })),
      nextNodeId: context.nextNodeId,
      position: context.position || { x: 200, y: 200 },
    };
    
    return {
      action: "add-node",
      node,
    };
  },
});

/**
 * 更新节点工具
 */
export const updateNodeTool = createTool({
  id: "update-node",
  description: `更新现有节点的属性。
可以更新的属性：title, sceneName, narration, dialogues, choices, nextNodeId, isStart, isEnding 等。
只需传入要修改的字段即可，未传入的字段保持不变。`,
  inputSchema: z.object({
    nodeId: z.string().describe("要更新的节点ID"),
    updates: z.object({
      title: z.string().optional(),
      type: z.enum(["scene", "branch", "ending"]).optional(),
      sceneName: z.string().optional(),
      backgroundId: z.string().optional(),
      narration: z.string().optional(),
      dialogues: z.array(DialogueSchema).optional(),
      choices: z.array(ChoiceSchema).optional(),
      nextNodeId: z.string().optional(),
      isStart: z.boolean().optional(),
      isEnding: z.boolean().optional(),
    }).describe("要更新的字段"),
  }),
  execute: async ({ context }) => {
    return {
      action: "update-node",
      nodeId: context.nodeId,
      updates: context.updates,
    };
  },
});

/**
 * 删除节点工具
 */
export const deleteNodeTool = createTool({
  id: "delete-node",
  description: `删除指定的节点。
注意：删除节点会同时清除指向该节点的所有连接（其他节点的 nextNodeId 和 choices 中的 targetNodeId）。
不能删除唯一的开始节点。`,
  inputSchema: z.object({
    nodeId: z.string().describe("要删除的节点ID"),
  }),
  execute: async ({ context }) => {
    return {
      action: "delete-node",
      nodeId: context.nodeId,
    };
  },
});

/**
 * 查询节点工具
 */
export const queryNodesTool = createTool({
  id: "query-nodes",
  description: `查询剧本中的节点信息。
可以：
- 不传参数：返回所有节点的摘要
- 传 nodeId：返回指定节点的详细信息
- 传 filter：按条件筛选节点（如 type="branch" 查找所有分支节点）`,
  inputSchema: z.object({
    nodeId: z.string().optional().describe("指定节点ID"),
    filter: z.object({
      type: z.enum(["scene", "branch", "ending"]).optional(),
      isStart: z.boolean().optional(),
      isEnding: z.boolean().optional(),
      hasDialogues: z.boolean().optional(),
    }).optional().describe("筛选条件"),
  }),
  execute: async ({ context }) => {
    return {
      action: "query-nodes",
      nodeId: context.nodeId,
      filter: context.filter,
    };
  },
});

/**
 * 剧本分析工具（调用 MCP Server）
 */
export const analyzeStoryTool = createTool({
  id: "analyze-story",
  description: `分析剧本结构和质量，调用 MCP Server 的分析工具。
可选分析类型：
- validate: 验证结构完整性（检查孤立节点、死胡同等）
- paths: 分析所有可能路径
- dialogue: 分析对话质量
- branch: 分析分支分布
- constraints: 检查约束合规性
- score: 获取非线性综合评分
- all: 执行所有分析`,
  inputSchema: z.object({
    analysisType: z.enum(["validate", "paths", "dialogue", "branch", "constraints", "score", "all"])
      .describe("分析类型"),
    constraints: z.object({
      targetNodeCount: z.number().optional(),
      targetEndingCount: z.number().optional(),
      maxDepth: z.number().optional(),
      maxBranching: z.number().optional(),
    }).optional().describe("约束条件（仅 constraints 类型使用）"),
  }),
  execute: async ({ context }) => {
    return {
      action: "analyze-story",
      analysisType: context.analysisType,
      constraints: context.constraints,
    };
  },
});

/**
 * 生成对白工具
 */
export const generateDialogueTool = createTool({
  id: "generate-dialogue",
  description: `为指定节点生成对白内容。
根据场景、角色和剧情上下文，AI 会生成适合的对话。`,
  inputSchema: z.object({
    nodeId: z.string().describe("目标节点ID"),
    context: z.string().optional().describe("额外的剧情上下文说明"),
    characterIds: z.array(z.string()).optional().describe("参与对话的角色ID列表"),
    style: z.enum(["formal", "casual", "dramatic", "humorous"]).optional().describe("对话风格"),
  }),
  execute: async ({ context }) => {
    return {
      action: "generate-dialogue",
      nodeId: context.nodeId,
      context: context.context,
      characterIds: context.characterIds,
      style: context.style,
    };
  },
});

/**
 * 生成图片工具
 */
export const generateImageTool = createTool({
  id: "generate-image",
  description: `为指定的角色或场景生成图片。

**图片类型：**
- sprite: 角色立绘（全身像，用于对话场景）
- avatar: 角色头像（半身/特写，用于对话框）
- background: 场景背景图

**使用方法：**
根据用户指定的角色名或场景名，从系统上下文中的"角色列表"或"背景列表"中匹配目标。

**示例：**
- 用户说"给小红生成立绘" → type=sprite, targetName=小红
- 用户说"生成咖啡厅的背景" → type=background, targetName=咖啡厅
- 用户说"给主角做个头像" → type=avatar, targetName=主角

**注意：**
- targetName 应该与角色/场景列表中的名称匹配
- 如果匹配不到，系统会返回错误
- 可以添加 prompt 来指定风格或细节`,
  inputSchema: z.object({
    type: z.enum(["sprite", "avatar", "background"]).describe("图片类型：sprite=立绘, avatar=头像, background=背景"),
    targetName: z.string().describe("目标名称，需与角色列表或背景列表中的名称匹配"),
    prompt: z.string().optional().describe("额外的生成提示词，如风格、表情、姿势等"),
  }),
  execute: async ({ context }) => {
    return {
      action: "generate-image",
      type: context.type,
      targetName: context.targetName,
      prompt: context.prompt,
    };
  },
});

/**
 * 连接节点工具
 */
export const connectNodesTool = createTool({
  id: "connect-nodes",
  description: `连接两个节点。
如果是普通连接，设置 sourceNode 的 nextNodeId。
如果是分支连接，为 sourceNode 添加一个 choice。`,
  inputSchema: z.object({
    sourceNodeId: z.string().describe("源节点ID"),
    targetNodeId: z.string().describe("目标节点ID"),
    connectionType: z.enum(["next", "choice"]).describe("连接类型"),
    choiceText: z.string().optional().describe("分支选项文本（仅 choice 类型需要）"),
  }),
  execute: async ({ context }) => {
    return {
      action: "connect-nodes",
      sourceNodeId: context.sourceNodeId,
      targetNodeId: context.targetNodeId,
      connectionType: context.connectionType,
      choiceText: context.choiceText,
    };
  },
});

// ============ Agent 创建 ============

export function createEditorChatAgent(profile: LLMProfile = "primary", locale: Locale = DEFAULT_LOCALE) {
  // 将 locale 作为变量传入模板，替换 {{locale}} 占位符
  const { user: instructions } = promptManager.build("editor-chat.instructions", { locale }, locale);
  
  return new Agent({
    name: "editor-chat",
    instructions: instructions,
    model: buildMastraModelConfig(profile),
    tools: {
      addNode: addNodeTool,
      updateNode: updateNodeTool,
      deleteNode: deleteNodeTool,
      queryNodes: queryNodesTool,
      analyzeStory: analyzeStoryTool,
      generateDialogue: generateDialogueTool,
      generateImage: generateImageTool,
      connectNodes: connectNodesTool,
    },
  });
}

// 导出单例（使用默认配置）
export const editorChatAgent = createEditorChatAgent();

// ============ 辅助类型 ============

export type EditorAction = 
  | { action: "add-node"; node: any }
  | { action: "update-node"; nodeId: string; updates: any }
  | { action: "delete-node"; nodeId: string }
  | { action: "query-nodes"; nodeId?: string; filter?: any }
  | { action: "analyze-story"; analysisType: string; constraints?: any }
  | { action: "generate-dialogue"; nodeId: string; context?: string; characterIds?: string[]; style?: string }
  | { action: "generate-image"; type: string; targetName: string; prompt?: string }
  | { action: "connect-nodes"; sourceNodeId: string; targetNodeId: string; connectionType: string; choiceText?: string };

/**
 * 解析 Agent 的工具调用结果，提取动作指令
 * 
 * Mastra toolResults 格式是：
 * [{ type: "tool-result", payload: { toolName: "xxx", result: { action: "xxx", ... } } }]
 * 
 * 注意：Agent 可能在多个 step 中调用同一个工具多次（尤其是 analyze-story），
 * 我们需要对相同类型的动作进行去重或合并。
 */
export function extractActions(toolResults: any[]): EditorAction[] {
  if (!toolResults || !Array.isArray(toolResults)) {
    console.log('[extractActions] toolResults 为空或非数组');
    return [];
  }
  
  const rawActions = toolResults
    .map((result) => {
      // Mastra 格式: { type: "tool-result", payload: { result: { action: "xxx" } } }
      if (result?.payload?.result && typeof result.payload.result === 'object') {
        return result.payload.result;
      }
      // 旧格式: { toolName: "xxx", result: { action: "xxx" } }
      if (result?.result && typeof result.result === 'object') {
        return result.result;
      }
      // 直接格式: { action: "xxx" }
      return result;
    })
    .filter((result) => result && typeof result === "object" && "action" in result)
    .map((result) => result as EditorAction);
  
  // 去重：同一类型的动作只保留最后一个（通常参数最完整）
  const actionMap = new Map<string, EditorAction>();
  for (const action of rawActions) {
    // 对于 analyze-story，按 analysisType 去重
    if (action.action === 'analyze-story') {
      const key = `analyze-story:${action.analysisType}`;
      actionMap.set(key, action);
    }
    // 对于 generate-image，按 type+targetName 去重
    else if (action.action === 'generate-image') {
      const key = `generate-image:${action.type}:${action.targetName}`;
      actionMap.set(key, action);
    }
    // 对于节点操作，按 action+nodeId 去重
    else if (action.action === 'add-node') {
      const key = `add-node:${action.node?.id || Date.now()}`;
      actionMap.set(key, action);
    }
    else if (action.action === 'update-node' || action.action === 'delete-node') {
      const key = `${action.action}:${action.nodeId}`;
      actionMap.set(key, action);
    }
    // 其他动作直接使用 action 名称去重
    else {
      const key = action.action;
      actionMap.set(key, action);
    }
  }
  
  const deduped = Array.from(actionMap.values());
  console.log('[extractActions] 原始动作:', rawActions.length, '去重后:', deduped.length, deduped.map(a => a.action));
  return deduped;
}
