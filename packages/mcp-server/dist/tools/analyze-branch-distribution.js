/**
 * 分支分布分析工具
 * 检测"伪非线性"问题 - 即分支是否过于集中在故事末尾
 *
 * 真正的非线性叙事应该在故事早期就开始分支
 */
import { z } from "zod";
import { t } from "../utils/i18n.js";
// 输入 Schema
export const AnalyzeBranchDistributionInputSchema = z.object({
    nodes: z.array(z.object({
        id: z.string().describe("节点唯一标识"),
        type: z.enum(["scene", "branch", "ending"]).optional().describe("节点类型"),
        isStart: z.boolean().optional().describe("是否为起始节点"),
        isEnding: z.boolean().optional().describe("是否为结局节点"),
        functionTag: z.enum([
            "setup", "rising", "conflict", "twist", "climax", "falling", "resolution"
        ]).optional().describe("叙事功能标签"),
        nextNodeId: z.string().optional(),
        choices: z.array(z.object({
            targetNodeId: z.string(),
            branchType: z.enum(["route", "relationship", "information", "ending"]).optional(),
        })).optional(),
    })).describe("故事节点列表"),
    locale: z.enum(["zh-CN", "en-US"]).optional().default("zh-CN").describe("语言环境 (zh-CN/en-US)"),
});
// 输出 Schema
export const AnalyzeBranchDistributionOutputSchema = z.object({
    isPseudoNonLinear: z.boolean().describe("是否为伪非线性（分支集中在末尾）"),
    distributionScore: z.number().describe("分支分布评分 (0-100)"),
    branchByPhase: z.object({
        setup: z.number().describe("开端阶段的分支数"),
        rising: z.number().describe("上升阶段的分支数"),
        conflict: z.number().describe("冲突阶段的分支数"),
        climax: z.number().describe("高潮阶段的分支数"),
        resolution: z.number().describe("结局阶段的分支数"),
    }).describe("各阶段分支分布"),
    branchTypeStats: z.object({
        route: z.number().describe("路线分支数量"),
        relationship: z.number().describe("关系分支数量"),
        information: z.number().describe("信息分支数量"),
        ending: z.number().describe("结局分支数量"),
    }).describe("分支类型统计"),
    suggestions: z.array(z.string()).describe("改进建议"),
    earlyBranchRatio: z.number().describe("早期分支占比 (0-1)"),
});
/**
 * 执行分支分布分析
 */
export function analyzeBranchDistribution(input) {
    const { nodes } = input;
    const locale = input.locale || "zh-CN";
    // 阶段映射
    const earlyPhases = new Set(["setup", "rising", "conflict"]);
    const latePhases = new Set(["climax", "falling", "resolution"]);
    // 统计各阶段分支数
    const branchByPhase = {
        setup: 0,
        rising: 0,
        conflict: 0,
        climax: 0,
        resolution: 0,
    };
    // 统计分支类型
    const branchTypeStats = {
        route: 0,
        relationship: 0,
        information: 0,
        ending: 0,
    };
    let totalBranches = 0;
    let earlyBranches = 0;
    let lateBranches = 0;
    let totalBranchChoices = 0;
    nodes.forEach((node) => {
        if (node.choices && node.choices.length > 1) {
            totalBranches++;
            totalBranchChoices += node.choices.length;
            // 按叙事阶段统计
            const phase = node.functionTag || "conflict"; // 默认为冲突阶段
            if (phase === "setup")
                branchByPhase.setup++;
            else if (phase === "rising")
                branchByPhase.rising++;
            else if (phase === "conflict" || phase === "twist")
                branchByPhase.conflict++;
            else if (phase === "climax")
                branchByPhase.climax++;
            else if (phase === "falling" || phase === "resolution")
                branchByPhase.resolution++;
            // 统计早期/晚期分支
            if (earlyPhases.has(phase))
                earlyBranches++;
            if (latePhases.has(phase))
                lateBranches++;
            // 按分支类型统计
            node.choices.forEach((choice) => {
                const branchType = choice.branchType || "route";
                if (branchType in branchTypeStats) {
                    branchTypeStats[branchType]++;
                }
            });
        }
    });
    // 计算早期分支占比
    const earlyBranchRatio = totalBranches > 0 ? earlyBranches / totalBranches : 0;
    // 判断是否为伪非线性
    // 条件：超过 70% 的分支在故事后半段（climax/resolution）
    const isPseudoNonLinear = totalBranches > 0 && lateBranches / totalBranches > 0.7;
    // 计算分布评分
    // 理想情况：分支均匀分布，且有 route 类型分支
    let distributionScore = 50; // 基础分
    // 早期分支加分（每有一个早期分支 +10，最多 +30）
    distributionScore += Math.min(30, earlyBranches * 10);
    // route 类型分支加分（说明有真正的路线分歧）
    distributionScore += Math.min(20, branchTypeStats.route * 5);
    // 如果只有 ending 分支，扣分
    if (branchTypeStats.ending > 0 && branchTypeStats.route === 0 && branchTypeStats.relationship === 0) {
        distributionScore -= 20;
    }
    // 如果是伪非线性，大幅扣分
    if (isPseudoNonLinear) {
        distributionScore -= 30;
    }
    distributionScore = Math.max(0, Math.min(100, distributionScore));
    // 生成建议
    const suggestions = [];
    if (isPseudoNonLinear) {
        suggestions.push(t("dist.pseudo", locale));
    }
    if (branchByPhase.setup === 0 && branchByPhase.rising === 0) {
        suggestions.push(t("dist.noStartBranch", locale));
    }
    if (branchTypeStats.route === 0) {
        suggestions.push(t("dist.noRoute", locale));
    }
    if (totalBranchChoices > 0 && branchTypeStats.ending === totalBranchChoices) {
        suggestions.push(t("dist.allEnding", locale));
    }
    if (distributionScore >= 80) {
        suggestions.push(t("dist.good", locale));
    }
    return {
        isPseudoNonLinear,
        distributionScore,
        branchByPhase,
        branchTypeStats,
        suggestions,
        earlyBranchRatio: Math.round(earlyBranchRatio * 100) / 100,
    };
}
//# sourceMappingURL=analyze-branch-distribution.js.map