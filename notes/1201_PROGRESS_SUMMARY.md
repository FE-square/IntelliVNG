# IntelliVNG 项目架构分析报告

> 生成日期: 2025-12-01
> 版本: v2.0 (基于实际代码分析)

---

## 一、项目概述

**IntelliVNG** 是一个 AI 驱动的视觉小说/立绘游戏创作工具。用户可以自定义角色、世界观、场景和主题风格，AI（基于 OpenAI/兼容 API）会根据这些设定生成多分支剧情脚本，用户可以在流程图编辑器中调整、预览并导出完整的游戏。

### 核心工作流
```
用户定义设定 → AI 生成剧情脚本 → 流程图编辑器调整 → 游戏预览 → 导出
```

---

## 二、技术栈

| 分类 | 技术选型 |
|------|---------|
| **Monorepo 管理** | pnpm + Turborepo |
| **前端框架** | Next.js 14 (App Router) |
| **状态管理** | Zustand (持久化 + 内存) |
| **流程图编辑** | React Flow |
| **UI 组件** | 自建 @vng/ui (Tailwind CSS) |
| **动画** | Framer Motion |
| **后端服务** | Hono.js + Node.js |
| **AI 集成** | OpenAI SDK (兼容接口) |
| **图片生成** | 通义万相 (Wanx) API |
| **类型系统** | TypeScript 5.x |

---

## 三、项目结构

```
IntelliVNG/
├── apps/
│   ├── web/                      # Next.js 前端应用
│   │   ├── src/
│   │   │   ├── app/              # App Router 页面
│   │   │   │   ├── page.tsx              # 首页 (/)
│   │   │   │   ├── dashboard/            # 项目列表 (/dashboard)
│   │   │   │   ├── editor/               # 脚本编辑器 (/editor)
│   │   │   │   ├── assets/               # 素材仓库 (/assets)
│   │   │   │   ├── setup/                # 设定向导 (/setup)
│   │   │   │   │   ├── characters/       # 角色设定
│   │   │   │   │   ├── world/            # 世界观设定
│   │   │   │   │   ├── scenes/           # 场景设定
│   │   │   │   │   ├── theme/            # 主题风格
│   │   │   │   │   ├── backgrounds/      # 背景设定 (旧)
│   │   │   │   │   └── summary/          # 汇总确认 + AI 生成
│   │   │   │   └── api/                  # API Routes (代理)
│   │   │   │       ├── generate/         # 生成剧情 → intelli-services
│   │   │   │       ├── generate-image/   # AI 生成图片 → 通义万相
│   │   │   │       └── projects/         # 项目管理 → intelli-services
│   │   │   ├── components/               # 业务组件
│   │   │   │   ├── FlowEditor.tsx        # 流程图编辑器 (核心)
│   │   │   │   ├── NodeEditPanel.tsx     # 节点详情编辑面板
│   │   │   │   ├── StoryNodeComponent.tsx# 流程图节点组件
│   │   │   │   └── SceneCardEditor.tsx   # 场景卡片编辑
│   │   │   ├── stores/
│   │   │   │   └── setupStore.ts         # 设定向导状态 (Zustand + persist)
│   │   │   └── lib/
│   │   │       └── projectStorage.ts     # 本地项目存储 (localStorage)
│   │   └── package.json
│   │
│   └── intelli-services/          # Hono.js 后端服务
│       ├── src/
│       │   ├── index.ts           # 服务入口
│       │   ├── routes/
│       │   │   └── game.ts        # 游戏 API 路由
│       │   └── services/
│       │       ├── game-generator.ts  # AI 剧情生成核心
│       │       └── cache.ts           # 文件缓存 + 项目存储
│       └── package.json
│
├── packages/
│   ├── core/                      # 核心类型 + 工具
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── story.ts       # StoryNode (新流程图结构)
│   │   │   │   ├── script.ts      # ScriptNode (旧脚本结构)
│   │   │   │   ├── character.ts   # 角色类型
│   │   │   │   ├── background.ts  # 背景类型
│   │   │   │   ├── world.ts       # 世界观/场景/主题类型
│   │   │   │   └── game.ts        # GameProject 主类型
│   │   │   ├── constants/
│   │   │   │   └── index.ts       # 常量定义
│   │   │   └── utils/
│   │   │       ├── id.ts          # ID 生成 (nanoid)
│   │   │       └── story-converter.ts # 格式转换
│   │   └── package.json
│   │
│   ├── editor/                    # 编辑器组件包 (部分废弃)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ScriptCanvas.tsx   # 旧画布 (已被 FlowEditor 替代)
│   │   │   │   └── nodes/
│   │   │   │       ├── DialogueNode.tsx
│   │   │   │       └── ChoiceNode.tsx
│   │   │   └── store/
│   │   │       └── editorStore.ts     # 旧编辑器状态 (基本废弃)
│   │   └── package.json
│   │
│   ├── player/                    # 游戏播放器
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── GamePlayer.tsx     # 游戏播放器核心
│   │   │   │   └── DialogueBox.tsx    # 对话框组件
│   │   │   └── engine/
│   │   │       └── GameEngine.ts      # 游戏引擎
│   │   └── package.json
│   │
│   └── ui/                        # UI 组件库
│       ├── src/
│       │   ├── components/
│       │   │   ├── Button.tsx
│       │   │   ├── Card.tsx
│       │   │   └── Input.tsx
│       │   ├── lib/utils.ts
│       │   └── styles/globals.css
│       └── package.json
│
├── turbo.json                     # Turborepo 配置
├── pnpm-workspace.yaml            # pnpm 工作空间
└── package.json                   # 根 package.json
```

---

## 四、功能模块详解

### 4.1 设定向导模块 (`/setup/*`)

用户创作流程的入口，包含 6 个子页面：

| 页面 | 路径 | 功能 |
|-----|------|------|
| 导航首页 | `/setup` | 展示所有设定入口卡片 |
| 角色设定 | `/setup/characters` | 创建/编辑角色（基础信息、外观、性格、技能）+ AI 生成立绘/头像 |
| 世界观设定 | `/setup/world` | 定义时代、地域、规则、社会结构、历史 |
| 场景设定 | `/setup/scenes` | 定义场景类型、氛围、细节、功能 + AI 生成背景图 |
| 主题风格 | `/setup/theme` | 选择核心主题（亲情、友情等）+ 剧情风格（悬疑、言情等） |
| 背景设定 (旧) | `/setup/backgrounds` | 旧版背景设定（已部分整合到 scenes） |
| 汇总确认 | `/setup/summary` | 展示所有设定 + 调用 AI 生成剧情 |

**状态管理**：`useSetupStore` (Zustand + localStorage 持久化)

### 4.2 AI 生成模块

#### 4.2.1 剧情生成 (`GameGenerator`)

**位置**：`apps/intelli-services/src/services/game-generator.ts`

**流程**：
1. 接收角色/世界观/场景/主题设定
2. 构建详细的 System Prompt（定义输出 JSON 结构）
3. 调用 OpenAI 兼容 API 生成 storyNodes
4. 解析 AI 返回的 JSON，修复常见格式问题
5. 验证节点连接完整性（孤立节点、死胡同检测）
6. 转换为 GameProject 格式并保存

**输出结构**：
- 10-15 个故事节点
- 1 个开始节点 + 3-5 个分支节点 + 2-3 个结局节点
- 每个节点包含：标题、场景名、旁白、3-6 段对话、分支选项

#### 4.2.2 图片生成 (`/api/generate-image`)

**位置**：`apps/web/src/app/api/generate-image/route.ts`

**支持类型**：
- `sprite`：角色立绘（768×1152，竖屏 2:3）
- `avatar`：角色头像（1024×1024，方形）
- `background`：场景背景（1280×720，横屏 16:9）

**调用流程**：异步模式 → 轮询等待结果（最长 30 秒）

### 4.3 编辑器模块 (`/editor`)

**核心组件**：`FlowEditor.tsx`

**功能**：
- 基于 React Flow 的可视化流程图编辑
- 支持拖拽节点、调整连线
- 节点类型区分：普通场景（蓝色）、分支（琥珀色）、结局（红色）、开始（绿框）
- 右侧面板编辑：情节标题、场景选择、旁白、对话管理、视觉素材、音频配乐
- 逻辑检查：检测孤立节点、缺少开头/结尾、视觉素材缺失
- 预览模式切换：从头预览 / 从当前节点预览
- 自动保存（30 秒间隔）+ 手动保存（带备注）

### 4.4 播放器模块 (`@vng/player`)

**核心组件**：`GamePlayer.tsx` + `GameEngine.ts`

**功能**：
- 背景图层切换（带淡入动画）
- 角色立绘显示（左侧，带入场动画）
- 旁白层（顶部居中）/ 对话层（右下角）
- 分支选择 UI（全屏遮罩 + 卡片选项）
- 背景音乐播放（节点切换时自动更换 BGM）
- 故事结束画面

### 4.5 数据存储

#### 前端存储 (`projectStorage.ts`)
- 使用 localStorage
- 项目列表元数据 + 完整项目数据分离存储
- 支持自动保存/手动保存标记

#### 后端存储 (`cache.ts`)
- 使用文件系统 (`.cache/projects/`)
- 基于 idea 的缓存（MD5 hash）
- 基于 projectId 的项目存储

---

## 五、界面关联图

```
┌─────────────┐
│   首页 /    │
│ (IntelliVNG │
│   Studio)   │
└─────┬───────┘
      │
      ├──────────────────────┐
      ▼                      ▼
┌─────────────┐       ┌─────────────┐
│  /setup     │       │ /dashboard  │
│ 开始创作    │       │ 我的项目    │
└─────┬───────┘       └──────┬──────┘
      │                      │
      ▼                      │
┌─────────────────────────┐  │
│  /setup/characters      │  │
│  /setup/world           │  │
│  /setup/scenes          │  │
│  /setup/theme           │  │
└─────────┬───────────────┘  │
          │                  │
          ▼                  │
┌─────────────────────────┐  │
│  /setup/summary         │  │
│  AI 生成剧情脚本        │  │
└─────────┬───────────────┘  │
          │                  │
          │  生成完成        │  加载项目
          ▼                  ▼
┌─────────────────────────────────────┐
│          /editor?projectId=xxx      │
│  ┌─────────────────┬──────────────┐ │
│  │  Flow Editor    │  Edit Panel  │ │
│  │  (React Flow)   │  (右侧面板)   │ │
│  └─────────────────┴──────────────┘ │
│           │                         │
│           ▼ 预览模式                 │
│  ┌─────────────────────────────────┐│
│  │       GamePlayer (@vng/player)  ││
│  │  背景 + 立绘 + 对话框 + 分支选择 ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

---

## 六、核心数据结构（DSL 设计）

本节详细说明项目的核心数据建模，这是整个系统的 DSL（领域特定语言）基础。

### 6.1 设计理念

IntelliVNG 采用**场景导向**的数据结构，而非传统视觉小说的**脚本线性**结构：

| 传统模式 (ScriptNode) | IntelliVNG 模式 (StoryNode) |
|----------------------|---------------------------|
| 每行是单个动作（对话/旁白/换背景） | 每个节点是一个完整情节 |
| 线性顺序执行 | 图结构，支持分支与合流 |
| 类似剧本 | 类似故事板 |
| 适合单线剧情 | 适合多分支叙事 |

### 6.2 核心类型定义

#### 📦 `StoryNode` - 故事节点（情节）

```typescript
interface StoryNode {
    // === 标识信息 ===
    id: string;                      // 唯一标识 (nanoid)
    type: 'scene' | 'branch' | 'ending';
    isStart?: boolean;               // 开始节点（绿框）
    isEnding?: boolean;              // 结局节点（红框）
    
    // === 流程图定位 ===
    position: { x: number; y: number };  // React Flow 坐标
    
    // === 情节基础信息 ===
    title: string;                   // 情节标题："初次相遇"
    sceneName?: string;              // 关联场景名："学校花园"
    backgroundId?: string;           // 关联背景素材 ID
    
    // === 视觉素材 ===
    visualAssets?: {
        backgroundImageUrl?: string;  // 背景图 URL
        characters?: Array<{          // 出场角色配置
            characterId: string;
            spriteUrl?: string;       // 立绘 URL
            position?: { x: number; y: number };
            scale?: number;
        }>;
    };
    
    // === 音频素材 ===
    audioAssets?: {
        bgmUrl?: string;              // BGM URL
        bgmVolume?: number;           // 音量 0-1
        bgmLoop?: boolean;            // 是否循环
        soundEffects?: Array<{        // 音效
            id: string;
            url: string;
            triggerAt?: 'enter' | 'exit';
            volume?: number;
        }>;
    };
    
    // === 故事内容 ===
    narration?: string;              // 旁白/背景交代
    dialogues: Dialogue[];           // 角色对话列表（核心）
    
    // === 分支逻辑 ===
    choices?: Choice[];              // 分支选项（branch 类型专属）
    nextNodeId?: string;             // 下一节点 ID（scene 类型专属）
    
    // === 元数据 ===
    notes?: string;                  // 编辑备注
    tags?: string[];                 // 分类标签
}
```

#### 💬 `Dialogue` - 对话条目

```typescript
interface Dialogue {
    id: string;
    characterId: string;             // 说话角色 ID
    text: string;                    // 对话文本
    emotion?: EmotionType;           // 表情状态
}

type EmotionType = 'neutral' | 'happy' | 'sad' | 'angry' 
                 | 'surprised' | 'embarrassed' | 'thinking';
```

#### 🔀 `Choice` - 分支选项

```typescript
interface Choice {
    id: string;
    text: string;                    // 选项按钮文本
    targetNodeId: string;            // 跳转目标节点
    condition?: string;              // 触发条件（可选）
}
```

#### 👤 `Character` - 角色定义

```typescript
interface Character {
    id: string;
    name: string;                    // 系统名
    displayName: string;             // 显示名
    description: string;             // AI 生成描述
    
    // 基础属性
    gender?: '男' | '女' | '其他';
    age?: number | string;
    identity?: string;               // 身份标签
    
    // 外观描述（AI 生成立绘依据）
    appearance?: {
        hairStyle?: string;
        clothing?: string;
        facialFeatures?: string;
        bodyType?: string;
        height?: string;
        otherFeatures?: string;
    };
    
    // 性格设定（AI 生成对话依据）
    personality?: {
        traits?: string[];           // ['开朗', '勇敢', '好奇']
        temperament?: string;
        values?: string;
    };
    
    // 核心特质
    coreTraits?: {
        specialSkills?: string[];
        obsession?: string;          // 执念/目标
        relationships?: Array<{ targetCharacterId?: string; relation: string }>;
        backstory?: string;
    };
    
    // 立绘资源
    sprites: CharacterSprite[];
    defaultSpriteId: string;
    avatarUrl?: string;              // 头像
}
```

#### 🌍 `WorldSetting` - 世界观设定

```typescript
interface WorldSetting {
    id: string;
    name: string;                    // 世界观名称
    era: string;                     // 时代：古风/赛博朋克/现代/未来
    location: string;                // 地域：架空城邦/校园/荒野
    rules?: string;                  // 核心规则：魔法体系/科技限制
    socialStructure?: string;        // 社会结构
    history?: string;                // 历史背景
    description?: string;
}
```

#### 🎭 `Scene` - 场景定义

```typescript
interface Scene {
    id: string;
    name: string;                    // 场景名称
    type: string;                    // 类型：卧室/会议室/战场
    atmosphere: string;              // 氛围：压抑/轻松/紧张
    details?: string;                // 关键细节
    function?: string;               // 叙事功能：触发线索/情感升温
    imageUrl?: string;               // 背景图
    description?: string;
}
```

#### 🎨 `ThemeSetting` - 主题风格

```typescript
interface ThemeSetting {
    id: string;
    themes: string[];                // 主题：['亲情羁绊', '善恶抉择']
    styles: string[];                // 风格：['悬疑推理', '浪漫言情']
    tone?: string;                   // 整体基调
    description?: string;
}
```

#### 🎮 `GameProject` - 项目主结构

```typescript
interface GameProject {
    id: string;
    title: string;
    description: string;
    coverImage?: string;
    createdAt: string;               // ISO 时间戳
    updatedAt: string;
    
    meta: {
        author: string;
        version: string;
        genre: GameGenre;            // 'romance' | 'mystery' | 'fantasy' ...
        artStyle: ArtStyle;          // 'anime' | 'realistic' | 'pixel' ...
    };
    
    // 核心内容
    characters: Character[];
    backgrounds: Background[];
    script: StoryNode[];             // ⚠️ 注意：实际存储 StoryNode[]
    
    settings: GameSettings;
}
```

### 6.3 数据流转图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         用户输入层                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ 角色设定     │ │ 世界观设定   │ │ 场景设定     │ │ 主题风格     │   │
│  │ Character[] │ │ WorldSetting│ │ Scene[]     │ │ThemeSetting │   │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘   │
└─────────┼───────────────┼───────────────┼───────────────┼──────────┘
          │               │               │               │
          └───────────────┴───────────────┴───────────────┘
                                  │
                                  ▼ Zustand (setupStore)
          ┌───────────────────────────────────────────────┐
          │              前端表单状态缓存                    │
          │  localStorage: 'vng-setup-storage'            │
          └───────────────────────┬───────────────────────┘
                                  │
                                  ▼ POST /api/generate
          ┌───────────────────────────────────────────────┐
          │           intelli-services 后端               │
          │  ┌─────────────────────────────────────────┐ │
          │  │ GameGenerator                           │ │
          │  │ 1. 构建 System Prompt                   │ │
          │  │ 2. 调用 OpenAI API                      │ │
          │  │ 3. 解析 JSON → StoryNode[]             │ │
          │  │ 4. 验证节点连接完整性                    │ │
          │  │ 5. 构建 GameProject                     │ │
          │  └─────────────────────────────────────────┘ │
          └───────────────────────┬───────────────────────┘
                                  │
                                  ▼ 返回 GameProject
          ┌───────────────────────────────────────────────┐
          │              后端项目存储                       │
          │  文件系统: .cache/projects/{id}.json          │
          └───────────────────────┬───────────────────────┘
                                  │
                                  ▼ 加载到编辑器
          ┌───────────────────────────────────────────────┐
          │              FlowEditor 编辑器                 │
          │  ┌─────────────────┐ ┌─────────────────────┐ │
          │  │ StoryNode[] →   │ │ Node[] + Edge[]     │ │
          │  │ React Flow 节点  │ │ (流程图渲染)         │ │
          │  └─────────────────┘ └─────────────────────┘ │
          │           │                                   │
          │           ▼ 用户编辑                          │
          │  ┌─────────────────────────────────────────┐ │
          │  │ NodeEditPanel                           │ │
          │  │ - 对话管理 (增删改 Dialogue)             │ │
          │  │ - 选项管理 (增删改 Choice)               │ │
          │  │ - 素材配置 (背景/立绘/BGM)              │ │
          │  └─────────────────────────────────────────┘ │
          └───────────────────────┬───────────────────────┘
                                  │
                                  ▼ 保存/预览
          ┌───────────────────────────────────────────────┐
          │              GamePlayer 播放器                 │
          │  ┌─────────────────────────────────────────┐ │
          │  │ GameEngine                              │ │
          │  │ 1. 加载 currentNodeId                   │ │
          │  │ 2. 渲染 背景 → 立绘 → 对话框            │ │
          │  │ 3. 处理 dialogIndex 递增                │ │
          │  │ 4. 检测 choices → 分支选择 UI          │ │
          │  │ 5. 跳转到 nextNodeId / targetNodeId    │ │
          │  └─────────────────────────────────────────┘ │
          └───────────────────────────────────────────────┘
```

### 6.4 关键转换说明

#### React Flow 节点转换

```typescript
// StoryNode → React Flow Node
const flowNode: Node = {
    id: storyNode.id,
    type: 'storyNode',           // 自定义节点类型
    position: storyNode.position,
    data: storyNode,             // 完整数据存入 data
};

// 连接线 Edge 生成
// 1. scene 类型：nextNodeId → 单条边
// 2. branch 类型：choices[].targetNodeId → 多条边（带 label）
```

#### 节点类型判断规则

| type | isStart | isEnding | 视觉表现 |
|------|---------|----------|---------|
| scene | true | - | 绿色边框 |
| scene | - | - | 蓝色背景 |
| branch | - | - | 琥珀色背景 |
| ending | - | true | 红色边框 |

### 6.5 为何采用此设计

1. **适合 AI 生成**：StoryNode 结构与自然语言描述更贴近，AI 更容易理解"一个情节包含多段对话和分支选择"
2. **适合可视化编辑**：一个节点 = 一张卡片 = 一个编辑单元，用户心智负担低
3. **支持复杂分支**：图结构天然支持多分支、合流、循环等叙事模式
4. **解耦内容与呈现**：StoryNode 只定义"讲什么"，播放器决定"怎么呈现"

---

## 七、数据流（简化版）

```
┌─────────────┐    Zustand (persist)    ┌─────────────┐
│ Setup Pages │ ───────────────────────▶│ setupStore  │
│ (角色/世界观│                          │ (内存+LS)   │
│  /场景/主题)│                          └──────┬──────┘
└─────────────┘                                 │
                                                ▼
┌─────────────┐  POST /api/generate    ┌─────────────────┐
│ /setup/     │ ──────────────────────▶│ intelli-services│
│  summary    │                         │ GameGenerator   │
└─────────────┘                         └────────┬────────┘
       │                                         │
       │                                         │ 调用 OpenAI
       │                                         ▼
       │                                   AI 生成 JSON
       │                                         │
       │                                         ▼
       │                               ┌─────────────────┐
       │                               │ 返回 GameProject │
       │                               └────────┬────────┘
       │                                        │
       │                                        │  保存到后端
       │                                        │  (cache.ts)
       ▼                                        ▼
┌─────────────────────────────────────────────────────┐
│                      /editor                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ FlowEditor                                   │   │
│  │  - nodes/edges (React Flow state)            │   │
│  │  - selectedNode                              │   │
│  └─────────────────────────────────────────────┘   │
│                   │                                 │
│                   ▼ onUpdate                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ project state (useState)                     │   │
│  │  - 自动保存到后端 API                         │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 七、存在的问题与改进建议

### 7.1 架构层面问题

#### ❌ 问题 1: `@vng/editor` 包几乎废弃但仍保留

**现状**：
- `ScriptCanvas.tsx`、`DialogueNode.tsx`、`ChoiceNode.tsx`、`editorStore.ts` 基本不再使用
- 实际编辑器逻辑已迁移到 `apps/web/src/components/FlowEditor.tsx`

**建议**：
1. 清理 `@vng/editor` 包，删除无用代码
2. 或将 FlowEditor 迁移回 `@vng/editor`，保持包职责清晰

#### ❌ 问题 2: 两套节点类型并存（StoryNode vs ScriptNode）

**现状**：
- `@vng/core/types/story.ts` 定义了 `StoryNode`（新格式，流程图友好）
- `@vng/core/types/script.ts` 定义了 `ScriptNode`（旧格式，脚本线性）
- AI 输出的是 storyNodes 格式，但 GameProject.script 类型声明为 ScriptNode[]
- 转换逻辑分散在多处，容易出错

**建议**：
1. 统一使用 `StoryNode` 作为核心数据结构
2. 修改 `GameProject.script` 类型为 `StoryNode[]`
3. 删除不必要的转换函数 `convertScriptToStoryNodes`

#### ❌ 问题 3: 前后端存储不同步

**现状**：
- 前端用 `localStorage` 存储项目（`projectStorage.ts`）
- 后端用文件系统存储项目（`cache.ts`）
- 两者独立，可能导致数据不一致
- `setupStore` 也有持久化，与 projectStorage 职责重叠

**建议**：
1. 统一数据源：前端读取优先使用后端 API
2. localStorage 仅作为离线缓存 / 草稿
3. 或完全切换到 IndexedDB + 后端 API 的模式

### 7.2 代码质量问题

#### ❌ 问题 4: 大量 `console.log` 调试语句

**现状**：
- `GamePlayer.tsx`、`FlowEditor.tsx`、`NodeEditPanel.tsx` 等文件有大量调试日志
- 生产环境应移除或使用可控的日志系统

**建议**：
```typescript
// 使用环境变量控制
const isDev = process.env.NODE_ENV === 'development';
const logger = {
  log: (...args: any[]) => isDev && console.log(...args),
  warn: (...args: any[]) => isDev && console.warn(...args),
};
```

#### ❌ 问题 5: 类型定义不一致

**现状**：
- `game-generator.ts` 内联定义了 `GameProject`、`Character` 等类型，与 `@vng/core` 重复
- 注释说明是为了避免 ESM 模块解析问题

**建议**：
1. 修复 intelli-services 的 ESM 模块配置
2. 直接从 `@vng/core` 导入类型
3. 或使用 `type` 关键字仅导入类型（无运行时依赖）

#### ❌ 问题 6: `any` 类型滥用

**文件示例**：
- `NodeEditPanel.tsx`: `(node: any)`
- `FlowEditor.tsx`: `const firstNode = project.script?.[0] as any;`
- `game.ts` (routes): `z.array(z.any())`

**建议**：
1. 为 API 请求/响应定义精确的 Zod schema
2. 使用 `unknown` + 类型守卫代替 `any`

### 7.3 功能完整性问题

#### ❌ 问题 7: 导出功能未实现

**现状**：
- 编辑器有「📦 导出」按钮，但点击无反应
- 缺少游戏打包/导出逻辑

**建议**：
1. 实现导出为 JSON 格式（可导入恢复）
2. 实现导出为独立 HTML 游戏（嵌入 player + 数据）
3. 实现导出为 Ren'Py 脚本格式（扩展用途）

#### ❌ 问题 8: 背景设定页与场景设定功能重叠

**现状**：
- `/setup/backgrounds` 和 `/setup/scenes` 功能类似
- 导航流程中 `characters → backgrounds → summary`，但 setup 首页引导的是 `scenes`

**建议**：
1. 整合为单一「场景设定」页面
2. 删除或隐藏 `/setup/backgrounds`
3. 更新导航逻辑一致性

#### ❌ 问题 9: 素材仓库 (`/assets`) 功能有限

**现状**：
- 仅展示已生成的素材
- 无法上传自定义素材
- 无法批量管理/删除

**建议**：
1. 添加本地文件上传功能
2. 添加从 URL 导入功能
3. 添加素材删除/替换操作
4. 考虑集成云存储（OSS/S3）

### 7.4 用户体验问题

#### ❌ 问题 10: 编辑器状态丢失风险

**现状**：
- 自动保存间隔 30 秒，期间编辑可能丢失
- 无「撤销/重做」功能
- 无版本历史

**建议**：
1. 实现操作历史栈（Undo/Redo）
2. 缩短自动保存间隔（10 秒）或改为变更即保存
3. 添加版本历史功能（可回滚）

#### ❌ 问题 11: AI 生成失败处理不友好

**现状**：
- AI 生成超时或节点验证失败时，仅 `throw Error`
- 用户需要重新点击生成，无重试机制

**建议**：
1. 添加「重新生成」按钮
2. 显示详细错误原因
3. 支持部分重生成（仅特定分支）

### 7.5 安全与配置问题

#### ❌ 问题 12: API Key 配置在前端可见

**现状**：
- `/api/generate-image` 使用 `process.env.TONGYI_API_KEY`
- 后端服务使用 `process.env.OPENAI_API_KEY`
- 未见 `.env.example` 文件

**建议**：
1. 创建 `.env.example` 文件，说明所需环境变量
2. 确保前端不会暴露敏感 key（当前 Next.js API Route 是安全的）
3. 添加 API 调用频率限制

#### ❌ 问题 13: CORS 配置过于宽松

**现状**：
```typescript
cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
```
仅允许本地开发，生产部署需要更新。

**建议**：
1. 使用环境变量配置允许的 origin
2. 生产环境使用具体域名

---

## 八、优化优先级建议

### 高优先级（影响核心功能）
1. ⚠️ 统一节点类型定义（StoryNode vs ScriptNode）
2. ⚠️ 实现导出功能
3. ⚠️ 添加 `.env.example` 配置示例

### 中优先级（提升用户体验）
4. 🔧 清理废弃的 `@vng/editor` 代码
5. 🔧 实现撤销/重做功能
6. 🔧 移除调试日志或使用可控日志
7. 🔧 整合 backgrounds/scenes 设定页

### 低优先级（代码规范化）
8. 📝 消除 `any` 类型
9. 📝 统一前后端存储机制
10. 📝 添加单元测试

---

## 九、总结

IntelliVNG 项目整体架构清晰，采用了现代化的 Monorepo + Next.js + React Flow 技术栈，核心 AI 生成 + 流程图编辑 + 游戏预览功能已基本完成。

**主要优势**：
- 用户友好的设定向导流程
- AI 自动生成多分支剧情
- 可视化流程图编辑
- 实时游戏预览

**需要改进**：
- 数据结构统一性
- 代码清理与规范化
- 导出功能实现
- 用户体验细节（撤销、版本管理）

建议按优先级逐步改进，先确保核心功能稳定，再优化代码质量和用户体验。

