/**
 * Mastra 实例配置
 * 注册所有 Agent 和 Workflow
 */
import { Mastra } from "@mastra/core/mastra";
import { createStoryPlannerAgent } from "../agents/storyPlanner";
import { createNodeWriterAgent } from "../agents/nodeWriter";
import { createStoryReviewerAgent } from "../agents/storyReviewer";
import { createStoryReviewerMcpAgent } from "../agents/storyReviewer.mcp";
import { storyGenerationWorkflow } from "../workflows/storyGeneration";
import type { LLMProfile } from "../utils/llm-config";

/**
 * 创建并导出 Mastra 实例
 * 
 * 包含：
 * - story-planner: 故事规划师 (ToT)
 * - node-writer: 节点写作师 (Few-Shot CoT)
 * - story-reviewer: 故事审稿人 (ReAct)
 * - story-generation: 完整的故事生成工作流
 */
function createMastraInstance(profile: LLMProfile = 'primary') {
  console.log(`[Mastra] 初始化 ${profile} 配置`);
  const useMcpReviewer = process.env.REVIEWER_USE_MCP === 'true';
  return new Mastra({
    agents: {
      "story-planner": createStoryPlannerAgent(profile),
      "node-writer": createNodeWriterAgent(profile),
      // 默认保留原实现；开启 REVIEWER_USE_MCP=true 则切到 MCP 工具版本
      "story-reviewer": useMcpReviewer ? createStoryReviewerMcpAgent(profile) : createStoryReviewerAgent(profile),
    },
    workflows: {
      "story-generation": storyGenerationWorkflow,
    },
  });
}

const mastraInstances: Partial<Record<LLMProfile, Mastra>> = {};

export function getMastra(profile: LLMProfile = 'primary') {
  if (!mastraInstances[profile]) {
    mastraInstances[profile] = createMastraInstance(profile);
  }
  return mastraInstances[profile]!;
}

export const mastra = getMastra();

/**
 * 获取 Story Generation Workflow
 */
export function getStoryWorkflow(profile: LLMProfile = 'primary') {
  return getMastra(profile).getWorkflow("story-generation");
}

/**
 * 获取指定 Agent
 */
export function getAgent(name: "story-planner" | "node-writer" | "story-reviewer") {
  return mastra.getAgent(name);
}

