<div align="center">

![Banner](./notes/banner.png)

![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)


**IntelliVNG Studio · 基于 AI 多智能体的视觉小说游戏创作工坊**

“多 Agent 协作 + 可视化交互编辑 → 从一个模糊想法走到一部可玩的多结局视觉小说游戏”

[作品亮点](#-作品亮点) · [多智能体](#-多智能体系统设计) · [技术栈](#-技术栈) · [模块架构](#-目录结构) ｜
[视频演示](https://www.bilibili.com/video/BV1d822B3Ezh/?vd_source=70b54740952d96cccb23b6cdcb6a65ad) · [流程文档](https://fe-square.feishu.cn/wiki/Ki4hwhwOeieN9ykDk71cvGFznle) · [思路演进](https://fe-square.feishu.cn/wiki/MNvNwtqDUiAhRLkZddzcdxFpnIb)

</div>

---

# ✨ 核心特性

### 🎯 双模式创作流程

提供两种创作模式，满足不同用户需求：

- **自由创作模式**：只需输入一句话创意（如"失忆少女在未来都市的冒险"），AI 自动生成完整的世界观、角色、场景和剧情，适合快速原型或新手体验
- **专业模式**：支持手动填写详细的世界观设定、角色属性、场景描述等表单，每个字段都可使用"AI 自动补全"辅助创作，给予创作者完全的掌控权

### 🤖 多智能体协作创作

不是简单的"大模型 API 包装/串联"，而是**真正的多智能体系统**：

- **Story Planner** (故事规划)：采用 Tree-of-Thoughts 探索多种叙事方向，评估后选择最优
- **Node Writer** (节点写手)：基于 Few-Shot CoT 并行撰写各节点对话与旁白
- **Story Reviewer** (故事审阅)：使用 ReAct 模式 + 工具调用，检测结构错误、客观分析剧本质量

### 📝 可视化剧本编辑

- 支持交互拖拽链接的节点式编辑器
- 直观展示故事分支结构和对话
- 支持实时整体预览、局部预览
- 可对 AI 生成内容进行精细微调

### 🎬 即时预览与导出

- **所见即所得** 的游戏预览
- 支持导出为**单 HTML 文件**，可独立运行
- 支持内嵌图片资源的**完全离线**导出

### 🎨 AI 素材生成

- 深度集成文生图、图生图能力
- 支持多种画风：动漫、写实、像素、水墨等
- 自动生成角色立绘（透明形状）与场景背景

### 🌐 国际化支持

- 界面支持多语言切换 (locale: zh-CN/zh-HK/en-US) 
- 支持服务端渲染
- AI 生成文本内容可根据用户语言，自动实现本地化

## 🧩 端到端体验流程

1. **Idea Input**：用户输入一句故事主题，自动开始设定创作；也支持高级模式，允许填写人物设定、世界观等表单，随时支持“AI 自动补全”。
2. **Agents System Generation**：显示 Tree-of-Thoughts 结构规划、分层写作并行任务、ReAct 审阅数据，伴随立绘/背景/音轨生成的实时预览。
3. **Editor & Player**：
   - 节点式剧本编辑器，可拖拽节点、修改台词、为选项设置条件变量。
   - 实时 GamePlayer，支持即时试玩、回退、分支路径预览。
4. **Export**：可导出单 HTML 微站、或仅导出 JSON+资产供外部引擎导入使用；
5. **MCP Integration**：开放 `mcp-server`，供第三方 Agent（如 Claude/Cursor）直接调用核心分析能力，实现跨平台协作。

```

一句话创意
   ↓
Director / Writer / Reviewer Agents 串-并行协作
   ↓
结构化 JSON 剧本 + AI 立绘/背景/语音
   ↓
可视化分支编辑 & GamePlayer 试玩
   ↓
JSON DSL / 单 HTML / 独立 Web 项目导出
```

### ✨ 作品亮点

IntelliVNG Studio 为 **AI+互动游戏挑战赛·AI游戏创作工具赛道** 打造的作品。
我们秉持“降低门槛、普惠创作”初衷，提供一个 **0→1 自动生成 + 可视化编辑 + 一键导出** 的视觉小说游戏制作平台，并深度融合 AI 领域前沿研究成果，创新落地，**不甘于“大模型API集成/包装”** 式

#### 🎯 技术亮点

- **技术创新性**：Tree-of-Thoughts + ReAct + Few-shot CoT 的多智能体协作系统、AI 自动补全表单、设定生图、故事线可视化交互编辑
- **工具链完成度**：输入 → 实时仪表盘 → 故事线编辑器 → 预览播放器 → DSL/单体游戏导出  
- **AI逻辑跟随**：SSE 可视化工作流 + MCP 工具调用 + Schema 校验 + Neuro-Symbolic 神经符号架构
- **工具链复用**：Mastra 落地多种 Agents 设计范式 + Prompts 集中式管理机制 + Agent Tools

#### 🌍 项目价值与影响力

| 维度 | 核心优势 |
|------|----------|
| **🎓 教育场景** | 教师可快速制作互动课件(历史模拟、语言学习、心理健康教育) |
| **🤝 公益应用** | 低成本生成科普互动故事、文化传承内容 |
| **♿️ 无障碍设计** | 结构化 JSON 天然适配屏幕阅读器,支持 TTS 语音生成; **Cognitive Friendly** 认知友好度检查 |
| **💼 商业模式** | **C 端订阅**:创作者高级功能付费(云端存储、高级模型、素材市场)<br>**B 端合作**:游戏公司剧情原型工具,教育机构互动内容定制<br>**技术输出**:IntelliVNG MCP Server (SaaS) 及 IntelliVNG-CLI 工具链,以云服务形式收费 |
| **🌍 国际化** | 界面支持 zh-CN/zh-HK/en-US 多语言切换; **MCP 工具** 也内置多语言支持 |
| **🌿 开源贡献** | 完全开源 (MIT 协议),Mastra Agents 实践可供社区参考 |

#### 🚀 功能特性


- **零门槛创作**：世界观、角色、场景均可自动补全，可选模板化提示。
- **生成过程可视化**：Generation Dashboard 逐阶段展示 ToT 规划、节点并行写作、ReAct 审阅的实时日志与进度。
- **所见即所得编辑器**：Flow 节点式剧本图谱 + 剧情节点编辑面板。
- **资源一键生成**：立绘、背景、BGM 允许在任意阶段生成补充，完善的异常处理与重试机制。
- **导出即运行**：提供单文件 HTML、Web 项目模板，也支持 DSL JSON 导出与导入项目。

---

## 🧠 多智能体系统设计

IntelliVNG Studio 采用 **3 Agent + 1 Orchestrator** 的协同模式，利用 Mastra 的 Agent 工作流与 MCP 工具能力，将学术界的 ToT / ReAct / Few-shot CoT 落地为真实可观测的工程系统。

| Agent | 人类角色 | 核心职责 | 技术模式 |
|-------|---------|---------|---------|
| **Story Planner** | 总编剧 | 设计故事骨架、分支结构 | Tree-of-Thoughts (ToT) |
| **Node Writer** | 场景写手 | 撰写对话、旁白、选项 | Few-Shot Chain-of-Thought |
| **Story Reviewer** | 责任编辑 | 质量审核、问题定位 | ReAct (Reasoning + Acting) + MCP Tools |
| **Orchestrator** | 项目经理 | 流程调度、状态管理 | Plan-and-Execute 状态机 |

### 为什么是多智能体？

| 维度 | 单一 LLM 调用 | 多智能体系统 |
|------|-------------|-------------|
| **可控性** | 无法干预生成过程 | 支持阶段性干预、重试 |
| **可解释性** | 黑盒输出，难以追溯 | 每个决策都有推理链 |
| **上下文压力** | 需同时处理全局与细节 | 各司其职，专注自身任务 |
| **错误恢复** | 出错只能重新开始 | 可只重试特定 Agent |
| **扩展性** | 所有逻辑压缩在一个 Prompt | 模块化，易于添加新能力 |

> 📚 详细的技术设计文档请参考：[多智能体系统设计](https://fe-square.feishu.cn/wiki/OEbVwhnZtiyI8pkhzEQcYPirnxi)

### 1. Tree-of-Thoughts 故事规划

Story Planner 不急于得出结论，而是**探索多种可能性**后再选择：

```
Round 1: 生成 3 个候选叙事方向
         ├── 冲突型: "一个关于误解与和解的故事"
         ├── 成长型: "一个关于自我发现的故事"  
         └── 悬疑型: "一个关于真相追寻的故事"

Round 2: 多维度评估（戏剧性、角色契合度、分支潜力、主题深度）
         → 选择最优方向

Round 3: 展开完整的节点骨架
```

### 2. ReAct 工具驱动审阅

Story Reviewer 通过**调用工具收集证据**，再**基于证据推理**：

```
Thought: "让我先检查故事结构是否完整..."
Action:  validate-structure(nodes)
Observation: { valid: false, deadEnds: ["scene-3"] }

Thought: "发现 scene-3 是死胡同，这是结构性问题。继续检查..."
Action:  analyze-paths(nodes)  
Observation: { totalPaths: 3, diversityScore: 0.72 }

Final Answer: { shouldRegenerate: true, targetNodeIds: ["scene-3"] }
```

### 3. 拓扑并行写作

Node Writer 按**依赖关系分层**，同一层的节点**并行生成**，效率提升 2-3 倍：

```
Layer 0: [start]                    ← 先写
Layer 1: [scene-1]                  
Layer 2: [branch-1]                 
Layer 3: [scene-2a, scene-2b]       ← 可并行！
Layer 4: [ending-a, ending-b]       ← 可并行！
```

### 4. Orchestrator 状态机

```
INIT → PLANNING → PLAN_VALIDATION → WRITING → REVIEWING
           ↑                           │
           └────────── REWRITING ◄─────┤ (critical issue)
                               │
                          FINALIZING → DONE
```

每个阶段都会将阶段信息、提示语、日志及指标通过 Server-Sent Events 推到前端，用户清楚知道系统“正在思考什么”。

#### MCP 工具接口 (Neuro-Symbolic Grounding Layer)

我们不仅在内部使用工具，更将其封装为标准化的 **MCP Server**，充当大模型生成的“锚定层”，强制修正幻觉与逻辑错误：

```typescript
// IntelliVNG MCP Server (packages/mcp-server)
const TOOLS = {
  "validate_story_structure": { /* BFS/DFS 检查孤立节点与死胡同 */ },
  "analyze_story_paths": { /* 枚举全路径，计算非线性熵 */ },
  "check_constraints_compliance": { /* 校验节点数、分支深度、结局数是否达标 */ },
  "score_nonlinearity": { /* 综合评分：路径多样性 + 分支分布 + 认知负载 */ }
};
```

所有工具输入输出都由 Zod Schema 定义，支持 `i18n` 多语言反馈，天然兼容 OpenAI Function Calling、Mastra Structured Output。

### 5. Schema 驱动的数据流

所有 Agent 之间的数据交换通过 **Zod Schema** 定义，确保类型安全、自文档化。

---

## 技术栈

| 层级 | 技术 / 说明 |
|------|-------------|
| 包管理 | pnpm workspace + Turborepo |
| 语言 | TypeScript 5.x (全栈统一)  |
| 前端 | Next.js 14 (App Router) + React 18 + Tailwind CSS |
| 状态 | Zustand + TanStack Query |
| 可视化 | React Flow |
| 后端 | Hono (Edge Ready) Node.js |
| Agent | Mastra (Agents & Workflow) + MCP Server (Neuro-Symbolic Layer) |
| LLM | OpenAI GPT-4.1 / Qwen-Plus / 阿里通义百炼兼容 |
| 媒体生成 | 通义万相 / Fish Audio |
| 数据契约 | Zod Schema + DSL 导出 |

---

## 📁 目录结构 & 模块划分

```
IntelliVNG/
├── apps/                           # 应用层
│   ├── web/                        # 🚩前端 Web 应用 (Next.js SSR)
│   │   └── src/
│   │       ├── app/                # 页面路由
│   │       │   ├── page.tsx        # 首页-创意输入
│   │       │   ├── setup/          # 游戏设定向导
│   │       │   ├── dashboard/      # 生成进度看板
│   │       │   └── editor/         # 可视化剧本编辑器
│   │       ├── components/         # React 组件
│   │       ├── stores/             # Zustand 状态
│   │       └── i18n/               # 国际化多语言能力
│   │
│   └── intelli-services/           # 🚩后端 AI 服务 (Hono + Mastra)
│       └── src/
│           ├── agents/             # 🤖 多智能体定义
│           │   ├── storyPlanner.ts # Story Planner Agent
│           │   ├── nodeWriter.ts   # Node Writer Agent
│           │   ├── storyReviewer.ts# Story Reviewer Agent（Function 工具版）
│           │   └── storyReviewer.mcp.ts # Story Reviewer Agent（MCP 工具版）
│           ├── workflows/           # 🔀 工作流编排
│           ├── prompts/            # Prompt 模板管理
│           ├── routes/             # API 路由
│           └── services/           # 业务逻辑
│               └── intellivng-mcp-client.ts # MCP stdio client（供 Agent 工具调用）
│
├── packages/                       # 功能包层
│   ├── core/                       # 核心类型与常量
│   ├── editor/                     # 剧本编辑器组件
│   ├── player/                     # 游戏播放器引擎
│   └── ui/                         # 共享 UI 组件库
│   └── mcp-server/                         # 🔌 MCP 服务
│
└── notes/                          # 开发笔记与调研报告
```

---

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18
- pnpm ≥ 8
- OpenAI 兼容 API Key（支持阿里通义/百炼、Azure OpenAI 等，推荐使用 GPT 系列以获得最佳 Schema 支持）

### 安装

```bash
git clone https://github.com/your-org/IntelliVNG.git
cd IntelliVNG
pnpm install
```

### 配置

在 `apps/intelli-services/.env` 中写入：

```env
OPENAI_API_KEY=sk-xxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL_NAME=gpt-4.1
TONGYI_API_BASE=sk-xxxx
PORT=4000
```

#### （可选）启用服务端 MCP 工具版 Reviewer

`Story Reviewer` 默认使用**本地工具实现**。如需让服务端 Agent 通过 MCP 调用 `packages/mcp-server` 的工具（结构/路径/分支分布/约束/非线性评分），可在 `apps/intelli-services/.env` 增加：

```env
# 启用 MCP 版 story-reviewer（默认 false）
REVIEWER_USE_MCP=true

# （可选）覆盖 MCP server 启动方式（stdio）
# INTELLIVNG_MCP_COMMAND=node
# INTELLIVNG_MCP_ARGS=/abs/path/to/IntelliVNG/packages/mcp-server/dist/index.js
```

### 本地运行

```bash
# 同时启动
pnpm dev

# 或分进程启动
pnpm dev:serv   # 端口 4000，暴露 /api/generate, /api/export
pnpm dev:web    # 端口 3000，Next.js 前端
```

打开 `http://localhost:3000`，输入例如“失忆少女未来都市冒险故事”，选择创作模式，即可看到多智能体实时协作并生成游戏。

---

## 🧪 开发与调试指南

- **日志追踪**：Agent 服务默认输出 ToT/CoT/ReAct 的 Thought/Action/Observation，可在 `apps/intelli-services/src/logger.ts` 中切换详细级别。
- **Mock 模式**：前端在无 `projectId` 时会加载 `packages/core/mocks/romance.json`，便于 UI 调试。
- **SSE 检测**：在浏览器 Network 面板观察 `/api/progress` 流即可复现实况。
- **二次开发建议**：  
  1. 通过 `packages/agents/prompts/*.md` 自定义提示词或引入新 Agent；  
  2. 在 `packages/core/src/schema/*.ts` 扩展数据结构，自动同步到前端与导出逻辑；  
  3. MCP 工具可以独立部署，供外部 Agent/Assistants 使用。

### 核心数据结构

```typescript
// 游戏项目
interface GameProject {
  id: string;
  title: string;
  meta: { author: string; genre: GameGenre; artStyle: ArtStyle };
  characters: Character[];
  backgrounds: Background[];
  script: ScriptNode[];
}

// 剧本节点
type ScriptNode = DialogueNode | ChoiceNode | NarrationNode;

interface DialogueNode {
  id: string;
  type: 'dialogue';
  characterId: string;
  text: string;
  nextNodeId: string | null;
}

interface ChoiceNode {
  id: string;
  type: 'choice';
  prompt?: string;
  choices: { text: string; targetNodeId: string }[];
}
```

### 添加新的 Agent 工具

```typescript
// apps/intelli-services/src/agents/tools/myTool.ts
import { createTool } from "@mastra/core";
import { z } from "zod";

export const myAnalysisTool = createTool({
  id: "my-analysis",
  description: "执行自定义分析",
  inputSchema: z.object({
    nodes: z.array(z.object({ id: z.string() })),
  }),
  execute: async ({ context }) => {
    // 实现工具逻辑
    return { result: "analysis complete" };
  },
});
```

---

## 📊 当前能力矩阵

| 模块 | 说明 | 状态 |
|------|------|------|
| Monorepo 基础设施 | pnpm + Turborepo + CI lint | ✅ |
| Tree-of-Thoughts Story Planner | 3 轮探索/评估/展开 + 打分可视化 | ✅ |
| Few-shot CoT Node Writer | 拓扑分层并行生成 30+ 节点 | ✅ |
| ReAct Story Reviewer | 结构/路径/对话工具链 + 问题定位 | ✅ |
| Generation Dashboard | 阶段化日志 + 资产生成状态 | ✅ |
| 剧情 Flow 编辑器 | 节点/连线/属性面板/变量系统 | ✅ |
| 资源生成引擎 | 立绘/背景/BGM 批量生成 | ✅ |
| Export Kit | 单 HTML、DSL JSON | ✅ |
| 用户账号 & 云同步 | 多人协作、作品库 | 🟡 规划 |

---

## 🗺️ Roadmap

**Phase 1 · MVP 完成 ✅**
- ✅ 双模式创作流程 (自由创作/专业模式)
- ✅ AI Multi-Agent System (ToT + ReAct + Few-shot CoT)
- ✅ 可视化剧本编辑器 (Flow 节点式编辑)
- ✅ 即时预览与游戏播放器
- ✅ 项目管理 (导入/导出 JSON)
- ✅ 多语言国际化 (zh-CN/zh-HK/en-US)
- ✅ 一键导出游戏 (HTML 文件)

**Phase 2 · 体验与鲁棒性（进行中）**
- [ ] Reviewer 工具扩展：情感弧线 / 敏感词检测
- [ ] 分支变量系统

**Phase 3 · 生态与商业化**
- [ ] 云端作品库 & 多人协作
- [ ] PMF 验证：开放 MCP 工具，接入外部 Agent 网络

---

## 🤝 关于我们

IntelliVNG Team 来自 FE Square，致力于结合 **AI Agent + 互动叙事 + Web 工程化** 的新一代游戏创作工具。项目将持续开源，欢迎 Issues / PR / 竞赛合作。

---

<div align="center">

**Made with ❤️ by FE Square Team**

[GitHub](https://github.com/your-org/IntelliVNG) · [Specification](https://fe-square.feishu.cn/wiki/Ki4hwhwOeieN9ykDk71cvGFznle) · [Documentation](https://fe-square.feishu.cn/wiki/OEbVwhnZtiyI8pkhzEQcYPirnxi)

</div>
