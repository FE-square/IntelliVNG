/**
 * Story Reviewer Agent (MCP version)
 *
 * 目标：
 * - 保留原 `storyReviewer.ts` 的本地工具实现
 * - 额外提供一个通过 MCP 调用 `packages/mcp-server` 工具的版本
 *
 * 注意：
 * - 该版本工具 id 仍沿用 validate-structure / analyze-paths / analyze-dialogue-quality，
 *   以兼容现有 ReAct 提示词风格；但底层实际映射到 MCP server 的 toolName：
 *   - validate_story_structure
 *   - analyze_story_paths
 *   - analyze_dialogue_quality
 *   - analyze_branch_distribution
 *   - check_constraints_compliance
 *   - score_nonlinearity
 */
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { promptManager } from "../prompts";
import { generateStructuredOutput } from "../utils/structured-output-helper";
import { buildMastraModelConfig, type LLMProfile } from "../utils/llm-config";
import { type Locale, DEFAULT_LOCALE } from "../utils/locale";
import { callIntelliVngMcpTool } from "../services/intellivng-mcp-client";

const STRICT_TOOL_MODELS = ["gpt", "o1"];
function shouldUseStrictToolSchema() {
  const flag = process.env.REVIEWER_STRICT_TOOLS;
  if (flag === "true") return true;
  if (flag === "false") return false;
  const model = (process.env.OPENAI_MODEL_NAME || "").toLowerCase();
  return STRICT_TOOL_MODELS.some((kw) => model.includes(kw));
}
const useStrictToolSchema = shouldUseStrictToolSchema();

const strictStructureNode = z.object({
  id: z.string(),
  type: z.string().optional(),
  isStart: z.boolean().optional(),
  isEnding: z.boolean().optional(),
  functionTag: z
    .enum(["setup", "rising", "conflict", "twist", "climax", "falling", "resolution"])
    .optional(),
  nextNodeId: z.string().optional(),
  choices: z
    .array(
      z.object({
        targetNodeId: z.string(),
        branchType: z.enum(["route", "relationship", "information", "ending"]).optional(),
      })
    )
    .optional(),
});

const strictDialogueNode = strictStructureNode.extend({
  dialogues: z
    .array(
      z.object({
        characterId: z.string().optional(),
        characterName: z.string().optional(),
        text: z.string(),
        emotion: z.string().optional(),
      })
    )
    .optional(),
  narration: z.string().optional(),
});

const structureNodesSchema = useStrictToolSchema
  ? z.array(strictStructureNode)
  : z.array(z.any()).describe("节点列表，包含id, nextNodeId, choices等连接信息");

const dialogueNodesSchema = useStrictToolSchema
  ? z.array(strictDialogueNode)
  : z.array(z.any()).describe("节点列表，包含id, dialogues, narration等内容信息");

// ============ MCP Tool wrappers ============

export const validateStructureToolMcp = createTool({
  id: "validate-structure",
  description: "（MCP）检查节点连通性，找出孤立节点和死胡同。在审阅故事前必须先调用此工具。",
  inputSchema: z.object({
    nodes: structureNodesSchema,
    locale: z.enum(["zh-CN", "zh-HK", "en-US"]).optional(),
  }),
  execute: async ({ context }) => {
    const { nodes, locale } = context as any;
    return callIntelliVngMcpTool("validate_story_structure", {
      nodes,
      locale: locale === "zh-HK" ? "zh-CN" : locale, // mcp-server 目前仅 zh-CN/en-US
    });
  },
});

export const analyzePathsToolMcp = createTool({
  id: "analyze-paths",
  description: "（MCP）分析所有可能的故事路径，评估分支的多样性和意义性。",
  inputSchema: z.object({
    nodes: structureNodesSchema,
  }),
  execute: async ({ context }) => {
    const { nodes } = context as any;
    return callIntelliVngMcpTool("analyze_story_paths", { nodes });
  },
});

export const analyzeDialogueQualityToolMcp = createTool({
  id: "analyze-dialogue-quality",
  description: "（MCP）分析每个节点的对话数量和质量，找出对话过少或过多的节点。",
  inputSchema: z.object({
    nodes: dialogueNodesSchema,
  }),
  execute: async ({ context }) => {
    const { nodes } = context as any;
    return callIntelliVngMcpTool("analyze_dialogue_quality", { nodes });
  },
});

export const analyzeBranchDistributionToolMcp = createTool({
  id: "analyze-branch-distribution",
  description: "（MCP）分析分支在故事各阶段的分布，检测伪非线性问题。",
  inputSchema: z.object({
    nodes: structureNodesSchema,
    locale: z.enum(["zh-CN", "zh-HK", "en-US"]).optional(),
  }),
  execute: async ({ context }) => {
    const { nodes, locale } = context as any;
    return callIntelliVngMcpTool("analyze_branch_distribution", {
      nodes,
      locale: locale === "zh-HK" ? "zh-CN" : locale,
    });
  },
});

export const checkConstraintsComplianceToolMcp = createTool({
  id: "check-constraints-compliance",
  description: "（MCP）对照约束条件校验故事规模/深度/分支等是否合规。",
  inputSchema: z.object({
    nodes: structureNodesSchema,
    constraints: z
      .object({
        targetNodeCount: z.number().optional(),
        targetEndingCount: z.number().optional(),
        maxDepth: z.number().optional(),
        maxBranching: z.number().optional(),
      })
      .optional(),
    locale: z.enum(["zh-CN", "zh-HK", "en-US"]).optional(),
  }),
  execute: async ({ context }) => {
    const { nodes, constraints, locale } = context as any;
    return callIntelliVngMcpTool("check_constraints_compliance", {
      nodes,
      constraints,
      locale: locale === "zh-HK" ? "zh-CN" : locale,
    });
  },
});

export const scoreNonlinearityToolMcp = createTool({
  id: "score-nonlinearity",
  description: "（MCP）生成 0-100 的非线性综合评分（含分支分布/路径多样性/认知友好度）。",
  inputSchema: z.object({
    nodes: structureNodesSchema,
    locale: z.enum(["zh-CN", "zh-HK", "en-US"]).optional(),
  }),
  execute: async ({ context }) => {
    const { nodes, locale } = context as any;
    return callIntelliVngMcpTool("score_nonlinearity", {
      nodes,
      locale: locale === "zh-HK" ? "zh-CN" : locale,
    });
  },
});

// ============ MCP Reviewer Agent ============

export function createStoryReviewerMcpAgent(profile: LLMProfile = "primary") {
  return new Agent({
    name: "story-reviewer-mcp",
    instructions: promptManager.build("story-reviewer.instructions.mcp").user,
    model: buildMastraModelConfig(profile),
    tools: {
      validateStructure: validateStructureToolMcp,
      analyzePaths: analyzePathsToolMcp,
      analyzeDialogueQuality: analyzeDialogueQualityToolMcp,
      analyzeBranchDistribution: analyzeBranchDistributionToolMcp,
      checkConstraintsCompliance: checkConstraintsComplianceToolMcp,
      scoreNonlinearity: scoreNonlinearityToolMcp,
    },
  });
}

export const storyReviewerMcpAgent = createStoryReviewerMcpAgent();

/**
 * MCP Reviewer 的调用包装函数（沿用原两阶段：ReAct -> Format）
 */
export async function reviewStoryMcp(
  agent: typeof storyReviewerMcpAgent,
  input: {
    plan: any;
    drafts: Record<string, any>;
    worldBible: any;
    characterDB: any;
    constraints?: {
      targetNodeCount?: number;
      targetEndingCount?: number;
      maxDepth?: number;
      maxBranching?: number;
    };
  },
  schema: any,
  locale: Locale = DEFAULT_LOCALE
): Promise<any> {
  const disableReAct =
    process.env.REVIEWER_DISABLE_REACT === "true" ||
    (process.env.OPENAI_MODEL_NAME || "").toLowerCase().includes("qwen");

  if (disableReAct) {
    // 退化：不走工具调用
    const { user: reviewPrompt } = promptManager.build(
      "workflow.review",
      {
        drafts: JSON.stringify(Object.values(input.drafts), null, 2),
        planOutline: JSON.stringify(input.plan.outline, null, 2),
        characters: JSON.stringify(
          input.characterDB.characters?.map((c: any) => ({
            name: c.name,
            displayName: c.displayName,
            personality: c.personality?.traits,
          })),
          null,
          2
        ),
        nodesForValidation: JSON.stringify(Object.values(input.drafts), null, 2),
      },
      locale
    );
    return generateStructuredOutput(agent as any, reviewPrompt, schema, { temperature: 1 });
  }

  const { plan, drafts } = input;

  // 供 MCP 工具使用的节点数据（比原版更全：functionTag / branchType）
  const nodesForValidation = Object.values(drafts).map((d: any) => {
    const planNode = plan.nodes.find((n: any) => n.id === d.id);
    const planChoices = planNode?.choicesMeta || [];
    const choiceMap: Map<string, any> = new Map(planChoices.map((c: any) => [c.leadsTo, c]));
    return {
      id: d.id,
      type: d.type,
      isStart: planNode?.isStart,
      isEnding: planNode?.isEnding,
      functionTag: planNode?.functionTag,
      nextNodeId: d.nextNodeId,
      choices: d.choices?.map((c: any) => ({
        targetNodeId: c.targetNodeId,
        branchType: choiceMap.get(c.targetNodeId)?.branchType,
      })),
      dialogues: d.dialogues,
      narration: d.narration,
    };
  });

  // ============ 阶段 1: ReAct（工具调用） ============
  const { user: reactPrompt } = promptManager.build(
    "story-reviewer.react.mcp",
    {
      drafts: JSON.stringify(Object.values(drafts), null, 2),
      planOutline: JSON.stringify(plan.outline, null, 2),
      characters: JSON.stringify(
        input.characterDB.characters?.map((c: any) => ({
          name: c.name,
          displayName: c.displayName,
          personality: c.personality?.traits,
        })),
        null,
        2
      ),
      nodesForValidation: JSON.stringify(nodesForValidation, null, 2),
      constraints: JSON.stringify(input.constraints || {}, null, 2),
      locale,
    },
    locale
  );

  let reactResponse: any;
  try {
    reactResponse = await agent.generate(reactPrompt, {
      maxSteps: 8,
      modelSettings: { temperature: 1 },
    });
  } catch (error) {
    // 工具调用失败则回退
    const { user: reviewPrompt } = promptManager.build(
      "workflow.review",
      {
        drafts: JSON.stringify(Object.values(drafts), null, 2),
        planOutline: JSON.stringify(plan.outline, null, 2),
        characters: JSON.stringify(input.characterDB.characters || [], null, 2),
        nodesForValidation: JSON.stringify(nodesForValidation, null, 2),
      },
      locale
    );
    return generateStructuredOutput(agent as any, reviewPrompt, schema, { temperature: 1 });
  }

  // ============ 阶段 2: 格式化输出 ============
  const { user: formatPrompt } = promptManager.build(
    "story-reviewer.format",
    {
      reactAnalysis: reactResponse.text,
      toolResults: JSON.stringify(reactResponse.toolResults || [], null, 2),
    },
    locale
  );

  return generateStructuredOutput(agent as any, formatPrompt, schema, { temperature: 1 });
}

