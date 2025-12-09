/**
 * 路径多样性分析工具
 * 枚举所有可能的故事路径，评估分支的多样性
 *
 * 这是评估非线性叙事质量的关键工具
 */
import { z } from "zod";
// 输入 Schema
export const AnalyzePathsInputSchema = z.object({
    nodes: z.array(z.object({
        id: z.string().describe("节点唯一标识"),
        type: z.string().optional().describe("节点类型"),
        isStart: z.boolean().optional().describe("是否为起始节点"),
        isEnding: z.boolean().optional().describe("是否为结局节点"),
        nextNodeId: z.string().optional().describe("下一个节点ID"),
        choices: z.array(z.object({
            targetNodeId: z.string().describe("分支目标节点ID"),
        })).optional().describe("分支选项"),
    })).describe("故事节点列表"),
});
// 输出 Schema
export const AnalyzePathsOutputSchema = z.object({
    totalPaths: z.number().describe("总路径数量"),
    diversityScore: z.number().describe("多样性评分 (0-1)"),
    pathDescriptions: z.array(z.string()).describe("路径描述（最多显示5条）"),
    avgPathLength: z.number().describe("平均路径长度"),
    lengthVariance: z.number().describe("路径长度方差（体验丰富度指标）"),
    endingCount: z.number().describe("结局数量"),
    branchPointCount: z.number().describe("分支点数量"),
    nonLinearityScore: z.number().describe("非线性程度评分 (0-100)"),
});
/**
 * 执行路径分析
 */
export function analyzePaths(input) {
    const { nodes } = input;
    const paths = [];
    const startNode = nodes.find((n) => n.isStart);
    if (!startNode) {
        return {
            totalPaths: 0,
            diversityScore: 0,
            pathDescriptions: [],
            avgPathLength: 0,
            lengthVariance: 0,
            endingCount: 0,
            branchPointCount: 0,
            nonLinearityScore: 0,
        };
    }
    // DFS 枚举所有路径（防止无限循环，限制最大深度）
    const MAX_DEPTH = 50;
    const dfs = (nodeId, currentPath, visited) => {
        if (currentPath.length > MAX_DEPTH)
            return;
        const node = nodes.find((n) => n.id === nodeId);
        if (!node)
            return;
        // 防止循环
        if (visited.has(nodeId))
            return;
        const newVisited = new Set(visited);
        newVisited.add(nodeId);
        currentPath.push(nodeId);
        if (node.isEnding) {
            paths.push([...currentPath]);
        }
        else if (node.choices && node.choices.length > 0) {
            node.choices.forEach((choice) => {
                dfs(choice.targetNodeId, [...currentPath], newVisited);
            });
        }
        else if (node.nextNodeId) {
            dfs(node.nextNodeId, currentPath, newVisited);
        }
    };
    dfs(startNode.id, [], new Set());
    // 统计分支点和结局
    const branchPointCount = nodes.filter((n) => n.choices && n.choices.length > 1).length;
    const endingCount = nodes.filter((n) => n.isEnding).length;
    // 计算多样性评分
    const uniqueNodes = new Set(paths.flat()).size;
    const avgLength = paths.length > 0
        ? paths.reduce((sum, p) => sum + p.length, 0) / paths.length
        : 0;
    // 评分公式：路径数 * 独特节点率，归一化到 0-1
    const diversityScore = Math.min(1, (paths.length * uniqueNodes) / (nodes.length * 3));
    // 计算路径长度标准差（路径长度差异越大，体验越丰富）
    const lengthVariance = paths.length > 1
        ? paths.reduce((sum, p) => sum + Math.pow(p.length - avgLength, 2), 0) /
            paths.length
        : 0;
    // 非线性程度评分 (0-100)
    // 考虑因素：分支点数量、路径数量、结局数量、路径长度差异
    const nonLinearityScore = Math.min(100, Math.round((branchPointCount * 15 +
        paths.length * 10 +
        endingCount * 10 +
        Math.sqrt(lengthVariance) * 5) /
        (nodes.length / 5)));
    return {
        totalPaths: paths.length,
        diversityScore: Math.round(diversityScore * 100) / 100,
        pathDescriptions: paths.slice(0, 5).map((p) => p.join(" → ")),
        avgPathLength: Math.round(avgLength * 10) / 10,
        lengthVariance: Math.round(lengthVariance * 10) / 10,
        endingCount,
        branchPointCount,
        nonLinearityScore,
    };
}
//# sourceMappingURL=analyze-paths.js.map