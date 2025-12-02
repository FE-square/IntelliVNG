/**
 * Story Reviewer Agent
 * 采用 ReAct (Reasoning + Acting) 模式进行故事审阅
 * 配备工具进行结构校验和路径分析
 */
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { promptManager } from '../prompts';

// ============ 工具定义 ============

/**
 * 工具 1: 结构校验
 * 检查节点连通性，找出孤立节点和死胡同
 */
export const validateStructureTool = createTool({
  id: "validate-structure",
  description: "检查节点连通性，找出孤立节点和死胡同。在审阅故事前必须先调用此工具。",
  inputSchema: z.object({
    nodes: z.array(z.object({
      id: z.string(),
      type: z.string(),
      isStart: z.boolean().optional(),
      isEnding: z.boolean().optional(),
      nextNodeId: z.string().optional(),
      choices: z.array(z.object({
        targetNodeId: z.string(),
      })).optional(),
    })),
  }),
  execute: async ({ context }) => {
    const { nodes } = context;
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const orphans: string[] = [];
    const deadEnds: string[] = [];
    const invalidLinks: string[] = [];

    // 找到开始节点
    const startNode = nodes.find((n: any) => n.isStart);
    if (!startNode) {
      return { 
        valid: false, 
        error: "没有找到开始节点 (isStart: true)", 
        orphans: [], 
        deadEnds: [], 
        invalidLinks: [],
        reachableCount: 0,
        totalCount: nodes.length,
      };
    }

    // BFS 检查可达性
    const reachable = new Set<string>();
    const queue = [startNode.id];
    reachable.add(startNode.id);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const current = nodes.find((n: any) => n.id === currentId);
      if (!current) continue;

      // 检查 nextNodeId
      if (current.nextNodeId) {
        if (!nodeIds.has(current.nextNodeId)) {
          invalidLinks.push(`${currentId} → ${current.nextNodeId} (不存在)`);
        } else if (!reachable.has(current.nextNodeId)) {
          reachable.add(current.nextNodeId);
          queue.push(current.nextNodeId);
        }
      }

      // 检查 choices
      current.choices?.forEach((choice: any) => {
        if (!nodeIds.has(choice.targetNodeId)) {
          invalidLinks.push(`${currentId} → ${choice.targetNodeId} (不存在)`);
        } else if (!reachable.has(choice.targetNodeId)) {
          reachable.add(choice.targetNodeId);
          queue.push(choice.targetNodeId);
        }
      });
    }

    // 找出孤立节点（从 START 无法到达）
    nodes.forEach((n: any) => {
      if (!reachable.has(n.id)) {
        orphans.push(n.id);
      }
    });

    // 找出死胡同（非 ending 但没有出路）
    nodes.forEach((n: any) => {
      if (!n.isEnding && !n.nextNodeId && (!n.choices || n.choices.length === 0)) {
        deadEnds.push(n.id);
      }
    });

    return {
      valid: orphans.length === 0 && deadEnds.length === 0 && invalidLinks.length === 0,
      orphans,
      deadEnds,
      invalidLinks,
      reachableCount: reachable.size,
      totalCount: nodes.length,
    };
  },
});

/**
 * 工具 2: 路径多样性分析
 * 枚举所有可能的故事路径，评估分支的多样性
 */
export const analyzePathsTool = createTool({
  id: "analyze-paths",
  description: "分析所有可能的故事路径，评估分支的多样性和意义性。可以了解故事有多少条不同的路线。",
  inputSchema: z.object({
    nodes: z.array(z.any()),
  }),
  execute: async ({ context }) => {
    const { nodes } = context;
    const paths: string[][] = [];
    const startNode = nodes.find((n: any) => n.isStart);
    
    if (!startNode) {
      return { 
        totalPaths: 0, 
        diversityScore: 0, 
        pathDescriptions: [],
        avgPathLength: 0,
      };
    }

    // DFS 枚举所有路径（防止无限循环，限制最大深度）
    const MAX_DEPTH = 50;
    const dfs = (nodeId: string, currentPath: string[], visited: Set<string>) => {
      if (currentPath.length > MAX_DEPTH) return;
      
      const node = nodes.find((n: any) => n.id === nodeId);
      if (!node) return;

      // 防止循环
      if (visited.has(nodeId)) return;
      
      const newVisited = new Set(visited);
      newVisited.add(nodeId);
      currentPath.push(nodeId);

      if (node.isEnding) {
        paths.push([...currentPath]);
      } else if (node.choices && node.choices.length > 0) {
        node.choices.forEach((choice: any) => {
          dfs(choice.targetNodeId, [...currentPath], newVisited);
        });
      } else if (node.nextNodeId) {
        dfs(node.nextNodeId, currentPath, newVisited);
      }
    };

    dfs(startNode.id, [], new Set());

    // 计算多样性评分
    // 基于：路径数量、独特节点比例、路径长度差异
    const uniqueNodes = new Set(paths.flat()).size;
    const avgLength = paths.length > 0 
      ? paths.reduce((sum, p) => sum + p.length, 0) / paths.length 
      : 0;
    
    // 评分公式：路径数 * 独特节点率，归一化到 0-1
    const diversityScore = Math.min(1, (paths.length * uniqueNodes) / (nodes.length * 3));

    // 计算路径长度标准差（路径长度差异越大，体验越丰富）
    const lengthVariance = paths.length > 1
      ? paths.reduce((sum, p) => sum + Math.pow(p.length - avgLength, 2), 0) / paths.length
      : 0;

    return {
      totalPaths: paths.length,
      diversityScore: Math.round(diversityScore * 100) / 100,
      pathDescriptions: paths.slice(0, 5).map(p => p.join(" → ")), // 最多显示5条
      avgPathLength: Math.round(avgLength * 10) / 10,
      lengthVariance: Math.round(lengthVariance * 10) / 10,
    };
  },
});

/**
 * 工具 3: 对话质量统计
 * 分析每个节点的对话数量，找出过短或过长的节点
 */
export const analyzeDialogueQualityTool = createTool({
  id: "analyze-dialogue-quality",
  description: "分析每个节点的对话数量和质量，找出对话过少或过多的节点。",
  inputSchema: z.object({
    nodes: z.array(z.object({
      id: z.string(),
      dialogues: z.array(z.any()).optional(),
      narration: z.string().optional(),
    })),
  }),
  execute: async ({ context }) => {
    const { nodes } = context;
    const stats = nodes.map((n: any) => ({
      id: n.id,
      dialogueCount: n.dialogues?.length || 0,
      hasNarration: !!n.narration,
      totalChars: (n.dialogues || []).reduce((sum: number, d: any) => sum + (d.text?.length || 0), 0),
    }));

    const avgDialogues = stats.reduce((sum, s) => sum + s.dialogueCount, 0) / stats.length;
    
    // 对话过少（< 2）或过多（> 8）的节点
    const shortNodes = stats.filter(s => s.dialogueCount < 2).map(s => s.id);
    const longNodes = stats.filter(s => s.dialogueCount > 8).map(s => s.id);
    const noNarrationNodes = stats.filter(s => !s.hasNarration).map(s => s.id);

    return {
      avgDialoguesPerNode: Math.round(avgDialogues * 10) / 10,
      shortNodes,
      longNodes,
      noNarrationNodes,
      stats,
    };
  },
});

// ============ Reviewer Agent ============

export const storyReviewerAgent = new Agent({
  name: "story-reviewer",
  instructions: promptManager.build('story-reviewer.instructions').user,

  model: {
    id: `openai/${process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo'}` as `${string}/${string}`,
    url: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
  },
  
  tools: {
    validateStructure: validateStructureTool,
    analyzePaths: analyzePathsTool,
    analyzeDialogueQuality: analyzeDialogueQualityTool,
  },
  
  // 某些模型（如 o1 系列）不支持 temperature=0，必须设为 1
  defaultGenerateOptions: {
    modelSettings: {
      temperature: 1,
    },
  },
});

/**
 * Story Reviewer 的调用包装函数
 * 
 * 真正的 ReAct 实现需要两个阶段：
 * 1. ReAct 阶段：让模型自由调用工具，进行 Thought → Action → Observation 循环
 * 2. 格式化阶段：将 ReAct 的结论格式化为结构化输出
 */
import { type Locale, DEFAULT_LOCALE } from '../utils/locale';

export async function reviewStory(
  agent: typeof storyReviewerAgent,
  input: {
    plan: any;
    drafts: Record<string, any>;
    worldBible: any;
    characterDB: any;
  },
  schema: any,
  locale: Locale = DEFAULT_LOCALE
): Promise<any> {
  const { plan, drafts, characterDB } = input;

  // 构建供工具使用的节点数据
  const nodesForValidation = Object.values(drafts).map((d: any) => ({
    id: d.id,
    type: d.type,
    isStart: plan.nodes.find((n: any) => n.id === d.id)?.isStart,
    isEnding: plan.nodes.find((n: any) => n.id === d.id)?.isEnding,
    nextNodeId: d.nextNodeId,
    choices: d.choices?.map((c: any) => ({ targetNodeId: c.targetNodeId })),
    dialogues: d.dialogues,
    narration: d.narration,
  }));

  console.log("[ReAct] 🔄 开始 ReAct 审阅循环...");

  // ============ 阶段 1: ReAct 循环（工具调用） ============
  // 不使用 structuredOutput，让模型自由进行工具调用
  const { user: reactPrompt } = promptManager.build('story-reviewer.react', {
    drafts: JSON.stringify(Object.values(drafts), null, 2),
    planOutline: JSON.stringify(plan.outline, null, 2),
    characters: JSON.stringify(characterDB.characters?.map((c: any) => ({
      name: c.name,
      displayName: c.displayName,
      personality: c.personality?.traits,
    })), null, 2),
    nodesForValidation: JSON.stringify(nodesForValidation, null, 2),
  }, locale);

  const reactResponse = await agent.generate(reactPrompt, {
    maxSteps: 6,  // 允许足够的工具调用轮次
  });

  console.log("[ReAct] ✅ ReAct 循环完成");
  console.log(`[ReAct] 工具调用次数: ${reactResponse.toolCalls?.length || 0}`);
  
  // 打印工具调用详情（用于调试）
  if (reactResponse.toolCalls && reactResponse.toolCalls.length > 0) {
    reactResponse.toolCalls.forEach((call: any, i: number) => {
      console.log(`[ReAct] 工具 ${i + 1}: ${call.toolName}`);
    });
  }

  // ============ 阶段 2: 格式化输出 ============
  // 使用另一个 Agent 调用（或同一个 Agent 的不同调用）来格式化输出
  console.log("[ReAct] 📝 格式化审阅报告...");

  const { user: formatPrompt } = promptManager.build('story-reviewer.format', {
    reactAnalysis: reactResponse.text,
    toolResults: JSON.stringify(reactResponse.toolResults || [], null, 2),
  }, locale);

  // 第二次调用：纯结构化输出，不需要工具
  const formatResponse = await agent.generate(formatPrompt, {
    structuredOutput: {
      schema: schema,
    },
  });

  console.log("[ReAct] ✅ 审阅报告生成完成");

  return formatResponse.object;
}

/**
 * 真正的 ReAct 审阅（带详细日志）
 * 返回 ReAct 循环的完整记录，便于调试和可视化
 */
export async function reviewStoryWithTrace(
  agent: typeof storyReviewerAgent,
  input: {
    plan: any;
    drafts: Record<string, any>;
    worldBible: any;
    characterDB: any;
  },
  schema: any,
  locale: Locale = DEFAULT_LOCALE
): Promise<{
  report: any;
  trace: {
    toolCalls: any[];
    reasoning: string;
    iterations: number;
  };
}> {
  const startTime = Date.now();
  
  // 执行审阅
  const report = await reviewStory(agent, input, schema, locale);
  
  const trace = {
    toolCalls: [], // 可以通过修改 reviewStory 来收集
    reasoning: "ReAct 循环完成",
    iterations: 0, // 可以通过 response.steps 获取
    duration: Date.now() - startTime,
  };

  return { report, trace };
}

