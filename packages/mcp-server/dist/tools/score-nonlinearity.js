/**
 * 非线性综合评分工具
 * 复用路径分析与分支分布分析，给出单一可视化评分
 */
import { z } from "zod";
import { t } from "../utils/i18n.js";
import { analyzePaths, } from "./analyze-paths.js";
import { analyzeBranchDistribution, AnalyzeBranchDistributionInputSchema, } from "./analyze-branch-distribution.js";
export const ScoreNonLinearityInputSchema = z.object({
    nodes: AnalyzeBranchDistributionInputSchema.shape.nodes,
    locale: z.enum(["zh-CN", "en-US"]).optional().default("zh-CN").describe("语言环境 (zh-CN/en-US)"),
});
export const ScoreNonLinearityOutputSchema = z.object({
    overallScore: z.number().describe("综合非线性评分 0-100"),
    components: z.object({
        pathNonLinearity: z.number(),
        distributionScore: z.number(),
        diversityScore: z.number(),
        cognitiveFriendlyScore: z.number().describe("认知友好度评分（基于分支复杂度）"),
    }),
    endingCount: z.number(),
    branchPointCount: z.number(),
    earlyBranchRatio: z.number(),
    notes: z.array(z.string()),
});
export function scoreNonLinearity(input) {
    const { nodes } = input;
    const locale = input.locale || "zh-CN";
    const pathResult = analyzePaths({ nodes });
    const distResult = analyzeBranchDistribution({ nodes, locale });
    const pathScore = pathResult.nonLinearityScore; // 0-100
    const distScore = distResult.distributionScore; // 0-100
    const diversityScore = Math.round((pathResult.diversityScore || 0) * 100); // 0-100
    // 计算认知友好度
    // 依据米勒定律 (The Magical Number Seven, Plus or Minus Two)
    // 单节点分支数超过 5 个会显著增加认知负载
    const maxChoices = nodes.reduce((max, n) => Math.max(max, n.choices?.length || 0), 0);
    let cognitiveFriendlyScore = 100;
    if (maxChoices > 7)
        cognitiveFriendlyScore = 40;
    else if (maxChoices > 5)
        cognitiveFriendlyScore = 60;
    else if (maxChoices > 3)
        cognitiveFriendlyScore = 80; // 3-5 个选项略多但可接受
    else
        cognitiveFriendlyScore = 100; // 1-3 个选项最佳
    const overallScore = Math.min(100, Math.round(pathScore * 0.4 + distScore * 0.3 + diversityScore * 0.2 + cognitiveFriendlyScore * 0.1));
    const notes = [];
    if (distResult.isPseudoNonLinear) {
        notes.push(t("score.pseudo", locale));
    }
    if (pathResult.totalPaths <= 1) {
        notes.push(t("score.singlePath", locale));
    }
    if (distResult.branchTypeStats.route === 0) {
        notes.push(t("score.noRoute", locale));
    }
    if (cognitiveFriendlyScore < 70) {
        notes.push(t("score.cognitive.high", locale));
    }
    else {
        notes.push(t("score.cognitive.good", locale));
    }
    if (notes.length === 1 && cognitiveFriendlyScore >= 70) {
        notes.pop(); // 清除 cognitive.good 提示，只保留最重要的
        notes.push(t("score.good", locale));
    }
    return {
        overallScore,
        components: {
            pathNonLinearity: pathScore,
            distributionScore: distScore,
            diversityScore,
            cognitiveFriendlyScore,
        },
        endingCount: pathResult.endingCount,
        branchPointCount: pathResult.branchPointCount,
        earlyBranchRatio: distResult.earlyBranchRatio,
        notes,
    };
}
//# sourceMappingURL=score-nonlinearity.js.map