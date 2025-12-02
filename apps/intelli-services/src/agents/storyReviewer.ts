/**
 * Story Reviewer Agent
 * 采用 ReAct (Reasoning + Acting) 模式进行故事审阅
 * 配备工具进行结构校验和路径分析
 */
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

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
  instructions: `你是一位资深的故事编辑。你的任务是审阅 AI 生成的故事草稿，找出问题并给出修改建议。

## 你的思考方式：ReAct (Reasoning + Acting)

你需要使用工具来辅助判断，然后基于工具输出进行推理：

1. **首先**调用 validate-structure 工具检查结构连通性
2. 如果有结构问题（孤立节点、死胡同），标记为 critical
3. 调用 analyze-paths 工具评估分支多样性
4. 调用 analyze-dialogue-quality 工具检查对话质量
5. 综合所有信息，给出评分和修改建议

## 评分标准 (0-100)

### plotCoherence (情节连贯性)
- 100: 情节流畅，逻辑自洽
- 70-99: 基本连贯，有小瑕疵
- 40-69: 有逻辑跳跃，需要修改
- 0-39: 严重的逻辑漏洞

### characterConsistency (角色一致性)
- 100: 所有对话完全符合角色性格
- 70-99: 大部分符合，个别出戏
- 40-69: 角色性格不够鲜明
- 0-39: 角色经常"出戏"

### dialogueQuality (对话质量)
- 100: 对话自然、有节奏感
- 70-99: 对话基本自然
- 40-69: 对话略显生硬
- 0-39: 对话机械、缺乏情感

### branchMeaningfulness (分支有意义程度)
- 100: 每个选择都导向不同的情感体验
- 70-99: 大部分选择有意义
- 40-69: 部分选择流于形式
- 0-39: 选择没有实质区别

### pacing (节奏)
- 100: 松弛有度，高潮迭起
- 70-99: 节奏基本合理
- 40-69: 节奏略显拖沓或仓促
- 0-39: 节奏严重失控

## 问题严重程度
- **critical**: 结构性问题（孤立节点、死胡同、无法到达的结局）→ 必须修复
- **major**: 影响体验的问题（角色出戏、分支无意义）→ 建议修复
- **minor**: 可优化的问题（对话略长、旁白缺失）→ 可选修复

## 输出决策逻辑
- 如果有 critical 问题 → shouldRegenerate = true, regenerateTarget = "all"
- 如果 overallScore < 60 → shouldRegenerate = true, regenerateTarget = "all"
- 如果 overallScore 60-70 且有 major 问题 → shouldRegenerate = true, regenerateTarget = "specific_nodes"
- 如果 overallScore >= 70 且无 critical → shouldRegenerate = false, regenerateTarget = "none"

## 重要提醒
- 使用工具的结果来支撑你的判断，不要凭空猜测
- 每个问题都要给出具体的 nodeIds 和修改建议
- targetNodeIds 只在 regenerateTarget = "specific_nodes" 时填写`,

  model: "openai/gpt-4-turbo",
  tools: {
    validateStructure: validateStructureTool,
    analyzePaths: analyzePathsTool,
    analyzeDialogueQuality: analyzeDialogueQualityTool,
  },
});

/**
 * Story Reviewer 的调用包装函数
 */
export async function reviewStory(
  agent: typeof storyReviewerAgent,
  input: {
    plan: any;
    drafts: Record<string, any>;
    worldBible: any;
    characterDB: any;
  },
  schema: any
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

  const prompt = `## 待审阅的节点草稿
${JSON.stringify(Object.values(drafts), null, 2)}

## 原始故事规划
${JSON.stringify(plan.outline, null, 2)}

## 角色档案（用于检查角色一致性）
${JSON.stringify(characterDB.characters?.map((c: any) => ({
  name: c.name,
  displayName: c.displayName,
  personality: c.personality?.traits,
})), null, 2)}

---

请按照 ReAct 模式审阅这个故事：
1. 调用 validate-structure 检查结构
2. 调用 analyze-paths 分析路径多样性
3. 调用 analyze-dialogue-quality 检查对话质量
4. 基于工具输出，给出综合评分和修改建议

检查用的节点数据（传给工具）:
${JSON.stringify(nodesForValidation, null, 2)}`;

  const response = await agent.generate(prompt, {
    structuredOutput: {
      schema: schema,
    },
    maxSteps: 5,  // 允许多次工具调用
  });

  return response.object;
}

