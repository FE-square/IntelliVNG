/**
 * 非线性综合评分工具
 * 复用路径分析与分支分布分析，给出单一可视化评分
 */
import { z } from "zod";
import {
  analyzePaths,
  AnalyzePathsInputSchema,
} from "./analyze-paths.js";
import {
  analyzeBranchDistribution,
  AnalyzeBranchDistributionInputSchema,
} from "./analyze-branch-distribution.js";

export const ScoreNonLinearityInputSchema = z.object({
  nodes: AnalyzeBranchDistributionInputSchema.shape.nodes,
});

export const ScoreNonLinearityOutputSchema = z.object({
  overallScore: z.number().describe("综合非线性评分 0-100"),
  components: z.object({
    pathNonLinearity: z.number(),
    distributionScore: z.number(),
    diversityScore: z.number(),
  }),
  endingCount: z.number(),
  branchPointCount: z.number(),
  earlyBranchRatio: z.number(),
  notes: z.array(z.string()),
});

export type ScoreNonLinearityInput = z.infer<typeof ScoreNonLinearityInputSchema>;
export type ScoreNonLinearityOutput = z.infer<
  typeof ScoreNonLinearityOutputSchema
>;

export function scoreNonLinearity(
  input: ScoreNonLinearityInput
): ScoreNonLinearityOutput {
  const { nodes } = input;

  const pathResult = analyzePaths({ nodes });
  const distResult = analyzeBranchDistribution({ nodes });

  const pathScore = pathResult.nonLinearityScore; // 0-100
  const distScore = distResult.distributionScore; // 0-100
  const diversityScore = Math.round((pathResult.diversityScore || 0) * 100); // 0-100

  const overallScore = Math.min(
    100,
    Math.round(pathScore * 0.5 + distScore * 0.3 + diversityScore * 0.2)
  );

  const notes: string[] = [];
  if (distResult.isPseudoNonLinear) {
    notes.push("检测到伪非线性：分支集中在后期。");
  }
  if (pathResult.totalPaths <= 1) {
    notes.push("仅发现 1 条路径，缺乏分支。");
  }
  if (distResult.branchTypeStats.route === 0) {
    notes.push("缺少 route 类型分支，故事路线分歧不足。");
  }
  if (notes.length === 0) {
    notes.push("非线性结构良好，可直接呈现。");
  }

  return {
    overallScore,
    components: {
      pathNonLinearity: pathScore,
      distributionScore: distScore,
      diversityScore,
    },
    endingCount: pathResult.endingCount,
    branchPointCount: pathResult.branchPointCount,
    earlyBranchRatio: distResult.earlyBranchRatio,
    notes,
  };
}
