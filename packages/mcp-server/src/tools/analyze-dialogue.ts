/**
 * 对话质量分析工具
 * 分析每个节点的对话数量和质量
 * 
 * 帮助识别对话过少或过多的节点，确保叙事节奏
 */
import { z } from "zod";

// 输入 Schema
export const AnalyzeDialogueInputSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().describe("节点唯一标识"),
    type: z.string().optional().describe("节点类型"),
    dialogues: z.array(z.object({
      characterId: z.string().optional().describe("角色ID"),
      characterName: z.string().optional().describe("角色名称"),
      text: z.string().describe("对话内容"),
      emotion: z.string().optional().describe("情绪"),
    })).optional().describe("对话列表"),
    narration: z.string().optional().describe("旁白"),
  })).describe("故事节点列表"),
});

// 输出 Schema
export const AnalyzeDialogueOutputSchema = z.object({
  avgDialoguesPerNode: z.number().describe("每节点平均对话数"),
  shortNodes: z.array(z.string()).describe("对话过少的节点 (< 2)"),
  longNodes: z.array(z.string()).describe("对话过多的节点 (> 8)"),
  noNarrationNodes: z.array(z.string()).describe("缺少旁白的节点"),
  characterStats: z.array(z.object({
    characterName: z.string(),
    dialogueCount: z.number(),
    avgLength: z.number(),
  })).describe("角色对话统计"),
  emotionDistribution: z.record(z.number()).describe("情绪分布"),
  qualityScore: z.number().describe("对话质量综合评分 (0-100)"),
});

export type AnalyzeDialogueInput = z.infer<typeof AnalyzeDialogueInputSchema>;
export type AnalyzeDialogueOutput = z.infer<typeof AnalyzeDialogueOutputSchema>;

/**
 * 执行对话质量分析
 */
export function analyzeDialogue(input: AnalyzeDialogueInput): AnalyzeDialogueOutput {
  const { nodes } = input;
  if (!nodes || nodes.length === 0) {
    return {
      avgDialoguesPerNode: 0,
      shortNodes: [],
      longNodes: [],
      noNarrationNodes: [],
      characterStats: [],
      emotionDistribution: {},
      qualityScore: 0,
    };
  }
  
  // 基础统计
  const stats = nodes.map((n) => ({
    id: n.id,
    dialogueCount: n.dialogues?.length || 0,
    hasNarration: !!n.narration,
    totalChars: (n.dialogues || []).reduce(
      (sum, d) => sum + (d.text?.length || 0),
      0
    ),
  }));

  const avgDialogues = stats.reduce((sum, s) => sum + s.dialogueCount, 0) / stats.length;

  // 对话过少（< 2）或过多（> 8）的节点
  const shortNodes = stats.filter((s) => s.dialogueCount < 2).map((s) => s.id);
  const longNodes = stats.filter((s) => s.dialogueCount > 8).map((s) => s.id);
  const noNarrationNodes = stats.filter((s) => !s.hasNarration).map((s) => s.id);

  // 角色对话统计
  const characterMap = new Map<string, { count: number; totalLength: number }>();
  const emotionMap = new Map<string, number>();

  nodes.forEach((node) => {
    node.dialogues?.forEach((d) => {
      const name = d.characterName || d.characterId || "未知角色";
      const existing = characterMap.get(name) || { count: 0, totalLength: 0 };
      characterMap.set(name, {
        count: existing.count + 1,
        totalLength: existing.totalLength + (d.text?.length || 0),
      });

      // 情绪统计
      if (d.emotion) {
        emotionMap.set(d.emotion, (emotionMap.get(d.emotion) || 0) + 1);
      }
    });
  });

  const characterStats = Array.from(characterMap.entries()).map(
    ([name, data]) => ({
      characterName: name,
      dialogueCount: data.count,
      avgLength: Math.round(data.totalLength / data.count),
    })
  );

  const emotionDistribution: Record<string, number> = {};
  emotionMap.forEach((count, emotion) => {
    emotionDistribution[emotion] = count;
  });

  // 质量评分计算
  // 扣分项：过短节点、过长节点、缺少旁白
  const shortPenalty = shortNodes.length * 5;
  const longPenalty = longNodes.length * 3;
  const narrationPenalty = noNarrationNodes.length * 2;
  
  // 加分项：角色多样性、情绪丰富度
  const characterBonus = Math.min(20, characterStats.length * 4);
  const emotionBonus = Math.min(15, Object.keys(emotionDistribution).length * 3);

  const qualityScore = Math.max(
    0,
    Math.min(
      100,
      70 - shortPenalty - longPenalty - narrationPenalty + characterBonus + emotionBonus
    )
  );

  return {
    avgDialoguesPerNode: Math.round(avgDialogues * 10) / 10,
    shortNodes,
    longNodes,
    noNarrationNodes,
    characterStats,
    emotionDistribution,
    qualityScore,
  };
}
