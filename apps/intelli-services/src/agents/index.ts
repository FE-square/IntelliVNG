/**
 * Agents 模块导出
 */
export * from "./schemas";
export { storyPlannerAgent, generateNarrativePlan } from "./storyPlanner";
export { nodeWriterAgent, writeNodeContent } from "./nodeWriter";
export { 
  storyReviewerAgent, 
  reviewStory,
  validateStructureTool,
  analyzePathsTool,
  analyzeDialogueQualityTool,
} from "./storyReviewer";

// MCP version (保留原实现，同时提供接入 MCP 的版本)
export {
  storyReviewerMcpAgent,
  createStoryReviewerMcpAgent,
  reviewStoryMcp,
  validateStructureToolMcp,
  analyzePathsToolMcp,
  analyzeDialogueQualityToolMcp,
  analyzeBranchDistributionToolMcp,
  checkConstraintsComplianceToolMcp,
  scoreNonlinearityToolMcp,
} from "./storyReviewer.mcp";



