# @intellivng/mcp-server

> IntelliVNG 视觉小说故事分析 MCP 服务

这是一个基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 的服务，提供视觉小说游戏脚本的分析工具。可被任何支持 MCP 的 AI 助手调用，用于验证和分析非线性叙事结构。

## 特性

- **结构校验** - 检测孤立节点、死胡同、无效链接
- **路径分析** - 枚举所有故事路径，评估非线性程度
- **对话质量** - 分析对话分布、角色统计、情绪丰富度
- **分支分布** - 检测"伪非线性"问题，确保早期分支

## 工具列表

### 1. `validate_story_structure`

校验故事节点的结构完整性。

**功能：**
- 检查节点连通性（BFS 遍历）
- 找出孤立节点（从起点无法到达）
- 找出死胡同（非结局但没有后续）
- 检测无效链接（指向不存在的节点）

**输出示例：**
```json
{
  "valid": true,
  "orphans": [],
  "deadEnds": [],
  "invalidLinks": [],
  "reachableCount": 12,
  "totalCount": 12
}
```

### 2. `analyze_story_paths`

分析故事的所有可能路径。

**功能：**
- 枚举所有从起点到结局的路径
- 计算路径多样性评分
- 统计分支点和结局数量
- 评估非线性程度

**输出示例：**
```json
{
  "totalPaths": 5,
  "diversityScore": 0.75,
  "avgPathLength": 8.2,
  "lengthVariance": 4.5,
  "endingCount": 3,
  "branchPointCount": 4,
  "nonLinearityScore": 72
}
```

### 3. `analyze_dialogue_quality`

分析对话的质量和分布。

**功能：**
- 统计每节点平均对话数
- 找出对话过少（<2）或过多（>8）的节点
- 角色对话统计
- 情绪分布分析
- 综合质量评分

### 4. `analyze_branch_distribution`

分析分支的分布情况，检测"伪非线性"。

**功能：**
- 检测伪非线性结构（分支集中在末尾）
- 统计各叙事阶段的分支数
- 分类统计分支类型（路线/关系/信息/结局）
- 计算早期分支占比
- 提供改进建议

**输出示例：**
```json
{
  "isPseudoNonLinear": false,
  "distributionScore": 85,
  "branchByPhase": {
    "setup": 1,
    "rising": 2,
    "conflict": 1,
    "climax": 1,
    "resolution": 0
  },
  "branchTypeStats": {
    "route": 3,
    "relationship": 1,
    "information": 1,
    "ending": 0
  },
  "earlyBranchRatio": 0.6,
  "suggestions": ["分支分布良好！故事具有较好的非线性叙事结构。"]
}
```

## 📦 安装

```bash
# 在 monorepo 中
pnpm install

# 或单独安装
cd packages/mcp-server
pnpm install
```

## 使用方式

### 方式一：作为 MCP Server 运行

```bash
# 开发模式
pnpm dev

# 或构建后运行
pnpm build
pnpm start
```

### 方式二：在 Claude Desktop / Cursor 等宿主客户端中中配置

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "intellivng": {
      "command": "node",
      "args": ["/path/to/intellivng/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### 方式三：在 Cursor 中使用

在 `.cursor/mcp.json` 中配置：

```json
{
  "mcpServers": {
    "intellivng": {
      "command": "npx",
      "args": ["tsx", "/path/to/intellivng/packages/mcp-server/src/index.ts"]
    }
  }
}
```

## 节点数据格式

工具接受的节点格式示例：

```typescript
interface StoryNode {
  id: string;                          // 节点唯一标识
  type?: "scene" | "branch" | "ending"; // 节点类型
  isStart?: boolean;                   // 是否为起始节点
  isEnding?: boolean;                  // 是否为结局节点
  functionTag?: "setup" | "rising" | "conflict" | "twist" | "climax" | "falling" | "resolution";
  nextNodeId?: string;                 // 下一个节点（线性连接）
  choices?: {                          // 分支选项
    targetNodeId: string;
    branchType?: "route" | "relationship" | "information" | "ending";
  }[];
  dialogues?: {                        // 对话列表
    characterName?: string;
    text: string;
    emotion?: string;
  }[];
  narration?: string;                  // 旁白
}
```

## 🏗️ 架构说明

```
packages/mcp-server/
├── src/
│   ├── index.ts                    # MCP Server 入口
│   └── tools/
│       ├── validate-structure.ts   # 结构校验工具
│       ├── analyze-paths.ts        # 路径分析工具
│       ├── analyze-dialogue.ts     # 对话质量工具
│       ├── analyze-branch-distribution.ts  # 分支分布工具
│       └── index.ts               # 工具导出
├── package.json
├── tsconfig.json
└── README.md
```

## 设计理念

### 为什么需要这些工具？

在 AI 生成的非线性叙事中，常见问题包括：

1. **结构缺陷** - 孤立节点导致部分内容永远无法到达
2. **伪非线性** - 分支只在结局前出现，前期实际是线性的
3. **对话失衡** - 部分节点对话过少，玩家体验割裂

这些工具让 AI Agent 能够**客观分析**生成的故事结构，而不仅仅依赖主观判断。

### MCP 的优势

通过 MCP 协议封装，这些工具可以：

- 被任何 MCP 兼容的 AI 助手调用
- 独立于主系统运行，便于测试和复用
- 作为"外挂工具"增强现有 Agent 的能力
