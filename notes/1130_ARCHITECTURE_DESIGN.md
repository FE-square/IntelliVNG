# IntelliVNG Studio - 智能视觉小说工作室

## 架构设计文档 v1.0

---

## 一、项目概述

### 1.1 产品定位

**IntelliVNG Studio** 是一个 AI 驱动的视觉小说创作平台，让用户只需输入一句创意，和简单调整，即可自动生成完整的视觉小说游戏。

### 1.2 核心价值主张

```
用户输入创意 → 设定确认和编辑 → AI 生成剧本+素材 → 可视化编辑微调 → 一键导出可玩游戏
```

### 1.3 技术亮点

- **Multi-Agent 协作**：Writer Agent + Artist Agent 分工协作
- **MCP Tools**：模块化的工具调用，代码可复用
- **端到端自动化**：从创意到可玩游戏的完整链路
- **可视化编辑**：节点式剧本编辑器，所见即所得

---

## 二、Monorepo 架构

### 2.1 目录结构

```
vng-studio/
├── package.json                    # 根配置
├── pnpm-workspace.yaml             # pnpm workspace 配置
├── turbo.json                      # Turborepo 配置
├── tsconfig.base.json              # 共享 TS 配置
│
├── apps/                           # 应用层
│   ├── web/                        # 主 Web 应用 (创作向导主界面)
│   │   ├── src/
│   │   │   ├── app/                # Next.js App Router
│   │   │   ├── components/         # 页面级组件
│   │   │   └── lib/                # 工具函数
│   │   └── package.json
│   │
│   └── api/                        # 后端 API 服务 (可选，也可用 Next.js API Routes)
│       └── package.json
│
├── packages/                       # 功能包层
│   ├── core/                       # 核心数据结构与类型定义
│   │   ├── src/
│   │   │   ├── types/              # TypeScript 类型
│   │   │   │   ├── game.ts         # 游戏项目类型
│   │   │   │   ├── script.ts       # 剧本节点类型
│   │   │   │   ├── character.ts    # 角色类型
│   │   │   │   └── index.ts
│   │   │   ├── schema/             # JSON Schema 验证
│   │   │   └── constants/          # 常量定义
│   │   └── package.json
│   │
│   ├── editor/                     # 剧本编辑器包
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ScriptCanvas.tsx       # React Flow 画布
│   │   │   │   ├── nodes/                 # 自定义节点组件
│   │   │   │   │   ├── DialogueNode.tsx   # 对话节点
│   │   │   │   │   ├── ChoiceNode.tsx     # 选择分支节点
│   │   │   │   │   ├── SceneNode.tsx      # 场景切换节点
│   │   │   │   │   └── index.ts
│   │   │   │   ├── panels/
│   │   │   │   │   ├── NodePalette.tsx    # 节点工具面板
│   │   │   │   │   └── PropertyPanel.tsx  # 属性编辑面板
│   │   │   │   └── index.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useScriptEditor.ts     # 编辑器核心 Hook
│   │   │   │   └── useNodeOperations.ts   # 节点操作 Hook
│   │   │   ├── store/
│   │   │   │   └── editorStore.ts         # Zustand 状态
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── player/                     # 游戏播放器包
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── GamePlayer.tsx         # 主播放器组件
│   │   │   │   ├── DialogueBox.tsx        # 对话框组件
│   │   │   │   ├── CharacterSprite.tsx    # 角色立绘组件
│   │   │   │   ├── Background.tsx         # 背景组件
│   │   │   │   ├── ChoicePanel.tsx        # 选项面板
│   │   │   │   └── index.ts
│   │   │   ├── engine/
│   │   │   │   ├── GameEngine.ts          # 游戏引擎核心
│   │   │   │   ├── ScriptRunner.ts        # 剧本执行器
│   │   │   │   └── StateManager.ts        # 游戏状态管理
│   │   │   ├── hooks/
│   │   │   │   └── useGamePlayer.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── agent/                      # AI Agent 包 (Mastra)
│   │   ├── src/
│   │   │   ├── mastra/
│   │   │   │   ├── index.ts               # Mastra 实例
│   │   │   │   ├── agents/
│   │   │   │   │   ├── director.ts        # 总导演 Agent
│   │   │   │   │   ├── writer.ts          # 编剧 Agent
│   │   │   │   │   └── artist.ts          # 美术 Agent
│   │   │   │   ├── tools/
│   │   │   │   │   ├── project.ts         # 项目操作工具
│   │   │   │   │   ├── script.ts          # 剧本操作工具
│   │   │   │   │   ├── character.ts       # 角色操作工具
│   │   │   │   │   └── image.ts           # 图像生成工具
│   │   │   │   └── workflows/
│   │   │   │       └── createGame.ts      # 创建游戏工作流
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── ui/                         # 共享 UI 组件库
│       ├── src/
│       │   ├── components/
│       │   │   ├── Button.tsx
│       │   │   ├── Input.tsx
│       │   │   ├── Modal.tsx
│       │   │   ├── Card.tsx
│       │   │   └── index.ts
│       │   ├── styles/
│       │   │   └── globals.css
│       │   └── index.ts
│       └── package.json
│
└── tooling/                        # 工具配置
    ├── eslint/
    ├── typescript/
    └── tailwind/
```

### 2.2 包依赖关系

```
                    ┌─────────────┐
                    │   apps/web  │  (主应用)
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  editor  │    │  player  │    │  agent   │
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │
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

---

## 三、核心数据结构设计

### 3.1 游戏项目 (GameProject)

```typescript
// packages/core/src/types/game.ts

export interface GameProject {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
  
  // 元数据
  meta: {
    author: string;
    version: string;
    genre: GameGenre;
    artStyle: ArtStyle;
  };
  
  // 游戏内容
  characters: Character[];
  backgrounds: Background[];
  script: ScriptNode[];
  
  // 游戏配置
  settings: GameSettings;
}

export type GameGenre = 
  | 'romance' 
  | 'mystery' 
  | 'fantasy' 
  | 'horror' 
  | 'slice-of-life'
  | 'sci-fi';

export type ArtStyle = 
  | 'anime' 
  | 'realistic' 
  | 'pixel' 
  | 'watercolor'
  | 'comic';

export interface GameSettings {
  textSpeed: number;
  autoPlayDelay: number;
  defaultTransition: TransitionType;
}

export type TransitionType = 'fade' | 'slide' | 'dissolve' | 'none';
```

### 3.2 角色 (Character)

```typescript
// packages/core/src/types/character.ts

export interface Character {
  id: string;
  name: string;
  displayName: string;           // 显示名称（可包含颜色等）
  description: string;           // AI生成用的描述
  
  // 立绘
  sprites: CharacterSprite[];
  defaultSpriteId: string;
  
  // 角色属性（可选，用于高级剧情）
  attributes?: Record<string, number>;
  
  // 对话框样式
  dialogueStyle?: {
    nameColor: string;
    boxStyle?: 'default' | 'thought' | 'shout';
  };
}

export interface CharacterSprite {
  id: string;
  emotion: EmotionType;
  imageUrl: string;
  // 图像生成时使用的 prompt（便于重新生成）
  generationPrompt?: string;
}

export type EmotionType = 
  | 'neutral' 
  | 'happy' 
  | 'sad' 
  | 'angry' 
  | 'surprised'
  | 'embarrassed'
  | 'thinking';
```

### 3.3 背景 (Background)

```typescript
// packages/core/src/types/background.ts

export interface Background {
  id: string;
  name: string;
  description: string;           // AI生成用的描述
  imageUrl: string;
  
  // 场景变体（如：白天/夜晚）
  variants?: BackgroundVariant[];
  
  generationPrompt?: string;
}

export interface BackgroundVariant {
  id: string;
  name: string;                  // e.g., "night", "sunset"
  imageUrl: string;
}
```

### 3.4 剧本节点 (ScriptNode)

```typescript
// packages/core/src/types/script.ts

// 基础节点类型
export type ScriptNode = 
  | DialogueNode 
  | ChoiceNode 
  | SceneChangeNode
  | NarrationNode
  | ConditionNode
  | SetVariableNode;

// 节点基类
interface BaseNode {
  id: string;
  type: string;
  // React Flow 定位用
  position: { x: number; y: number };
}

// 对话节点
export interface DialogueNode extends BaseNode {
  type: 'dialogue';
  characterId: string;
  spriteId?: string;              // 使用哪个表情
  text: string;
  // 对话特效
  effect?: DialogueEffect;
  // 下一个节点
  nextNodeId: string | null;
}

export interface DialogueEffect {
  textAnimation?: 'typewriter' | 'fade' | 'none';
  screenEffect?: 'shake' | 'flash' | 'none';
}

// 旁白节点
export interface NarrationNode extends BaseNode {
  type: 'narration';
  text: string;
  nextNodeId: string | null;
}

// 选择分支节点
export interface ChoiceNode extends BaseNode {
  type: 'choice';
  prompt?: string;                // 选择前的提示文本
  choices: Choice[];
}

export interface Choice {
  id: string;
  text: string;
  nextNodeId: string;
  // 可选：选择条件
  condition?: Condition;
  // 可选：选择后设置变量
  setVariables?: VariableAssignment[];
}

// 场景切换节点
export interface SceneChangeNode extends BaseNode {
  type: 'scene-change';
  backgroundId: string;
  variantId?: string;
  transition: TransitionType;
  // 角色位置重置
  characterPositions?: CharacterPosition[];
  nextNodeId: string | null;
}

export interface CharacterPosition {
  characterId: string;
  spriteId?: string;
  position: 'left' | 'center' | 'right' | 'off';
}

// 条件节点（高级功能）
export interface ConditionNode extends BaseNode {
  type: 'condition';
  condition: Condition;
  trueNodeId: string;
  falseNodeId: string;
}

export interface Condition {
  variable: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  value: string | number | boolean;
}

// 变量设置节点
export interface SetVariableNode extends BaseNode {
  type: 'set-variable';
  assignments: VariableAssignment[];
  nextNodeId: string | null;
}

export interface VariableAssignment {
  variable: string;
  operation: 'set' | 'add' | 'subtract';
  value: string | number | boolean;
}
```

### 3.5 React Flow 边类型

```typescript
// packages/core/src/types/flow.ts

export interface ScriptEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;         // 用于选择节点的多出口
  animated?: boolean;
  label?: string;
}
```

---

## 四、包详细设计

### 4.1 @vng/core - 核心类型包

**职责**：定义所有共享的 TypeScript 类型、常量、工具函数

```typescript
// packages/core/src/index.ts

// 类型导出
export * from './types/game';
export * from './types/character';
export * from './types/background';
export * from './types/script';
export * from './types/flow';

// 常量导出
export * from './constants';

// 工具函数
export * from './utils/id';
export * from './utils/validation';
```

```typescript
// packages/core/src/utils/id.ts
import { nanoid } from 'nanoid';

export const createId = () => nanoid(10);

export const createNodeId = (type: string) => `${type}_${nanoid(8)}`;
```

```typescript
// packages/core/src/constants/index.ts

export const NODE_TYPES = {
  DIALOGUE: 'dialogue',
  NARRATION: 'narration', 
  CHOICE: 'choice',
  SCENE_CHANGE: 'scene-change',
  CONDITION: 'condition',
  SET_VARIABLE: 'set-variable',
} as const;

export const EMOTIONS = [
  'neutral',
  'happy', 
  'sad',
  'angry',
  'surprised',
  'embarrassed',
  'thinking',
] as const;

export const ART_STYLES = [
  { id: 'anime', label: '日系动漫', prompt: 'anime style, cel shading' },
  { id: 'realistic', label: '写实风格', prompt: 'realistic, detailed' },
  { id: 'pixel', label: '像素风', prompt: 'pixel art, 16-bit style' },
  { id: 'watercolor', label: '水彩风', prompt: 'watercolor painting style' },
] as const;

export const GENRES = [
  { id: 'romance', label: '恋爱', icon: '💕' },
  { id: 'mystery', label: '悬疑', icon: '🔍' },
  { id: 'fantasy', label: '奇幻', icon: '✨' },
  { id: 'horror', label: '恐怖', icon: '👻' },
  { id: 'slice-of-life', label: '日常', icon: '☀️' },
  { id: 'sci-fi', label: '科幻', icon: '🚀' },
] as const;
```

---

### 4.2 @vng/editor - 剧本编辑器包

**职责**：提供基于 React Flow 的节点式剧本编辑器

#### 4.2.1 编辑器状态管理

```typescript
// packages/editor/src/store/editorStore.ts

import { create } from 'zustand';
import { 
  Node, 
  Edge, 
  OnNodesChange, 
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import { GameProject, ScriptNode, Character, Background } from '@vng/core';

interface EditorState {
  // 项目数据
  project: GameProject | null;
  
  // React Flow 状态
  nodes: Node<ScriptNode>[];
  edges: Edge[];
  
  // 选中状态
  selectedNodeId: string | null;
  
  // 操作方法
  setProject: (project: GameProject) => void;
  
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  
  addNode: (node: ScriptNode) => void;
  updateNode: (nodeId: string, data: Partial<ScriptNode>) => void;
  deleteNode: (nodeId: string) => void;
  
  addEdge: (source: string, target: string, sourceHandle?: string) => void;
  
  selectNode: (nodeId: string | null) => void;
  
  // 角色管理
  addCharacter: (character: Character) => void;
  updateCharacter: (characterId: string, data: Partial<Character>) => void;
  
  // 背景管理  
  addBackground: (background: Background) => void;
  updateBackground: (backgroundId: string, data: Partial<Background>) => void;
  
  // 导出
  exportProject: () => GameProject;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  
  setProject: (project) => {
    // 将 ScriptNode[] 转换为 React Flow 的 Node[]
    const nodes = project.script.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node,
    }));
    
    // 根据 nextNodeId 生成边
    const edges = generateEdgesFromScript(project.script);
    
    set({ project, nodes, edges });
  },
  
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  
  addNode: (scriptNode) => {
    const node: Node<ScriptNode> = {
      id: scriptNode.id,
      type: scriptNode.type,
      position: scriptNode.position,
      data: scriptNode,
    };
    set({ nodes: [...get().nodes, node] });
  },
  
  updateNode: (nodeId, data) => {
    set({
      nodes: get().nodes.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    });
  },
  
  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter(n => n.id !== nodeId),
      edges: get().edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    });
  },
  
  addEdge: (source, target, sourceHandle) => {
    const edge: Edge = {
      id: `${source}-${target}`,
      source,
      target,
      sourceHandle,
    };
    set({ edges: [...get().edges, edge] });
  },
  
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  
  addCharacter: (character) => {
    const project = get().project;
    if (project) {
      set({
        project: {
          ...project,
          characters: [...project.characters, character],
        },
      });
    }
  },
  
  updateCharacter: (characterId, data) => {
    const project = get().project;
    if (project) {
      set({
        project: {
          ...project,
          characters: project.characters.map(c =>
            c.id === characterId ? { ...c, ...data } : c
          ),
        },
      });
    }
  },
  
  addBackground: (background) => {
    const project = get().project;
    if (project) {
      set({
        project: {
          ...project,
          backgrounds: [...project.backgrounds, background],
        },
      });
    }
  },
  
  updateBackground: (backgroundId, data) => {
    const project = get().project;
    if (project) {
      set({
        project: {
          ...project,
          backgrounds: project.backgrounds.map(b =>
            b.id === backgroundId ? { ...b, ...data } : b
          ),
        },
      });
    }
  },
  
  exportProject: () => {
    const { project, nodes, edges } = get();
    if (!project) throw new Error('No project loaded');
    
    // 将 React Flow nodes 转回 ScriptNode[]
    const script = nodes.map(node => ({
      ...node.data,
      position: node.position,
    }));
    
    return { ...project, script };
  },
}));

// 辅助函数：从剧本节点生成边
function generateEdgesFromScript(script: ScriptNode[]): Edge[] {
  const edges: Edge[] = [];
  
  script.forEach(node => {
    if ('nextNodeId' in node && node.nextNodeId) {
      edges.push({
        id: `${node.id}-${node.nextNodeId}`,
        source: node.id,
        target: node.nextNodeId,
      });
    }
    
    if (node.type === 'choice') {
      node.choices.forEach((choice, index) => {
        edges.push({
          id: `${node.id}-${choice.nextNodeId}-${index}`,
          source: node.id,
          target: choice.nextNodeId,
          sourceHandle: `choice-${index}`,
          label: choice.text,
        });
      });
    }
    
    if (node.type === 'condition') {
      edges.push({
        id: `${node.id}-true`,
        source: node.id,
        target: node.trueNodeId,
        sourceHandle: 'true',
        label: 'True',
      });
      edges.push({
        id: `${node.id}-false`,
        source: node.id,
        target: node.falseNodeId,
        sourceHandle: 'false',
        label: 'False',
      });
    }
  });
  
  return edges;
}
```

#### 4.2.2 自定义节点组件

```typescript
// packages/editor/src/components/nodes/DialogueNode.tsx

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { DialogueNode as DialogueNodeType } from '@vng/core';
import { useEditorStore } from '../../store/editorStore';

export const DialogueNode = memo(({ id, data, selected }: NodeProps<DialogueNodeType>) => {
  const project = useEditorStore(state => state.project);
  const character = project?.characters.find(c => c.id === data.characterId);
  
  return (
    <div className={`
      px-4 py-3 rounded-lg border-2 min-w-[200px] max-w-[300px]
      bg-white shadow-md
      ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
    `}>
      {/* 输入连接点 */}
      <Handle 
        type="target" 
        position={Position.Top}
        className="w-3 h-3 bg-blue-500"
      />
      
      {/* 节点内容 */}
      <div className="flex items-center gap-2 mb-2">
        <div 
          className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold"
        >
          {character?.name?.[0] || '?'}
        </div>
        <span className="font-medium text-gray-800">
          {character?.displayName || '未知角色'}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 line-clamp-3">
        {data.text || '点击编辑对话内容...'}
      </p>
      
      {/* 输出连接点 */}
      <Handle 
        type="source" 
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  );
});

DialogueNode.displayName = 'DialogueNode';
```

```typescript
// packages/editor/src/components/nodes/ChoiceNode.tsx

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ChoiceNode as ChoiceNodeType } from '@vng/core';

export const ChoiceNode = memo(({ id, data, selected }: NodeProps<ChoiceNodeType>) => {
  return (
    <div className={`
      px-4 py-3 rounded-lg border-2 min-w-[220px]
      bg-amber-50 shadow-md
      ${selected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-200'}
    `}>
      <Handle 
        type="target" 
        position={Position.Top}
        className="w-3 h-3 bg-amber-500"
      />
      
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔀</span>
        <span className="font-medium text-amber-800">选择分支</span>
      </div>
      
      {data.prompt && (
        <p className="text-sm text-gray-600 mb-2 italic">"{data.prompt}"</p>
      )}
      
      <div className="space-y-2">
        {data.choices.map((choice, index) => (
          <div 
            key={choice.id}
            className="relative bg-white rounded px-3 py-2 text-sm border border-amber-200"
          >
            <span className="text-amber-600 font-medium mr-2">{index + 1}.</span>
            {choice.text || '选项内容...'}
            
            {/* 每个选项一个输出连接点 */}
            <Handle
              type="source"
              position={Position.Right}
              id={`choice-${index}`}
              className="w-2 h-2 bg-amber-500"
              style={{ top: '50%' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

ChoiceNode.displayName = 'ChoiceNode';
```

#### 4.2.3 主编辑器组件

```typescript
// packages/editor/src/components/ScriptCanvas.tsx

import { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useEditorStore } from '../store/editorStore';
import { DialogueNode } from './nodes/DialogueNode';
import { ChoiceNode } from './nodes/ChoiceNode';
import { SceneChangeNode } from './nodes/SceneChangeNode';
import { NarrationNode } from './nodes/NarrationNode';
import { NodePalette } from './panels/NodePalette';
import { PropertyPanel } from './panels/PropertyPanel';

const nodeTypes = {
  dialogue: DialogueNode,
  choice: ChoiceNode,
  'scene-change': SceneChangeNode,
  narration: NarrationNode,
};

export function ScriptCanvas() {
  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange,
    addEdge,
    selectNode,
    selectedNodeId,
  } = useEditorStore();
  
  const { screenToFlowPosition } = useReactFlow();
  
  const onConnect = useCallback((params: any) => {
    addEdge(params.source, params.target, params.sourceHandle);
  }, [addEdge]);
  
  const onNodeClick = useCallback((_: any, node: any) => {
    selectNode(node.id);
  }, [selectNode]);
  
  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);
  
  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap 
          nodeStrokeColor="#6366f1"
          nodeColor="#e0e7ff"
          nodeBorderRadius={8}
        />
        
        {/* 节点工具面板 */}
        <Panel position="top-left">
          <NodePalette />
        </Panel>
      </ReactFlow>
      
      {/* 属性编辑面板 */}
      {selectedNodeId && (
        <div className="absolute right-0 top-0 h-full w-80 bg-white border-l shadow-lg">
          <PropertyPanel nodeId={selectedNodeId} />
        </div>
      )}
    </div>
  );
}
```

#### 4.2.4 导出入口

```typescript
// packages/editor/src/index.ts

export { ScriptCanvas } from './components/ScriptCanvas';
export { useEditorStore } from './store/editorStore';
export { NodePalette } from './components/panels/NodePalette';
export { PropertyPanel } from './components/panels/PropertyPanel';

// 节点组件（可能用于自定义）
export * from './components/nodes';
```

---

### 4.3 @vng/player - 游戏播放器包

**职责**：提供可嵌入的视觉小说播放器组件

#### 4.3.1 游戏引擎核心

```typescript
// packages/player/src/engine/GameEngine.ts

import { 
  GameProject, 
  ScriptNode, 
  DialogueNode, 
  ChoiceNode,
  SceneChangeNode,
} from '@vng/core';

export interface GameState {
  currentNodeId: string;
  variables: Record<string, string | number | boolean>;
  history: string[];                    // 已访问的节点ID
  currentBackground: string | null;
  currentCharacters: CharacterState[];
  isWaitingForChoice: boolean;
  choices: ChoiceOption[];
}

export interface CharacterState {
  characterId: string;
  spriteId: string;
  position: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface ChoiceOption {
  id: string;
  text: string;
  nextNodeId: string;
  disabled: boolean;
}

export class GameEngine {
  private project: GameProject;
  private state: GameState;
  private listeners: Set<(state: GameState) => void> = new Set();
  
  constructor(project: GameProject) {
    this.project = project;
    this.state = this.createInitialState();
  }
  
  private createInitialState(): GameState {
    // 找到起始节点（第一个节点或标记为 start 的节点）
    const startNode = this.project.script[0];
    
    return {
      currentNodeId: startNode?.id || '',
      variables: {},
      history: [],
      currentBackground: null,
      currentCharacters: [],
      isWaitingForChoice: false,
      choices: [],
    };
  }
  
  getState(): GameState {
    return { ...this.state };
  }
  
  getCurrentNode(): ScriptNode | null {
    return this.project.script.find(n => n.id === this.state.currentNodeId) || null;
  }
  
  getCharacter(characterId: string) {
    return this.project.characters.find(c => c.id === characterId);
  }
  
  getBackground(backgroundId: string) {
    return this.project.backgrounds.find(b => b.id === backgroundId);
  }
  
  // 订阅状态变化
  subscribe(listener: (state: GameState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notify() {
    this.listeners.forEach(listener => listener(this.getState()));
  }
  
  // 前进到下一步
  advance() {
    const currentNode = this.getCurrentNode();
    if (!currentNode) return;
    
    // 如果在等待选择，不能自动前进
    if (this.state.isWaitingForChoice) return;
    
    // 记录历史
    this.state.history.push(currentNode.id);
    
    // 根据节点类型处理
    switch (currentNode.type) {
      case 'dialogue':
      case 'narration':
        this.handleDialogueAdvance(currentNode as DialogueNode);
        break;
      case 'scene-change':
        this.handleSceneChange(currentNode as SceneChangeNode);
        break;
      case 'choice':
        this.handleChoice(currentNode as ChoiceNode);
        break;
      default:
        // 其他节点类型直接跳到下一个
        if ('nextNodeId' in currentNode && currentNode.nextNodeId) {
          this.goToNode(currentNode.nextNodeId);
        }
    }
    
    this.notify();
  }
  
  private handleDialogueAdvance(node: DialogueNode) {
    if (node.nextNodeId) {
      this.goToNode(node.nextNodeId);
    } else {
      // 游戏结束
      console.log('Game ended');
    }
  }
  
  private handleSceneChange(node: SceneChangeNode) {
    this.state.currentBackground = node.backgroundId;
    
    if (node.characterPositions) {
      this.state.currentCharacters = node.characterPositions.map(pos => ({
        characterId: pos.characterId,
        spriteId: pos.spriteId || '',
        position: pos.position === 'off' ? 'center' : pos.position,
        visible: pos.position !== 'off',
      }));
    }
    
    if (node.nextNodeId) {
      this.goToNode(node.nextNodeId);
    }
  }
  
  private handleChoice(node: ChoiceNode) {
    this.state.isWaitingForChoice = true;
    this.state.choices = node.choices.map(choice => ({
      id: choice.id,
      text: choice.text,
      nextNodeId: choice.nextNodeId,
      disabled: choice.condition ? !this.evaluateCondition(choice.condition) : false,
    }));
  }
  
  // 选择选项
  selectChoice(choiceId: string) {
    const choice = this.state.choices.find(c => c.id === choiceId);
    if (!choice || choice.disabled) return;
    
    this.state.isWaitingForChoice = false;
    this.state.choices = [];
    this.goToNode(choice.nextNodeId);
    this.notify();
  }
  
  private goToNode(nodeId: string) {
    this.state.currentNodeId = nodeId;
  }
  
  private evaluateCondition(condition: any): boolean {
    // 简单的条件评估
    const value = this.state.variables[condition.variable];
    switch (condition.operator) {
      case '==': return value === condition.value;
      case '!=': return value !== condition.value;
      case '>': return Number(value) > Number(condition.value);
      case '<': return Number(value) < Number(condition.value);
      default: return true;
    }
  }
  
  // 设置变量
  setVariable(name: string, value: string | number | boolean) {
    this.state.variables[name] = value;
  }
  
  // 重置游戏
  reset() {
    this.state = this.createInitialState();
    this.notify();
  }
}
```

#### 4.3.2 播放器组件

```typescript
// packages/player/src/components/GamePlayer.tsx

import { useEffect, useState, useCallback } from 'react';
import { GameProject } from '@vng/core';
import { GameEngine, GameState } from '../engine/GameEngine';
import { Background } from './Background';
import { CharacterSprite } from './CharacterSprite';
import { DialogueBox } from './DialogueBox';
import { ChoicePanel } from './ChoicePanel';

interface GamePlayerProps {
  project: GameProject;
  className?: string;
  onEnd?: () => void;
}

export function GamePlayer({ project, className, onEnd }: GamePlayerProps) {
  const [engine] = useState(() => new GameEngine(project));
  const [state, setState] = useState<GameState>(() => engine.getState());
  
  useEffect(() => {
    return engine.subscribe(setState);
  }, [engine]);
  
  const currentNode = engine.getCurrentNode();
  const background = state.currentBackground 
    ? engine.getBackground(state.currentBackground)
    : null;
  
  const handleClick = useCallback(() => {
    if (!state.isWaitingForChoice) {
      engine.advance();
    }
  }, [engine, state.isWaitingForChoice]);
  
  const handleChoice = useCallback((choiceId: string) => {
    engine.selectChoice(choiceId);
  }, [engine]);
  
  // 获取当前说话角色
  const speakingCharacter = currentNode?.type === 'dialogue'
    ? engine.getCharacter(currentNode.characterId)
    : null;
  
  return (
    <div 
      className={`relative w-full aspect-video bg-black overflow-hidden select-none ${className}`}
      onClick={handleClick}
    >
      {/* 背景层 */}
      <Background 
        src={background?.imageUrl} 
        alt={background?.name}
      />
      
      {/* 角色层 */}
      <div className="absolute inset-0 flex items-end justify-center pb-32">
        {state.currentCharacters.filter(c => c.visible).map(charState => {
          const character = engine.getCharacter(charState.characterId);
          const sprite = character?.sprites.find(s => s.id === charState.spriteId)
            || character?.sprites[0];
          
          return (
            <CharacterSprite
              key={charState.characterId}
              src={sprite?.imageUrl}
              position={charState.position}
              isSpeaking={speakingCharacter?.id === charState.characterId}
            />
          );
        })}
      </div>
      
      {/* 对话框层 */}
      {currentNode && (currentNode.type === 'dialogue' || currentNode.type === 'narration') && (
        <DialogueBox
          characterName={speakingCharacter?.displayName}
          text={currentNode.text}
          nameColor={speakingCharacter?.dialogueStyle?.nameColor}
        />
      )}
      
      {/* 选择面板 */}
      {state.isWaitingForChoice && (
        <ChoicePanel
          choices={state.choices}
          onSelect={handleChoice}
        />
      )}
    </div>
  );
}
```

```typescript
// packages/player/src/components/DialogueBox.tsx

import { useState, useEffect } from 'react';

interface DialogueBoxProps {
  characterName?: string;
  text: string;
  nameColor?: string;
}

export function DialogueBox({ characterName, text, nameColor }: DialogueBoxProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  
  // 打字机效果
  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);
    
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 30);
    
    return () => clearInterval(interval);
  }, [text]);
  
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-white/20">
        {characterName && (
          <div 
            className="text-lg font-bold mb-2"
            style={{ color: nameColor || '#ffffff' }}
          >
            {characterName}
          </div>
        )}
        <p className="text-white text-lg leading-relaxed">
          {displayedText}
          {isTyping && <span className="animate-pulse">▌</span>}
        </p>
      </div>
    </div>
  );
}
```

```typescript
// packages/player/src/components/ChoicePanel.tsx

import { ChoiceOption } from '../engine/GameEngine';

interface ChoicePanelProps {
  choices: ChoiceOption[];
  onSelect: (choiceId: string) => void;
}

export function ChoicePanel({ choices, onSelect }: ChoicePanelProps) {
  return (
    <div 
      className="absolute inset-0 flex items-center justify-center bg-black/50"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex flex-col gap-3 w-full max-w-md px-4">
        {choices.map((choice, index) => (
          <button
            key={choice.id}
            onClick={() => onSelect(choice.id)}
            disabled={choice.disabled}
            className={`
              px-6 py-4 rounded-lg text-left transition-all
              ${choice.disabled 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.02] active:scale-[0.98]'
              }
            `}
          >
            <span className="text-sm opacity-60 mr-2">{index + 1}.</span>
            {choice.text}
          </button>
        ))}
      </div>
    </div>
  );
}
```

#### 4.3.3 导出入口

```typescript
// packages/player/src/index.ts

export { GamePlayer } from './components/GamePlayer';
export { GameEngine } from './engine/GameEngine';
export type { GameState, CharacterState, ChoiceOption } from './engine/GameEngine';
```

---

### 4.4 @vng/agent - AI Agent 包 (Mastra)

**职责**：提供 AI 驱动的剧本生成能力

#### 4.4.1 Mastra 配置

```typescript
// packages/agent/src/mastra/index.ts

import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

// 导入 Agents
import { directorAgent } from './agents/director';
import { writerAgent } from './agents/writer';
import { artistAgent } from './agents/artist';

// 导入 Tools
import { projectTools } from './tools/project';
import { scriptTools } from './tools/script';
import { characterTools } from './tools/character';
import { imageTools } from './tools/image';

// 导入 Workflows
import { createGameWorkflow } from './workflows/createGame';

export const mastra = new Mastra({
  agents: {
    director: directorAgent,
    writer: writerAgent,
    artist: artistAgent,
  },
  tools: {
    ...projectTools,
    ...scriptTools,
    ...characterTools,
    ...imageTools,
  },
  workflows: {
    createGame: createGameWorkflow,
  },
  logger: createLogger({
    name: 'VNG-Agent',
    level: 'info',
  }),
});
```

#### 4.4.2 Agent 定义

```typescript
// packages/agent/src/mastra/agents/director.ts

import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const directorAgent = new Agent({
  name: 'Director',
  instructions: `你是一位资深的视觉小说总导演。你的职责是：

1. 理解用户的创意需求
2. 规划整个视觉小说的结构
3. 协调编剧和美术的工作
4. 确保故事的一致性和完整性

你需要：
- 先分析用户的创意，提取关键信息（题材、风格、主要元素）
- 规划故事的主要章节和结构
- 设计核心角色和场景
- 输出结构化的规划文档

请始终以 JSON 格式输出结果。`,
  model: openai('gpt-4o-mini'),
});
```

```typescript
// packages/agent/src/mastra/agents/writer.ts

import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const writerAgent = new Agent({
  name: 'Writer',
  instructions: `你是一位专业的视觉小说编剧。你的职责是：

1. 根据导演的规划创作详细的剧本
2. 编写角色对话，确保每个角色有独特的说话风格
3. 设计剧情分支，创造有意义的玩家选择
4. 控制剧情节奏，创造引人入胜的叙事

剧本格式要求：
- 每个场景要有明确的背景设定
- 对话要自然，符合角色性格
- 分支选项要有实质性的影响
- 旁白要简洁有力

请严格按照指定的 JSON Schema 输出剧本节点。`,
  model: openai('gpt-4o-mini'),
});
```

```typescript
// packages/agent/src/mastra/agents/artist.ts

import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const artistAgent = new Agent({
  name: 'Artist',
  instructions: `你是一位视觉小说美术指导。你的职责是：

1. 根据角色设定生成立绘描述 prompt
2. 根据场景设定生成背景描述 prompt
3. 确保视觉风格的一致性
4. 为不同表情/场景变体设计 prompt

Prompt 生成原则：
- 保持风格一致性（同一项目使用相同的画风标签）
- 描述要具体（服装、发型、表情、姿态）
- 包含必要的质量标签
- 避免生成不当内容

请输出结构化的 prompt 列表。`,
  model: openai('gpt-4o-mini'),
});
```

#### 4.4.3 Tools 定义

```typescript
// packages/agent/src/mastra/tools/script.ts

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { ScriptNode, DialogueNode, ChoiceNode, createNodeId } from '@vng/core';

// 添加对话节点工具
export const addDialogueNode = createTool({
  id: 'add_dialogue_node',
  description: '向剧本中添加一个对话节点',
  inputSchema: z.object({
    characterId: z.string().describe('说话角色的ID'),
    text: z.string().describe('对话内容'),
    emotion: z.string().optional().describe('角色表情'),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }).describe('节点在编辑器中的位置'),
  }),
  outputSchema: z.object({
    nodeId: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { characterId, text, emotion, position } = context;
    
    const node: DialogueNode = {
      id: createNodeId('dialogue'),
      type: 'dialogue',
      characterId,
      text,
      spriteId: emotion,
      position,
      nextNodeId: null,
    };
    
    // 这里应该调用实际的存储逻辑
    // 在实际实现中，这会更新项目状态
    
    return {
      nodeId: node.id,
      success: true,
    };
  },
});

// 添加选择分支节点工具
export const addChoiceNode = createTool({
  id: 'add_choice_node',
  description: '向剧本中添加一个选择分支节点',
  inputSchema: z.object({
    prompt: z.string().optional().describe('选择前的提示文本'),
    choices: z.array(z.object({
      text: z.string().describe('选项文本'),
    })).describe('选项列表'),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
  }),
  outputSchema: z.object({
    nodeId: z.string(),
    choiceIds: z.array(z.string()),
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { prompt, choices, position } = context;
    
    const choiceItems = choices.map((c, i) => ({
      id: `choice_${i}_${Date.now()}`,
      text: c.text,
      nextNodeId: '', // 待连接
    }));
    
    const node: ChoiceNode = {
      id: createNodeId('choice'),
      type: 'choice',
      prompt,
      choices: choiceItems,
      position,
    };
    
    return {
      nodeId: node.id,
      choiceIds: choiceItems.map(c => c.id),
      success: true,
    };
  },
});

// 连接节点工具
export const connectNodes = createTool({
  id: 'connect_nodes',
  description: '连接两个剧本节点',
  inputSchema: z.object({
    sourceNodeId: z.string(),
    targetNodeId: z.string(),
    sourceHandle: z.string().optional().describe('源节点的连接点（用于选择节点）'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    // 实现节点连接逻辑
    return { success: true };
  },
});

export const scriptTools = {
  addDialogueNode,
  addChoiceNode,
  connectNodes,
};
```

```typescript
// packages/agent/src/mastra/tools/character.ts

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Character, createId } from '@vng/core';

export const createCharacter = createTool({
  id: 'create_character',
  description: '创建一个新角色',
  inputSchema: z.object({
    name: z.string().describe('角色名称'),
    displayName: z.string().describe('显示名称'),
    description: z.string().describe('角色外貌描述，用于生成立绘'),
    personality: z.string().optional().describe('角色性格描述'),
  }),
  outputSchema: z.object({
    characterId: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { name, displayName, description, personality } = context;
    
    const character: Character = {
      id: createId(),
      name,
      displayName,
      description,
      sprites: [],
      defaultSpriteId: '',
    };
    
    return {
      characterId: character.id,
      success: true,
    };
  },
});

export const characterTools = {
  createCharacter,
};
```

```typescript
// packages/agent/src/mastra/tools/image.ts

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const generateCharacterSprite = createTool({
  id: 'generate_character_sprite',
  description: '为角色生成立绘图片',
  inputSchema: z.object({
    characterId: z.string(),
    emotion: z.string().describe('表情类型'),
    basePrompt: z.string().describe('角色基础描述'),
    stylePrompt: z.string().describe('画风描述'),
  }),
  outputSchema: z.object({
    spriteId: z.string(),
    imageUrl: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { characterId, emotion, basePrompt, stylePrompt } = context;
    
    // 构建完整 prompt
    const fullPrompt = `${basePrompt}, ${emotion} expression, ${stylePrompt}, high quality, detailed`;
    
    // 调用图像生成 API（这里用占位符）
    // 实际实现中应该调用 Stable Diffusion / Midjourney / DALL-E 等
    const imageUrl = await callImageGenerationAPI(fullPrompt);
    
    return {
      spriteId: `sprite_${characterId}_${emotion}`,
      imageUrl,
      success: true,
    };
  },
});

export const generateBackground = createTool({
  id: 'generate_background',
  description: '生成场景背景图片',
  inputSchema: z.object({
    name: z.string(),
    description: z.string(),
    stylePrompt: z.string(),
  }),
  outputSchema: z.object({
    backgroundId: z.string(),
    imageUrl: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { name, description, stylePrompt } = context;
    
    const fullPrompt = `${description}, ${stylePrompt}, background art, no characters, wide shot`;
    const imageUrl = await callImageGenerationAPI(fullPrompt);
    
    return {
      backgroundId: `bg_${name.replace(/\s+/g, '_')}`,
      imageUrl,
      success: true,
    };
  },
});

// 图像生成 API 调用（占位符实现）
async function callImageGenerationAPI(prompt: string): Promise<string> {
  // TODO: 实现实际的图像生成 API 调用
  // 可选方案：
  // 1. Stable Diffusion WebUI API
  // 2. Replicate API
  // 3. 通义万相 API
  // 4. Midjourney API (非官方)
  
  console.log('Generating image with prompt:', prompt);
  
  // 返回占位符图片
  return `https://placehold.co/512x768?text=${encodeURIComponent(prompt.slice(0, 20))}`;
}

export const imageTools = {
  generateCharacterSprite,
  generateBackground,
};
```

#### 4.4.4 Workflow 定义

```typescript
// packages/agent/src/mastra/workflows/createGame.ts

import { Workflow, Step } from '@mastra/core/workflows';
import { z } from 'zod';
import { mastra } from '../index';
import { GameProject, ArtStyle, GameGenre } from '@vng/core';

// 定义工作流输入
const CreateGameInput = z.object({
  idea: z.string().describe('用户的创意描述'),
  genre: z.nativeEnum(GameGenre).optional(),
  artStyle: z.nativeEnum(ArtStyle).optional(),
  length: z.enum(['short', 'medium', 'long']).default('short'),
});

// 步骤1：导演规划
const planningStep = new Step({
  id: 'planning',
  inputSchema: CreateGameInput,
  outputSchema: z.object({
    title: z.string(),
    synopsis: z.string(),
    characters: z.array(z.object({
      name: z.string(),
      role: z.string(),
      description: z.string(),
      personality: z.string(),
    })),
    scenes: z.array(z.object({
      name: z.string(),
      description: z.string(),
    })),
    plotOutline: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const director = mastra.getAgent('director');
    
    const prompt = `
请为以下创意规划一个视觉小说项目：

创意：${context.idea}
题材：${context.genre || '自动判断'}
风格：${context.artStyle || '自动判断'}
长度：${context.length === 'short' ? '短篇(10-15个场景)' : context.length === 'medium' ? '中篇(20-30个场景)' : '长篇(40+场景)'}

请输出：
1. 游戏标题
2. 故事梗概
3. 主要角色列表（包含姓名、角色定位、外貌描述、性格）
4. 主要场景列表（包含名称、描述）
5. 剧情大纲（分章节）

以 JSON 格式输出。
`;
    
    const result = await director.generate(prompt, {
      output: 'json',
    });
    
    return result;
  },
});

// 步骤2：编写剧本
const scriptWritingStep = new Step({
  id: 'script-writing',
  inputSchema: z.object({
    planning: planningStep.outputSchema,
  }),
  outputSchema: z.object({
    script: z.array(z.any()), // ScriptNode[]
  }),
  execute: async ({ context }) => {
    const writer = mastra.getAgent('writer');
    const { planning } = context;
    
    const prompt = `
请根据以下规划编写完整的视觉小说剧本：

标题：${planning.title}
梗概：${planning.synopsis}

角色：
${planning.characters.map(c => `- ${c.name}（${c.role}）：${c.personality}`).join('\n')}

场景：
${planning.scenes.map(s => `- ${s.name}：${s.description}`).join('\n')}

剧情大纲：
${planning.plotOutline.map((p, i) => `${i + 1}. ${p}`).join('\n')}

请输出完整的剧本节点列表，格式为 JSON 数组，每个节点包含：
- id: 唯一标识
- type: 节点类型 (dialogue/narration/choice/scene-change)
- 以及对应类型的其他字段

确保：
1. 故事流畅完整
2. 包含 2-3 个有意义的选择分支
3. 对话符合角色性格
4. 场景转换自然
`;
    
    const result = await writer.generate(prompt, {
      output: 'json',
    });
    
    return result;
  },
});

// 步骤3：生成美术资源
const artGenerationStep = new Step({
  id: 'art-generation',
  inputSchema: z.object({
    planning: planningStep.outputSchema,
    artStyle: z.string(),
  }),
  outputSchema: z.object({
    characters: z.array(z.object({
      id: z.string(),
      sprites: z.array(z.object({
        emotion: z.string(),
        imageUrl: z.string(),
      })),
    })),
    backgrounds: z.array(z.object({
      id: z.string(),
      imageUrl: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const { planning, artStyle } = context;
    
    // 并行生成所有角色立绘
    const characterPromises = planning.characters.map(async (char) => {
      const emotions = ['neutral', 'happy', 'sad', 'surprised'];
      const sprites = await Promise.all(
        emotions.map(async (emotion) => {
          const result = await mastra.executeTool('generateCharacterSprite', {
            characterId: char.name,
            emotion,
            basePrompt: char.description,
            stylePrompt: artStyle,
          });
          return {
            emotion,
            imageUrl: result.imageUrl,
          };
        })
      );
      
      return {
        id: char.name.toLowerCase().replace(/\s+/g, '_'),
        sprites,
      };
    });
    
    // 并行生成所有背景
    const backgroundPromises = planning.scenes.map(async (scene) => {
      const result = await mastra.executeTool('generateBackground', {
        name: scene.name,
        description: scene.description,
        stylePrompt: artStyle,
      });
      
      return {
        id: result.backgroundId,
        imageUrl: result.imageUrl,
      };
    });
    
    const [characters, backgrounds] = await Promise.all([
      Promise.all(characterPromises),
      Promise.all(backgroundPromises),
    ]);
    
    return { characters, backgrounds };
  },
});

// 步骤4：组装项目
const assembleStep = new Step({
  id: 'assemble',
  inputSchema: z.object({
    planning: planningStep.outputSchema,
    script: scriptWritingStep.outputSchema,
    art: artGenerationStep.outputSchema,
    meta: z.object({
      genre: z.string(),
      artStyle: z.string(),
    }),
  }),
  outputSchema: z.custom<GameProject>(),
  execute: async ({ context }) => {
    const { planning, script, art, meta } = context;
    
    const project: GameProject = {
      id: `project_${Date.now()}`,
      title: planning.title,
      description: planning.synopsis,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      meta: {
        author: 'AI Generated',
        version: '1.0.0',
        genre: meta.genre as any,
        artStyle: meta.artStyle as any,
      },
      characters: planning.characters.map((char, i) => ({
        id: art.characters[i]?.id || char.name.toLowerCase().replace(/\s+/g, '_'),
        name: char.name,
        displayName: char.name,
        description: char.description,
        sprites: art.characters[i]?.sprites.map(s => ({
          id: `${char.name}_${s.emotion}`,
          emotion: s.emotion as any,
          imageUrl: s.imageUrl,
        })) || [],
        defaultSpriteId: `${char.name}_neutral`,
      })),
      backgrounds: planning.scenes.map((scene, i) => ({
        id: art.backgrounds[i]?.id || scene.name.toLowerCase().replace(/\s+/g, '_'),
        name: scene.name,
        description: scene.description,
        imageUrl: art.backgrounds[i]?.imageUrl || '',
      })),
      script: script.script,
      settings: {
        textSpeed: 30,
        autoPlayDelay: 3000,
        defaultTransition: 'fade',
      },
    };
    
    return project;
  },
});

// 组装工作流
export const createGameWorkflow = new Workflow({
  name: 'create-game',
  triggerSchema: CreateGameInput,
})
  .step(planningStep)
  .step(scriptWritingStep, {
    variables: {
      planning: { step: planningStep },
    },
  })
  .step(artGenerationStep, {
    variables: {
      planning: { step: planningStep },
      artStyle: { path: 'trigger.artStyle', fallback: 'anime style' },
    },
  })
  .step(assembleStep, {
    variables: {
      planning: { step: planningStep },
      script: { step: scriptWritingStep },
      art: { step: artGenerationStep },
      meta: {
        genre: { path: 'trigger.genre', fallback: 'romance' },
        artStyle: { path: 'trigger.artStyle', fallback: 'anime' },
      },
    },
  })
  .commit();
```

#### 4.4.5 导出入口

```typescript
// packages/agent/src/index.ts

export { mastra } from './mastra';
export { createGameWorkflow } from './mastra/workflows/createGame';

// 便捷方法：一键生成游戏
export async function generateGame(options: {
  idea: string;
  genre?: string;
  artStyle?: string;
  length?: 'short' | 'medium' | 'long';
  onProgress?: (step: string, progress: number) => void;
}) {
  const { idea, genre, artStyle, length = 'short', onProgress } = options;
  
  onProgress?.('planning', 0);
  
  const result = await mastra.runWorkflow('createGame', {
    idea,
    genre,
    artStyle,
    length,
  });
  
  onProgress?.('complete', 100);
  
  return result;
}
```

---

## 五、主应用设计 (apps/web)

### 5.1 页面结构

```
apps/web/src/app/
├── layout.tsx                    # 根布局
├── page.tsx                      # 首页（项目列表）
├── create/
│   └── page.tsx                  # 创作向导页
├── project/[id]/
│   ├── layout.tsx                # 项目布局
│   ├── page.tsx                  # 项目概览
│   ├── editor/
│   │   └── page.tsx              # 剧本编辑器
│   ├── characters/
│   │   └── page.tsx              # 角色管理
│   ├── backgrounds/
│   │   └── page.tsx              # 背景管理
│   └── preview/
│       └── page.tsx              # 游戏预览
└── api/
    ├── generate/
    │   └── route.ts              # AI 生成 API
    └── project/
        └── route.ts              # 项目 CRUD API
```

### 5.2 创作向导页面

```typescript
// apps/web/src/app/create/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GENRES, ART_STYLES } from '@vng/core';
import { Button, Input, Card } from '@vng/ui';

type Step = 'idea' | 'style' | 'generating' | 'complete';

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('idea');
  const [idea, setIdea] = useState('');
  const [genre, setGenre] = useState('');
  const [artStyle, setArtStyle] = useState('');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  
  const handleGenerate = async () => {
    setStep('generating');
    setLogs([]);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, genre, artStyle }),
      });
      
      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          const data = JSON.parse(line);
          if (data.type === 'progress') {
            setProgress(data.progress);
            setLogs(prev => [...prev, data.message]);
          } else if (data.type === 'complete') {
            setStep('complete');
            router.push(`/project/${data.projectId}`);
          }
        }
      }
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          ✨ 创建你的视觉小说
        </h1>
        
        {step === 'idea' && (
          <Card className="p-8">
            <h2 className="text-2xl font-semibold mb-4">告诉我你的创意</h2>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="例如：一个关于咖啡店邂逅的浪漫故事，女主是神秘的占卜师..."
              className="w-full h-40 p-4 rounded-lg border-2 border-gray-200 focus:border-indigo-500 resize-none"
            />
            <Button 
              onClick={() => setStep('style')}
              disabled={!idea.trim()}
              className="w-full mt-4"
            >
              下一步 →
            </Button>
          </Card>
        )}
        
        {step === 'style' && (
          <Card className="p-8">
            <h2 className="text-2xl font-semibold mb-4">选择风格</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">故事题材</label>
              <div className="grid grid-cols-3 gap-2">
                {GENRES.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGenre(g.id)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      genre === g.id 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{g.icon}</span>
                    <span className="block text-sm mt-1">{g.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">画面风格</label>
              <div className="grid grid-cols-2 gap-2">
                {ART_STYLES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setArtStyle(s.id)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      artStyle === s.id 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('idea')}>
                ← 返回
              </Button>
              <Button 
                onClick={handleGenerate}
                disabled={!genre || !artStyle}
                className="flex-1"
              >
                🚀 开始生成
              </Button>
            </div>
          </Card>
        )}
        
        {step === 'generating' && (
          <Card className="p-8">
            <h2 className="text-2xl font-semibold mb-4 text-center">
              AI 正在创作中...
            </h2>
            
            {/* 进度条 */}
            <div className="w-full h-2 bg-gray-200 rounded-full mb-6">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* 日志 */}
            <div className="bg-gray-900 rounded-lg p-4 h-60 overflow-y-auto font-mono text-sm">
              {logs.map((log, i) => (
                <div key={i} className="text-green-400">
                  <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                </div>
              ))}
              <span className="animate-pulse">▌</span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
```

### 5.3 编辑器页面

```typescript
// apps/web/src/app/project/[id]/editor/page.tsx

'use client';

import { useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { ScriptCanvas, useEditorStore } from '@vng/editor';
import { GamePlayer } from '@vng/player';
import { useProject } from '@/hooks/useProject';

export default function EditorPage({ params }: { params: { id: string } }) {
  const { project, loading } = useProject(params.id);
  const setProject = useEditorStore(state => state.setProject);
  const exportProject = useEditorStore(state => state.exportProject);
  
  useEffect(() => {
    if (project) {
      setProject(project);
    }
  }, [project, setProject]);
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="h-screen flex">
      {/* 左侧：编辑器 */}
      <div className="flex-1 h-full">
        <ReactFlowProvider>
          <ScriptCanvas />
        </ReactFlowProvider>
      </div>
      
      {/* 右侧：预览 */}
      <div className="w-96 h-full border-l bg-gray-100 p-4">
        <h3 className="font-semibold mb-4">实时预览</h3>
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <GamePlayer 
            project={exportProject()}
            className="w-full h-full"
          />
        </div>
        
        {/* 快捷操作 */}
        <div className="mt-4 space-y-2">
          <button className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500">
            💾 保存项目
          </button>
          <button className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-500">
            📦 导出游戏
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 六、开发计划

### 基础架构 + 数据流

- [ ] 初始化 monorepo (pnpm + turborepo)
- [ ] 创建 `@vng/core` 包，定义所有类型
- [ ] 创建 `@vng/ui` 包，搭建基础组件

- [ ] 创建 `@vng/player` 包
- [ ] 实现 GameEngine 核心逻辑
- [ ] 实现基础播放器组件（背景、对话框、选项）

### 编辑器 + Agent

- [ ] 创建 `@vng/editor` 包
- [ ] 集成 React Flow
- [ ] 实现自定义节点（对话、选择、场景）
- [ ] 实现属性面板

- [ ] 创建 `@vng/agent` 包
- [ ] 配置 Mastra
- [ ] 实现 Director Agent + Writer Agent
- [ ] 实现 createGame workflow

### 整合 + 打磨

- [ ] 创建 `apps/web`
- [ ] 实现创作向导页面
- [ ] 实现项目编辑器页面
- [ ] 对接 Agent API

- [ ] 实现游戏导出功能
- [ ] UI 打磨和动画
- [ ] 测试和修复 Bug
- [ ] 录制演示视频

---

## 七、导出功能设计

### 7.1 导出为单 HTML 文件

```typescript
// apps/web/src/lib/export.ts

import { GameProject } from '@vng/core';

export async function exportToHTML(project: GameProject): Promise<string> {
  // 1. 将所有图片转为 Base64 内联
  const inlinedProject = await inlineAllAssets(project);
  
  // 2. 获取播放器运行时代码
  const playerRuntime = await getPlayerRuntime();
  
  // 3. 生成完整 HTML
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: #000; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      min-height: 100vh;
    }
    #game { width: 100%; max-width: 1280px; aspect-ratio: 16/9; }
  </style>
</head>
<body>
  <div id="game"></div>
  <script>
    const PROJECT_DATA = ${JSON.stringify(inlinedProject)};
    ${playerRuntime}
    VNGPlayer.mount('#game', PROJECT_DATA);
  </script>
</body>
</html>
  `.trim();
  
  return html;
}

async function inlineAllAssets(project: GameProject): Promise<GameProject> {
  // 将所有图片 URL 转换为 Base64
  // 实现略...
  return project;
}

async function getPlayerRuntime(): Promise<string> {
  // 获取打包后的播放器 JS 代码
  // 可以用 esbuild 打包 @vng/player 为单文件
  return '/* Player runtime code */';
}
```

---

## 八、技术栈总结

| 层级 | 技术选型 |
|------|---------|
| **包管理** | pnpm workspace + turborepo |
| **语言** | TypeScript 5.x |
| **前端框架** | React 18 + Next.js (App Router) |
| **状态管理** | Zustand |
| **流程图编辑** | React Flow |
| **UI 样式** | MaterialUI Tailwind(Optional) |
| **Agent框架** | Mastra |
| **LLM** | OpenAI GPT (及其他兼容模型 如 Qwen) |
| **图像生成** | Stable Diffusion / 通义万相 |
| **构建工具** | Turbopack / Vite |··
| **环境** | Node 20.11 |