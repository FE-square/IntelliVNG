# 🎮 IntelliVNG Studio

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)

**AI 驱动的视觉小说游戏氛围创作工具**

*输入一句创意，即刻生成个性化且完整的视觉小说游戏*

[快速开始](#-快速开始) · [开发指南](#-新手开发教程) · [架构文档](./ARCHITECTURE.md) · [开发进度](#-开发进度)

</div>

---

## 📖 项目介绍

**IntelliVNG Studio** 是一个 AI 驱动的视觉小说氛围创作 (Vibe Scripting) 工具，旨在让用户只需输入一句创意，即可自动生成完整的视觉小说游戏。

### 🎯 核心价值主张

```
用户输入创意 → AI 生成剧本+素材 → 可视化编辑微调 → 一键导出可玩游戏
```

### ✨ 主要特性

- **🤖 AI Agent 创作**：输入创意即可让多个智能体构思规划完整的故事设定、任务角色和剧本
- **📝 可视化编辑**：基于可视化交互的节点式剧本编辑器，可视化故事线的同时允许个性化调整
- **🎬 实时预览**：所见即所得，即刻预览游戏效果
- **🎨 多种风格**：支持日系动漫、写实、像素、水彩等画风人物、背景 (TODO)
- **📦 Monorepo 架构**：模块化设计，代码可复用

### 🛠️ 技术栈

| 层级 | 技术选型 |
|------|---------|
| **包管理** | pnpm workspace + Turborepo |
| **语言** | TypeScript 5.x |
| **前端框架** | React 18 + Next.js 14 (App Router) |
| **后端服务** | Hono + Node.js |
| **状态管理** | Zustand |
| **流程图编辑** | React Flow |
| **UI 样式** | Tailwind CSS |
| **AI Agent** | Mastra |
| **AI 模型** | OpenAI GPT / Qwen (可配置) |

---

## 📁 目录结构

```
IntelliVNG/
├── apps/                           # 应用层
│   ├── web/                        # 主 Web 应用 (Next.js)
│   │   ├── src/
│   │   │   ├── app/                # Next.js App Router
│   │   │   │   ├── page.tsx        # 首页 - 创意输入
│   │   │   │   ├── dashboard/      # 生成进度页面
│   │   │   │   ├── editor/         # 剧本编辑器页面
│   │   │   │   └── api/            # API Routes
│   │   │   └── ...
│   │   └── package.json
│   │
│   └── intelli-services/           # 后端 API 服务 (Hono + Mastra)
│       ├── src/
│       │   ├── index.ts            # 服务入口
│       │   ├── routes/             # API 路由
│       │   │   └── game.ts         # 游戏生成相关路由
│       │   └── services/           # 业务逻辑
│       │       ├── game-generator.ts   # AI 游戏生成器
│       │       └── cache.ts        # 缓存服务
│       └── package.json
│
├── packages/                       # 功能包层
│   ├── core/                       # 核心数据结构与类型定义
│   │   ├── src/
│   │   │   ├── types/              # TypeScript 类型
│   │   │   │   ├── game.ts         # 游戏项目类型
│   │   │   │   ├── script.ts       # 剧本节点类型
│   │   │   │   ├── character.ts    # 角色类型
│   │   │   │   └── background.ts   # 背景类型
│   │   │   ├── constants/          # 常量定义
│   │   │   └── utils/              # 工具函数
│   │   └── package.json
│   │
│   ├── editor/                     # 剧本编辑器包
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ScriptCanvas.tsx    # React Flow 画布
│   │   │   │   └── nodes/              # 自定义节点组件
│   │   │   │       ├── DialogueNode.tsx
│   │   │   │       └── ChoiceNode.tsx
│   │   │   └── store/
│   │   │       └── editorStore.ts      # Zustand 状态管理
│   │   └── package.json
│   │
│   ├── player/                     # 游戏播放器包
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── GamePlayer.tsx      # 主播放器组件
│   │   │   │   └── DialogueBox.tsx     # 对话框组件
│   │   │   └── engine/
│   │   │       └── GameEngine.ts       # 游戏引擎核心
│   │   └── package.json
│   │
│   └── ui/                         # 共享 UI 组件库
│       ├── src/
│       │   ├── components/
│       │   │   ├── Button.tsx
│       │   │   ├── Card.tsx
│       │   │   └── Input.tsx
│       │   └── styles/
│       │       └── globals.css
│       └── package.json
│
├── package.json                    # 根配置
├── pnpm-workspace.yaml             # pnpm workspace 配置
├── turbo.json                      # Turborepo 配置
├── tsconfig.base.json              # 共享 TypeScript 配置
├── ARCHITECTURE.md                 # 架构设计文档
└── README.md                       # 本文件
```

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **pnpm** >= 8.0.0
- **OpenAI API Key** (或兼容的 API)

### 1. 克隆项目

```bash
git clone https://github.com/your-org/IntelliVNG.git
cd IntelliVNG
```

### 2. 安装依赖

> 本项目使用 pnpm 进行多包管理

```bash
pnpm install
```

### 3. 配置环境变量

在 `apps/intelli-services/` 目录下创建 `.env` 文件，主要用于 LLM 服务：

```env
# OpenAI 配置 (或兼容 API)
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1   # 可选，默认为 OpenAI
OPENAI_MODEL_NAME=gpt-4-turbo               # 可选，默认为 gpt-4-turbo

# 服务端口
PORT=4000
```

> 💡 **提示**：也支持使用阿里云通义千问等兼容 OpenAI 接口的模型

### 4. 启动开发服务器

**方式一：同时启动前端和后端**

```bash
pnpm dev
```

**方式二：分别启动（推荐，便于区分输出）**

```bash
# 终端 1 - 启动后端服务 (端口 4000)
pnpm dev:serv

# 终端 2 - 启动前端应用 (端口 3000)
pnpm dev:web
```

### 5. 开始使用

1. 打开浏览器访问 `http://localhost:3000`
2. 在输入框中输入你的故事创意（例如：「咖啡店邂逅的浪漫故事」）
3. 点击「Generate Magic ✨」开始生成剧本
   - TODO 微调角色与故事背景, 允许用户介入，重新生成
4. 等待 AI 生成完成后，自动进入编辑器查看和编辑剧本
5. 切换到「Preview Game」预览游戏效果

---

## 👩‍💻 开发教程

### 项目架构概览

IntelliVNG 采用 **Monorepo** 架构，使用 pnpm workspace 管理多个包：

```
                    ┌─────────────┐
                    │   apps/web  │  (主应用)
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌────────────┐
    │  editor  │    │  player  │    |  services  │  
    └────┬─────┘    └────┬─────┘    └────────────┘
         │               │               
         └───────────────┼───────────────┘
                         │
                         ▼
                   ┌──────────┐
                   │   core   │  (类型定义)
                   └────┬─────┘
                        │
                        ▼
                   ┌──────────┐
                   │    ui    │  (UI组件)
                   └──────────┘
```

### 核心数据结构

#### GameProject - 游戏项目

```typescript
interface GameProject {
  id: string;
  title: string;
  description: string;
  meta: {
    author: string;
    version: string;
    genre: GameGenre;      // 'romance' | 'mystery' | 'fantasy' ...
    artStyle: ArtStyle;    // 'anime' | 'realistic' | 'pixel' ...
  };
  characters: Character[];  // 角色列表
  backgrounds: Background[]; // 背景列表
  script: ScriptNode[];     // 剧本节点
  settings: GameSettings;
}
```

#### ScriptNode - 剧本节点

```typescript
// 对话节点
interface DialogueNode {
  id: string;
  type: 'dialogue';
  characterId: string;
  text: string;
  nextNodeId: string | null;
  position: { x: number; y: number };
}

// 选择分支节点
interface ChoiceNode {
  id: string;
  type: 'choice';
  prompt?: string;
  choices: Choice[];
  position: { x: number; y: number };
}
```

### 添加新功能示例

#### 示例 1：添加新的节点类型

1. **定义类型** (`packages/core/src/types/script.ts`)

```typescript
export interface NarrationNode extends BaseNode {
  type: 'narration';
  text: string;
  nextNodeId: string | null;
}
```

2. **创建组件** (`packages/editor/src/components/nodes/NarrationNode.tsx`)

```tsx
import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export const NarrationNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div className={`px-4 py-3 rounded-lg bg-gray-100 ${selected ? 'ring-2' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <p className="text-sm italic">{data.text}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});
```

3. **注册节点** (`packages/editor/src/components/ScriptCanvas.tsx`)

```typescript
import { NarrationNode } from './nodes/NarrationNode';

const nodeTypes: NodeTypes = {
  dialogue: DialogueNode,
  choice: ChoiceNode,
  narration: NarrationNode,  // 添加新节点
};
```

#### 示例 2：修改 AI 生成逻辑

AI 生成逻辑位于 `apps/intelli-services/src/services/game-generator.ts`

```typescript
// 修改系统提示词
const DIRECTOR_SYSTEM_PROMPT = `你是一位视觉小说游戏设计师...`;

// 修改生成参数
const response = await this.openai.chat.completions.create({
  model: this.modelName,
  temperature: 0.8,  // 调整创意度
  max_tokens: 10000,
});
```

### 调试技巧

1. **查看后端日志**：后端服务会在控制台输出详细日志
2. **使用 React DevTools**：检查组件状态和 props
3. **检查 Network**：查看 API 请求和响应
4. **使用 Mock 数据**：编辑器页面支持无 projectId 时使用 Mock 数据

---

## 📊 开发进度

基于 [ARCHITECTURE.md](./ARCHITECTURE.md) 的规划，当前开发进度如下：

### ✅ 已完成

| 模块 | 功能 | 状态 |
|------|------|------|
| **基础架构** | Monorepo (pnpm + turborepo) | ✅ 完成 |
| **@vng/core** | 核心类型定义 (GameProject, Character, ScriptNode 等) | ✅ 完成 |
| **@vng/core** | 常量定义 (GENRES, ART_STYLES) | ✅ 完成 |
| **@vng/core** | ID 生成工具 | ✅ 完成 |
| **@vng/ui** | 基础 UI 组件 (Button, Card, Input) | ✅ 完成 |
| **@vng/editor** | React Flow 画布集成 | ✅ 完成 |
| **@vng/editor** | DialogueNode 对话节点 | ✅ 完成 |
| **@vng/editor** | ChoiceNode 选择节点 | ✅ 完成 |
| **@vng/editor** | Zustand 状态管理 | ✅ 完成 |
| **@vng/player** | GameEngine 游戏引擎 | ✅ 完成 |
| **@vng/player** | GamePlayer 播放器组件 | ✅ 完成 |
| **@vng/player** | DialogueBox 对话框 | ✅ 完成 |
| **apps/web** | 首页创意输入 | ✅ 完成 |
| **apps/web** | Dashboard 生成进度页 | ✅ 完成 |
| **apps/web** | Editor 编辑器页面 | ✅ 完成 |
| **apps/web** | API Routes 代理 | ✅ 完成 |
| **intelli-services** | Hono 后端服务框架 | ✅ 完成 |
| **intelli-services** | OpenAI API 集成 | ✅ 完成 |
| **intelli-services** | 项目缓存系统 | ✅ 完成 |

### 🚧 进行中

| 模块 | 功能 | 进度 |
|------|------|------|
| **@vng/player** | 角色立绘渲染 | 🚧 50% |
| **@vng/editor** | 节点编辑面板 | 🚧 30% |

### ❌ 待开发

| 模块 | 功能 | 优先级 |
|------|------|--------|
| **@vng/agent** | Mastra AI Agent 框架集成 | 🔴 高 |
| **@vng/agent** | Director Agent (总导演) | 🔴 高 |
| **@vng/agent** | Writer Agent (编剧) | 🔴 高 |
| **@vng/agent** | Artist Agent (美术) | 🟡 中 |
| **@vng/agent** | MCP Tools 定义 | 🟡 中 |
| **@vng/agent** | createGame Workflow | 🔴 高 |
| **@vng/editor** | SceneChangeNode 场景切换节点 | 🟡 中 |
| **@vng/editor** | NarrationNode 旁白节点 | 🟡 中 |
| **@vng/editor** | ConditionNode 条件节点 | 🟢 低 |
| **@vng/editor** | NodePalette 节点工具面板 | 🟡 中 |
| **@vng/editor** | PropertyPanel 属性编辑面板 | 🟡 中 |
| **@vng/player** | ChoicePanel 选项面板优化 | 🟡 中 |
| **@vng/player** | Background 背景组件 | 🟡 中 |
| **apps/web** | 角色管理页面 | 🟡 中 |
| **apps/web** | 背景管理页面 | 🟡 中 |
| **图像生成** | 角色立绘生成 (Stable Diffusion/通义万相) | 🔴 高 |
| **图像生成** | 场景背景生成 | 🔴 高 |
| **导出功能** | 单 HTML 文件导出 | 🔴 高 |
| **导出功能** | 播放器运行时打包 | 🟡 中 |

---

## 🗺️ Roadmap

### Phase 1: MVP 完善 (当前)

- [ ] 完善编辑器属性面板，支持编辑节点内容
- [ ] 实现更多节点类型 (旁白、场景切换)
- [ ] 优化 AI 生成质量和稳定性
- [ ] 添加项目列表和管理功能

### Phase 2: Multi-Agent 架构

- [ ] 集成 Mastra AI Agent 框架
- [ ] 实现 Director Agent (故事规划)
- [ ] 实现 Writer Agent (剧本编写)
- [ ] 实现 Artist Agent (美术指导)
- [ ] 设计 Agent 协作工作流

### Phase 3: 图像生成

- [ ] 集成图像生成服务 (Stable Diffusion / 通义万相)
- [ ] 实现角色立绘生成
- [ ] 实现场景背景生成
- [ ] 支持多表情/多变体

### Phase 4: 导出与发布

- [ ] 实现单 HTML 文件导出
- [ ] 打包 Player 运行时
- [ ] 图片资源内联 (Base64)
- [ ] 支持分享和发布

### Phase 5: 高级功能

- [ ] 变量系统和条件分支
- [ ] 存档/读档功能
- [ ] 多语言支持
- [ ] 用户账号系统

---

<div align="center">

**Made with ❤️ by IntelliVNG Team: FE Square**

</div>


