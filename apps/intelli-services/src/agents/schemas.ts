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
  brief: z.string().describe("节点一句话摘要"),
  functionTag: z.enum([
    "setup",      // 开端
    "rising",     // 递进
    "conflict",   // 冲突
    "twist",      // 转折
    "climax",     // 高潮
    "falling",    // 下落
    "resolution"  // 解决
  ]).describe("叙事功能标签"),
  sceneName: z.string().describe("绑定的场景名称"),
  nextNodeId: z.string().optional().describe("下一个节点ID（线性连接）"),
  choicesMeta: z.array(z.object({
    id: z.string(),
    leadsTo: z.string().describe("目标节点ID"),
    emotionalWeight: z.string().describe("情感重量：轻松/沉重/痛苦抉择"),
    consequenceHint: z.string().describe("后果暗示（不剧透）"),
    pathType: z.string().describe("路线类型：通向好结局/坏结局/中立"),
  })).optional().describe("分支选项元信息"),
  position: z.object({ 
    x: z.number(), 
    y: z.number() 
  }).describe("节点在画布上的位置"),
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
  sceneName: z.string(),
  narration: z.string().optional().describe("旁白/场景描述"),
  dialogues: z.array(DialogueDraftSchema).describe("对话列表，3-6段"),
  choices: z.array(ChoiceDraftSchema).optional().describe("分支选项（仅branch类型）"),
  nextNodeId: z.string().optional().describe("下一个节点（仅scene类型）"),
  summary: z.string().describe("一句话摘要，供后续节点参考"),
});

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



