/**
 * 约束合规检查工具
 * 校验故事图是否满足规模/分支/深度等约束
 */
import { z } from "zod";
import { t } from "../utils/i18n.js";
export const CheckConstraintsInputSchema = z.object({
    nodes: z
        .array(z.object({
        id: z.string().describe("节点唯一标识"),
        isStart: z.boolean().optional().describe("是否为起始节点"),
        isEnding: z.boolean().optional().describe("是否为结局节点"),
        nextNodeId: z.string().optional().describe("线性下一节点"),
        choices: z
            .array(z.object({
            targetNodeId: z.string().describe("分支目标节点ID"),
        }))
            .optional()
            .describe("分支选项"),
    }))
        .describe("故事节点列表"),
    constraints: z
        .object({
        targetNodeCount: z.number().optional().describe("目标节点数"),
        targetEndingCount: z.number().optional().describe("目标结局数"),
        maxDepth: z.number().optional().describe("允许的最大路径深度"),
        maxBranching: z.number().optional().describe("单节点最大分支数"),
    })
        .optional()
        .describe("约束配置"),
    locale: z.enum(["zh-CN", "en-US"]).optional().default("zh-CN").describe("语言环境 (zh-CN/en-US)"),
});
export const CheckConstraintsOutputSchema = z.object({
    nodeCount: z.number(),
    endingCount: z.number(),
    branchPointCount: z.number(),
    maxDepthFound: z.number(),
    maxBranchingFound: z.number(),
    hasStart: z.boolean(),
    violations: z.array(z.string()),
    complianceScore: z.number(),
});
function resolveStart(nodes) {
    const explicitStart = nodes.find((n) => n.isStart);
    return {
        hasStart: Boolean(explicitStart),
        startNode: explicitStart || nodes[0],
    };
}
function computeMaxDepth(nodes, startId) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const MAX_DEPTH = 200;
    const dfs = (id, visited) => {
        if (visited.has(id))
            return visited.size; // 避免循环
        const node = nodeMap.get(id);
        if (!node)
            return visited.size;
        const nextVisited = new Set(visited);
        nextVisited.add(id);
        const depths = [];
        if (node.choices && node.choices.length > 0) {
            node.choices.forEach((c) => depths.push(dfs(c.targetNodeId, nextVisited)));
        }
        if (node.nextNodeId) {
            depths.push(dfs(node.nextNodeId, nextVisited));
        }
        if (depths.length === 0)
            return nextVisited.size;
        return Math.min(MAX_DEPTH, Math.max(...depths));
    };
    return dfs(startId, new Set());
}
export function checkConstraints(input) {
    const { nodes, constraints } = input;
    const locale = input.locale || "zh-CN";
    const nodeCount = nodes.length;
    const endingCount = nodes.filter((n) => n.isEnding).length;
    const branchPointCount = nodes.filter((n) => (n.choices?.length || 0) > 1).length;
    const maxBranchingFound = nodes.reduce((max, n) => Math.max(max, n.choices?.length || 0), 0);
    const { hasStart, startNode } = resolveStart(nodes);
    const maxDepthFound = startNode ? computeMaxDepth(nodes, startNode.id) : 0;
    const violations = [];
    if (!hasStart)
        violations.push(t("constraint.missingStart", locale));
    if (constraints?.targetNodeCount !== undefined && nodeCount !== constraints.targetNodeCount) {
        violations.push(t("constraint.nodeCount", locale, { actual: nodeCount, target: constraints.targetNodeCount }));
    }
    if (constraints?.targetEndingCount !== undefined &&
        endingCount !== constraints.targetEndingCount) {
        violations.push(t("constraint.endingCount", locale, { actual: endingCount, target: constraints.targetEndingCount }));
    }
    if (constraints?.maxDepth !== undefined && maxDepthFound > constraints.maxDepth) {
        violations.push(t("constraint.maxDepth", locale, { actual: maxDepthFound, target: constraints.maxDepth }));
    }
    if (constraints?.maxBranching !== undefined &&
        maxBranchingFound > constraints.maxBranching) {
        violations.push(t("constraint.maxBranching", locale, { actual: maxBranchingFound, target: constraints.maxBranching }));
    }
    // 计算合规评分：每条违规扣 10 分，最低 0
    const complianceScore = Math.max(0, 100 - violations.length * 10);
    return {
        nodeCount,
        endingCount,
        branchPointCount,
        maxDepthFound,
        maxBranchingFound,
        hasStart,
        violations,
        complianceScore,
    };
}
//# sourceMappingURL=check-constraints.js.map