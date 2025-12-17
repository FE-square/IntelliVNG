# ChatBot - AI 编辑助手组件

## 概述

`ChatBot` 是一个前端 React 组件，为 IntelliVNG 视觉小说编辑器提供 AI 辅助编辑功能。它通过 SSE (Server-Sent Events) 与后端 Agent 通信，支持实时对话、工具调用、自动应用修改等功能。

**文件位置**: `packages/editor/src/components/ChatBot.tsx`

## 核心功能

### 1. 智能对话
- 实时流式响应 (SSE)
- 支持 Markdown 加粗语法渲染
- AI 思考过程可视化
- Token 使用统计显示

### 2. 自动操作
- 添加/修改/删除剧情节点
- 连接节点形成剧情流程
- 触发立绘/头像/背景图生成
- 剧本结构分析

### 3. 用户体验
- 可拖拽调整高度
- 展开/收起动画
- 消息重试功能
- 操作执行指示器
- 国际化 (i18n) 支持

## 组件接口

### Props

```typescript
interface ChatBotProps {
  // 必需属性
  project: GameProject;              // 当前项目数据
  projectId: string;                 // 项目 ID
  onUpdate: (project: GameProject) => void;  // 项目更新回调

  // 可选属性
  onGenerateSprite?: (character: any) => Promise<void>;   // 立绘生成回调
  onGenerateAvatar?: (character: any) => Promise<void>;   // 头像生成回调
  onGenerateBackground?: (background: any) => Promise<void>; // 背景生成回调
  backendUrl?: string;               // 后端服务地址
  locale?: string;                   // 语言设置 (默认 'zh-CN')
  i18n?: ChatBotI18n;                // 国际化文本
}
```

### i18n 配置

```typescript
interface ChatBotI18n {
  // 基础 UI
  title?: string;                    // 标题
  placeholder?: string;              // 输入框占位符
  send?: string;                     // 发送按钮
  thinking?: string;                 // 思考中提示
  noMessages?: string;               // 空状态提示
  
  // 操作相关
  errorRetry?: string;
  retry?: string;
  actionApplied?: string;
  operationsExecuted?: string;
  operationFailed?: string;
  
  // 生图相关
  generatingImage?: string;
  imageGenerated?: string;
  targetNotFound?: string;
  sprite?: string;
  avatar?: string;
  background?: string;
  generatingSprite?: string;
  generatingAvatar?: string;
  generatingBackground?: string;
  spriteGenerated?: string;
  avatarGenerated?: string;
  backgroundGenerated?: string;
  generationFailed?: string;
  
  // 分析结果
  analysisValid?: string;
  analysisIssuesFound?: string;      // 支持 {totalIssues} 变量
  analysisPaths?: string;            // 支持 {totalPaths}, {endings} 变量
  analysisDialogueQuality?: string;  // 支持 {score} 变量
  analysisBranchDistribution?: string;
  analysisNonlinearScore?: string;
  analysisComplete?: string;
  
  // Token 统计
  tokenInput?: string;               // 输入 Token 标签
  tokenOutput?: string;              // 输出 Token 标签
  tokenTotal?: string;               // 总计 Token 标签
  sessionTokens?: string;            // 会话总计标签
  
  // 思考步骤
  thinkingStepsLabel?: string;       // 思考步骤标题
  stepLabel?: string;                // 步骤标签
  
  // 其他
  toolCall?: string;                 // 支持 {tool} 变量
  generateImageWithName?: string;    // 支持 {typeLabel}, {targetName} 变量
  choiceDefault?: string;
  resizeHeight?: string;
}
```

## 数据结构

### ChatMessage

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'sending' | 'streaming' | 'done' | 'error';
  
  // AI 响应专用
  actions?: Array<{
    type: 'patch' | 'analysis' | 'query-result' | 'error' | 'generate-image';
    payload: any;
  }>;
  thinkingSteps?: Array<{
    stepIndex: number;
    content: string;
    timestamp: number;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

## 通信协议

### SSE 事件类型

ChatBot 通过 SSE 与后端 `/api/game/editor-chat` 端点通信：

| 事件 | 数据格式 | 说明 |
|------|---------|------|
| `start` | `{ timestamp }` | 开始处理 |
| `thinking` | `{ stepIndex, content, timestamp }` | AI 思考步骤 |
| `tool_call` | `{ tool, type? }` | 工具调用中 |
| `message` | `{ content }` | 文本消息 |
| `action` | `{ type, payload }` | 执行动作 |
| `usage` | `{ promptTokens, completionTokens, totalTokens }` | Token 统计 |
| `done` | `{}` | 处理完成 |
| `error` | `{ message }` | 错误信息 |

### 请求体

```typescript
{
  projectId: string;
  message: string;
  currentScript: StoryNode[];
  characters: Character[];
  backgrounds: Background[];
  projectTitle: string;
  locale: string;
}
```

## 动作处理

### 支持的动作类型

| 动作 | 类型 | 说明 |
|------|------|------|
| 添加节点 | `patch` | `payload.action = 'add-node'` |
| 更新节点 | `patch` | `payload.action = 'update-node'` |
| 删除节点 | `patch` | `payload.action = 'delete-node'` |
| 连接节点 | `patch` | `payload.action = 'connect-nodes'` |
| 剧本分析 | `analysis` | 包含 validate/paths/dialogue/branch/score |
| 查询结果 | `query-result` | 节点查询结果 |
| 生成图片 | `generate-image` | 触发立绘/头像/背景生成 |
| 错误 | `error` | 操作失败信息 |

### 动作执行流程

```
┌──────────────┐     SSE action     ┌──────────────┐
│   Backend    │ ──────────────────▶│   ChatBot    │
│   Agent      │                    │  applyAction │
└──────────────┘                    └───────┬──────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
             ┌────────────┐          ┌────────────┐          ┌────────────┐
             │   patch    │          │  generate  │          │  analysis  │
             │ (节点操作)  │          │   -image   │          │  (展示)     │
             └─────┬──────┘          └─────┬──────┘          └────────────┘
                   │                       │
                   ▼                       ▼
             ┌────────────┐          ┌────────────┐
             │ onUpdate() │          │ onGenerate │
             │ (更新项目)  │          │  Sprite()  │
             └────────────┘          └────────────┘
```

## UI 结构

```
┌─────────────────────────────────────────────────────────┐
│  [拖拽调整高度条]                                         │
├─────────────────────────────────────────────────────────┤
│  ✨ AI 编辑助手                              [加载指示器] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                 消息列表区域                      │   │
│  │                                                   │   │
│  │  [用户头像] 用户消息...                    [重试] │   │
│  │                                                   │   │
│  │  [AI头像] AI 响应消息...                          │   │
│  │           ▶ 思考步骤 (3)                         │   │
│  │           📊 1,234 in + 567 out = 1,801 tokens   │   │
│  │           ✅ 已执行 2 个操作                      │   │
│  │              • 🎨 生成立绘: 小红                  │   │
│  │              • 添加节点: 新场景                    │   │
│  │                                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [输入框: 输入消息...]                         [发送]   │
│  📊 会话总计: 5,678 in + 2,345 out = 8,023 tokens      │
└─────────────────────────────────────────────────────────┘

[展开/收起按钮]
```

## 使用示例

### 基础用法

```tsx
import { ChatBot } from '@vng/editor';

function EditorPage() {
  const [project, setProject] = useState<GameProject>(initialProject);
  
  return (
    <ChatBot
      project={project}
      projectId="1"
      onUpdate={setProject}
      locale="zh-CN"
    />
  );
}
```

### 完整配置

```tsx
<ChatBot
  project={project}
  projectId={projectId}
  onUpdate={handleProjectUpdate}
  onGenerateSprite={handleGenerateSprite}
  onGenerateAvatar={handleGenerateAvatar}
  onGenerateBackground={handleGenerateBackground}
  backendUrl="http://localhost:4000"
  locale="en-US"
  i18n={{
    title: 'AI Editor Assistant',
    placeholder: 'Type a message...',
    thinking: 'Thinking...',
    tokenInput: 'in',
    tokenOutput: 'out',
    tokenTotal: 'tokens',
    sessionTokens: 'Session total',
    thinkingStepsLabel: 'Thinking steps',
    stepLabel: 'Step',
    analysisIssuesFound: '⚠️ Found {totalIssues} issues',
    analysisPaths: '📊 {totalPaths} paths, {endings} endings',
    // ... 更多配置
  }}
/>
```

## 功能特性详解

### 1. 高度调整

- 默认高度: 384px (h-96)
- 最小高度: 300px
- 最大高度: 屏幕高度的 80%
- 用户设置保存到 `localStorage` (`vng_chatbot_height`)

### 2. 思考步骤显示

AI 的思考过程通过可折叠的 `<details>` 元素展示：
- 自动过滤空内容的步骤
- 支持 Markdown 加粗语法
- 显示步骤序号和内容

### 3. Token 统计

两个层级的统计显示：
- **消息级**: 每条 AI 响应底部显示该次调用的 Token 消耗
- **会话级**: 输入框下方显示当前会话的累计 Token 消耗

### 4. 消息重试

用户可以重试之前发送的消息：
- 点击用户消息的重试按钮
- 移除该消息之后的所有 AI 响应
- 重新发送请求

### 5. 操作指示器

当 AI 执行操作时：
- 头部显示绿色 "已应用" 提示
- 消息底部列出所有执行的操作
- 包含友好的操作描述

## 辅助函数

### formatTemplate

字符串模板替换函数，用于 i18n：

```typescript
formatTemplate('Found {count} items', { count: 5 });
// => 'Found 5 items'
```

### renderMessageContent

解析并渲染 Markdown 加粗语法：

```typescript
renderMessageContent('This is **bold** text');
// => ['This is ', <strong>bold</strong>, ' text']
```

### formatActionDescription

格式化操作描述为用户友好的文本：

```typescript
formatActionDescription({ 
  type: 'generate-image', 
  payload: { imageType: 'sprite', targetName: '小红' } 
}, i18n);
// => '🎨 生成立绘: 小红'
```

## 注意事项

1. **SSE 连接**: 使用 `AbortController` 管理，组件卸载或新请求时自动取消。

2. **状态同步**: 动作执行后直接调用 `onUpdate()` 更新父组件状态，确保 UI 同步。

3. **错误处理**: 网络错误、解析错误都会被捕获并显示友好提示。

4. **性能优化**: 
   - 消息列表使用 `key` 避免不必要的重渲染
   - 滚动行为使用 `smooth` 提升体验
   - 高度调整使用 `localStorage` 持久化

5. **国际化**: 所有用户可见文本都支持通过 `i18n` prop 自定义。

