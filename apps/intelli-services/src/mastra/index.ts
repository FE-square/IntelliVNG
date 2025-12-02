/**
 * Mastra 实例配置
 * 注册所有 Agent 和 Workflow
 */
import { Mastra } from "@mastra/core/mastra";
import { storyPlannerAgent } from "../agents/storyPlanner";
import { nodeWriterAgent } from "../agents/nodeWriter";
import { storyReviewerAgent } from "../agents/storyReviewer";
import { storyGenerationWorkflow } from "../workflows/storyGeneration";

/**
 * 创建并导出 Mastra 实例
 * 
 * 包含：
 * - story-planner: 故事规划师 (ToT)
 * - node-writer: 节点写作师 (Few-Shot CoT)
 * - story-reviewer: 故事审稿人 (ReAct)
 * - story-generation: 完整的故事生成工作流
 */
export const mastra = new Mastra({
  agents: {
    "story-planner": storyPlannerAgent,
    "node-writer": nodeWriterAgent,
    "story-reviewer": storyReviewerAgent,
  },
  workflows: {
    "story-generation": storyGenerationWorkflow,
  },
});

/**
 * 获取 Story Generation Workflow
 */
export function getStoryWorkflow() {
  return mastra.getWorkflow("story-generation");
}

/**
 * 获取指定 Agent
 */
export function getAgent(name: "story-planner" | "node-writer" | "story-reviewer") {
  return mastra.getAgent(name);
}

