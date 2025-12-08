/**
 * 故事结构校验工具
 * 检查节点连通性，找出孤立节点和死胡同
 * 
 * 这是视觉小说游戏脚本质量保证的核心工具
 */
import { z } from "zod";
import { t } from "../utils/i18n.js";

// 输入 Schema
export const ValidateStructureInputSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().describe("节点唯一标识"),
    type: z.string().optional().describe("节点类型：scene | branch | ending"),
    isStart: z.boolean().optional().describe("是否为起始节点"),
    isEnding: z.boolean().optional().describe("是否为结局节点"),
    nextNodeId: z.string().optional().describe("下一个节点ID（线性连接）"),
    choices: z.array(z.object({
      targetNodeId: z.string().describe("分支目标节点ID"),
    })).optional().describe("分支选项列表"),
  })).describe("故事节点列表"),
  locale: z.enum(["zh-CN", "en-US"]).optional().default("zh-CN").describe("语言环境 (zh-CN/en-US)"),
});

// 输出 Schema
export const ValidateStructureOutputSchema = z.object({
  valid: z.boolean().describe("结构是否有效"),
  orphans: z.array(z.string()).describe("孤立节点（从起点无法到达）"),
  deadEnds: z.array(z.string()).describe("死胡同节点（非结局但没有出路）"),
  invalidLinks: z.array(z.string()).describe("无效链接（指向不存在的节点）"),
  reachableCount: z.number().describe("可达节点数量"),
  totalCount: z.number().describe("总节点数量"),
  error: z.string().optional().describe("错误信息"),
});

export type ValidateStructureInput = z.infer<typeof ValidateStructureInputSchema>;
export type ValidateStructureOutput = z.infer<typeof ValidateStructureOutputSchema>;

/**
 * 执行结构校验
 */
export function validateStructure(input: ValidateStructureInput): ValidateStructureOutput {
  const { nodes } = input;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const orphans: string[] = [];
  const deadEnds: string[] = [];
  const invalidLinks: string[] = [];
  const locale = input.locale || "zh-CN";

  // 找到开始节点
  const startNode = nodes.find((n) => n.isStart);
  if (!startNode) {
    return {
      valid: false,
      error: t("structure.error.noStart", locale),
      orphans: [],
      deadEnds: [],
      invalidLinks: [],
      reachableCount: 0,
      totalCount: nodes.length,
    };
  }

  // BFS 检查可达性
  const reachable = new Set<string>();
  const queue = [startNode.id];
  reachable.add(startNode.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = nodes.find((n) => n.id === currentId);
    if (!current) continue;

    // 检查 nextNodeId
    if (current.nextNodeId) {
      if (!nodeIds.has(current.nextNodeId)) {
        invalidLinks.push(`${currentId} → ${current.nextNodeId} (${t("structure.error.invalidLink", locale)})`);
      } else if (!reachable.has(current.nextNodeId)) {
        reachable.add(current.nextNodeId);
        queue.push(current.nextNodeId);
      }
    }

    // 检查 choices
    current.choices?.forEach((choice) => {
      if (!nodeIds.has(choice.targetNodeId)) {
        invalidLinks.push(`${currentId} → ${choice.targetNodeId} (${t("structure.error.invalidLink", locale)})`);
      } else if (!reachable.has(choice.targetNodeId)) {
        reachable.add(choice.targetNodeId);
        queue.push(choice.targetNodeId);
      }
    });
  }

  // 找出孤立节点（从 START 无法到达）
  nodes.forEach((n) => {
    if (!reachable.has(n.id)) {
      orphans.push(n.id);
    }
  });

  // 找出死胡同（非 ending 但没有出路）
  nodes.forEach((n) => {
    if (!n.isEnding && !n.nextNodeId && (!n.choices || n.choices.length === 0)) {
      deadEnds.push(n.id);
    }
  });

  return {
    valid: orphans.length === 0 && deadEnds.length === 0 && invalidLinks.length === 0,
    orphans,
    deadEnds,
    invalidLinks,
    reachableCount: reachable.size,
    totalCount: nodes.length,
  };
}
