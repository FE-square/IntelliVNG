/**
 * Zod Schema 定义文件
 * 用于 Agent 的结构化输出验证
 */
import { z } from "zod";

// ============ Story Planner 输出 ============

export const PlanNodeSchema = z.object({
  id: z.string().describe("节点唯一标识"),
  type: z.enum(["scene", "branch", "ending"]).describe("节点类型"),
  isStart: z.boolean().optional().describe("是否为起始节点"),
  isEnding: z.boolean().optional().describe("是否为结局节点"),
  title: z.string().describe("节点标题"),
  brief: z.string().optional().describe("节点一句话摘要"), // 设为可选
  description: z.string().optional(), // 某些模型可能使用 description
  summary: z.string().optional(), // 某些模型可能使用 summary
  functionTag: z.enum([
    "setup", "rising", "conflict", "twist", "climax", "falling", "resolution"
  ]).optional().describe("叙事功能标签"), // 设为可选
  sceneName: z.string().optional().describe("绑定的场景名称"), // 设为可选
  scene: z.string().optional(), // 某些模型可能使用 scene
  location: z.string().optional(), // 某些模型可能使用 location
  nextNodeId: z.string().optional().describe("下一个节点ID"),
  next: z.string().optional(), // 某些模型可能使用 next
  choicesMeta: z.array(z.object({
    id: z.string().optional(),
    leadsTo: z.string().optional(),
    targetNodeId: z.string().optional(), // 某些模型可能使用 targetNodeId
    text: z.string().optional(),
    emotionalWeight: z.string().optional(),
    consequenceHint: z.string().optional(),
    pathType: z.string().optional(),
  }).passthrough()).optional().describe("分支选项元信息"),
  choices: z.array(z.any()).optional(), // 某些模型可能使用 choices
  position: z.object({ 
    x: z.number(), 
    y: z.number() 
  }).optional().describe("节点位置"),
}).passthrough().transform((data) => {
  // 标准化字段名
  return {
    id: data.id,
    type: data.type,
    isStart: data.isStart,
    isEnding: data.isEnding,
    title: data.title,
    brief: data.brief || data.description || data.summary || data.title,
    functionTag: data.functionTag || 'setup',
    sceneName: data.sceneName || data.scene || data.location || '未知场景',
    nextNodeId: data.nextNodeId || data.next,
    choicesMeta: data.choicesMeta || data.choices?.map((c: any) => ({
      id: c.id || Math.random().toString(36).substring(2, 8),
      leadsTo: c.leadsTo || c.targetNodeId || c.target || '',
      emotionalWeight: c.emotionalWeight || '中等',
      consequenceHint: c.consequenceHint || c.text || '',
      pathType: c.pathType || '中立',
    })),
    position: data.position || { x: 0, y: 0 },
  };
});

export const NarrativePlanSchema = z.object({
  outline: z.object({
    premise: z.string().describe("故事前提：一个关于...的故事"),
    centralConflict: z.string().describe("核心冲突"),
    thematicArc: z.string().describe("主题弧线"),
  }),
  nodes: z.array(PlanNodeSchema).describe("节点骨架列表"),
});

export type NarrativePlan = z.infer<typeof NarrativePlanSchema>;
export type PlanNode = z.infer<typeof PlanNodeSchema>;

// ============ Node Writer 输出 ============

export const DialogueDraftSchema = z.object({
  characterName: z.string().describe("说话角色的名称"),
  text: z.string().describe("对话内容"),
  emotion: z.string().optional().describe("角色情绪"),
});

export const ChoiceDraftSchema = z.object({
  id: z.string(),
  text: z.string().describe("玩家看到的选项文案"),
  targetNodeId: z.string().describe("目标节点ID"),
  meta: z.object({
    emotionalWeight: z.string(),
    consequenceHint: z.string(),
  }),
});

export const NodeDraftSchema = z.object({
  id: z.string().describe("与 PlanNode.id 对齐"),
  type: z.enum(["scene", "branch", "ending"]),
  title: z.string(),
  sceneName: z.string().optional(), // 设为可选
  scene: z.string().optional(), // 某些模型可能使用 scene
  narration: z.string().optional().nullable().describe("旁白/场景描述"),
  dialogues: z.array(DialogueDraftSchema).describe("对话列表"),
  choices: z.array(ChoiceDraftSchema).optional().nullable().describe("分支选项"),
  nextNodeId: z.string().optional().nullable().describe("下一个节点"), // 允许 null
  next: z.string().optional().nullable(), // 某些模型可能使用 next
  summary: z.string().optional().describe("一句话摘要"),
}).passthrough().transform((data) => ({
  id: data.id,
  type: data.type,
  title: data.title,
  sceneName: data.sceneName || data.scene || '未知场景',
  narration: data.narration || undefined,
  dialogues: data.dialogues,
  choices: data.choices || undefined,
  nextNodeId: data.nextNodeId || data.next || undefined,
  summary: data.summary || data.title,
}));

export type NodeDraft = z.infer<typeof NodeDraftSchema>;
export type DialogueDraft = z.infer<typeof DialogueDraftSchema>;
export type ChoiceDraft = z.infer<typeof ChoiceDraftSchema>;

// ============ Story Reviewer 输出 ============

export const IssueSchema = z.object({
  type: z.enum(["structure", "logic", "character", "dialogue", "branch"]),
  severity: z.enum(["minor", "major", "critical"]),
  nodeIds: z.array(z.string()).describe("相关节点ID"),
  description: z.string().describe("问题描述"),
  suggestion: z.string().describe("修改建议"),
});

export const CriticReportSchema = z.object({
  scores: z.object({
    plotCoherence: z.number().min(0).max(100).describe("情节连贯性"),
    characterConsistency: z.number().min(0).max(100).describe("角色一致性"),
    dialogueQuality: z.number().min(0).max(100).describe("对话质量"),
    branchMeaningfulness: z.number().min(0).max(100).describe("分支有意义程度"),
    pacing: z.number().min(0).max(100).describe("节奏"),
  }),
  overallScore: z.number().min(0).max(100).describe("综合评分"),
  issues: z.array(IssueSchema).describe("问题列表"),
  shouldRegenerate: z.boolean().describe("是否需要重新生成"),
  regenerateTarget: z.enum(["none", "specific_nodes", "all"]),
  targetNodeIds: z.array(z.string()).optional().describe("需要重写的节点ID"),
});

export type CriticReport = z.infer<typeof CriticReportSchema>;
export type Issue = z.infer<typeof IssueSchema>;

// ============ Workflow 输入输出 ============

export const WorkflowInputSchema = z.object({
  worldBible: z.object({
    name: z.string().optional(),
    era: z.string().optional(),
    location: z.string().optional(),
    rules: z.string().optional(),
    scenes: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string().optional(),
      atmosphere: z.string().optional(),
      details: z.string().optional(),
    })).optional(),
  }),
  characterDB: z.object({
    characters: z.array(z.object({
      id: z.string().optional(),
      name: z.string(),
      displayName: z.string().optional(),
      gender: z.string().optional(),
      identity: z.string().optional(),
      description: z.string().optional(),
      personality: z.object({
        traits: z.array(z.string()).optional(),
      }).optional(),
      coreTraits: z.object({
        specialSkills: z.array(z.string()).optional(),
        obsession: z.string().optional(),
      }).optional(),
    })),
  }),
  styleGuide: z.object({
    themes: z.array(z.string()).optional(),
    styles: z.array(z.string()).optional(),
    tone: z.string().optional(),
  }).optional(),
  constraints: z.object({
    targetNodeCount: z.number().default(12),
    targetEndingCount: z.number().default(3),
  }).optional(),
  locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
});

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;



