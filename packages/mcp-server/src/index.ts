#!/usr/bin/env node
/**
 * IntelliVNG MCP Server
 * 
 * 提供视觉小说游戏脚本分析工具的 MCP 服务
 * 
 * 工具列表：
 * - validate_story_structure: 故事结构校验
 * - analyze_story_paths: 路径多样性分析
 * - analyze_dialogue_quality: 对话质量分析
 * - analyze_branch_distribution: 分支分布分析（检测伪非线性）
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import {
  validateStructure,
  ValidateStructureInputSchema,
} from "./tools/validate-structure.js";
import {
  analyzePaths,
  AnalyzePathsInputSchema,
} from "./tools/analyze-paths.js";
import {
  analyzeDialogue,
  AnalyzeDialogueInputSchema,
} from "./tools/analyze-dialogue.js";
import {
  analyzeBranchDistribution,
  AnalyzeBranchDistributionInputSchema,
} from "./tools/analyze-branch-distribution.js";

// 定义 MCP 工具
const TOOLS: Tool[] = [
  {
    name: "validate_story_structure",
    description: `校验视觉小说故事的节点结构。

检查内容：
- 节点连通性：从起点出发是否能到达所有节点
- 孤立节点：无法从起点到达的节点
- 死胡同：非结局但没有后续的节点
- 无效链接：指向不存在节点的链接

输入示例：
{
  "nodes": [
    {"id": "start", "isStart": true, "nextNodeId": "scene1"},
    {"id": "scene1", "choices": [{"targetNodeId": "branch1"}, {"targetNodeId": "branch2"}]},
    {"id": "branch1", "isEnding": true},
    {"id": "branch2", "isEnding": true}
  ]
}`,
    inputSchema: {
      type: "object" as const,
      properties: {
        nodes: {
          type: "array",
          description: "故事节点列表",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "节点唯一标识" },
              type: { type: "string", description: "节点类型" },
              isStart: { type: "boolean", description: "是否为起始节点" },
              isEnding: { type: "boolean", description: "是否为结局节点" },
              nextNodeId: { type: "string", description: "下一个节点ID" },
              choices: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    targetNodeId: { type: "string" },
                  },
                },
              },
            },
            required: ["id"],
          },
        },
      },
      required: ["nodes"],
    },
  },
  {
    name: "analyze_story_paths",
    description: `分析视觉小说故事的所有可能路径。

分析内容：
- 总路径数量
- 路径多样性评分
- 平均路径长度和差异
- 分支点数量和结局数量
- 非线性程度评分

用于评估故事的分支丰富度和非线性叙事质量。`,
    inputSchema: {
      type: "object" as const,
      properties: {
        nodes: {
          type: "array",
          description: "故事节点列表",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              isStart: { type: "boolean" },
              isEnding: { type: "boolean" },
              nextNodeId: { type: "string" },
              choices: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    targetNodeId: { type: "string" },
                  },
                },
              },
            },
            required: ["id"],
          },
        },
      },
      required: ["nodes"],
    },
  },
  {
    name: "analyze_dialogue_quality",
    description: `分析视觉小说故事的对话质量。

分析内容：
- 每节点平均对话数
- 对话过少/过多的节点
- 缺少旁白的节点
- 角色对话统计
- 情绪分布
- 对话质量综合评分

用于识别需要丰富对话内容的节点。`,
    inputSchema: {
      type: "object" as const,
      properties: {
        nodes: {
          type: "array",
          description: "故事节点列表（含对话）",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              dialogues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    characterName: { type: "string" },
                    text: { type: "string" },
                    emotion: { type: "string" },
                  },
                },
              },
              narration: { type: "string" },
            },
            required: ["id"],
          },
        },
      },
      required: ["nodes"],
    },
  },
  {
    name: "analyze_branch_distribution",
    description: `分析故事分支的分布情况，检测"伪非线性"问题。

伪非线性：分支过度集中在故事末尾，前期玩家缺乏选择权。

分析内容：
- 是否为伪非线性结构
- 各叙事阶段(setup/rising/conflict/climax/resolution)的分支数
- 分支类型统计(route/relationship/information/ending)
- 早期分支占比
- 分布评分和改进建议

用于确保故事从早期就开始提供有意义的选择。`,
    inputSchema: {
      type: "object" as const,
      properties: {
        nodes: {
          type: "array",
          description: "故事节点列表",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: ["scene", "branch", "ending"] },
              isStart: { type: "boolean" },
              isEnding: { type: "boolean" },
              functionTag: {
                type: "string",
                enum: ["setup", "rising", "conflict", "twist", "climax", "falling", "resolution"],
              },
              nextNodeId: { type: "string" },
              choices: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    targetNodeId: { type: "string" },
                    branchType: {
                      type: "string",
                      enum: ["route", "relationship", "information", "ending"],
                    },
                  },
                },
              },
            },
            required: ["id"],
          },
        },
      },
      required: ["nodes"],
    },
  },
];

// 创建 Server 实例
const server = new Server(
  {
    name: "intellivng-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 处理列出工具请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// 处理调用工具请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "validate_story_structure": {
        const input = ValidateStructureInputSchema.parse(args);
        const result = validateStructure(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "analyze_story_paths": {
        const input = AnalyzePathsInputSchema.parse(args);
        const result = analyzePaths(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "analyze_dialogue_quality": {
        const input = AnalyzeDialogueInputSchema.parse(args);
        const result = analyzeDialogue(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "analyze_branch_distribution": {
        const input = AnalyzeBranchDistributionInputSchema.parse(args);
        const result = analyzeBranchDistribution(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("IntelliVNG MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
