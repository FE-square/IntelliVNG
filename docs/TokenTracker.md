# TokenTracker - LLM Token 使用追踪服务

## 概述

`TokenTracker` 是一个后端单例服务，用于统一追踪所有 LLM 调用的 Token 消耗。它支持多种 LLM 调用来源，提供会话级和全局级的统计功能。

**文件位置**: `apps/intelli-services/src/services/token-tracker.ts`

## 核心功能

### 1. 多来源支持

| 来源类型 | 说明 | 快捷方法 |
|---------|------|---------|
| `mastra-agent` | Mastra 框架 Agent 调用 | `trackMastraAgent()` |
| `openai-sdk` | 直接 OpenAI SDK 调用 | `trackOpenAI()` |
| `anthropic-sdk` | Anthropic Claude SDK 调用 | `trackAnthropic()` |
| `other` | 其他 LLM API 调用 | `track()` |

### 2. 会话与全局追踪

- **会话级追踪**: 按 `sessionId`（如项目 ID）分组记录
- **全局追踪**: 所有调用的汇总统计
- **时间范围查询**: 支持按时间段筛选统计

### 3. 多维度统计

- 按**来源**统计 (Mastra/OpenAI/Anthropic)
- 按**模型**统计 (gpt-4o-mini/claude-3-sonnet)
- 按**Agent**统计 (editor-chat/story-planner)

## 数据结构

### TokenUsage

```typescript
interface TokenUsage {
  promptTokens: number;      // 输入 Token 数
  completionTokens: number;  // 输出 Token 数
  totalTokens: number;       // 总 Token 数
}
```

### TokenRecord

```typescript
interface TokenRecord {
  id: string;                // 唯一标识
  timestamp: number;         // 时间戳
  source: 'mastra-agent' | 'openai-sdk' | 'anthropic-sdk' | 'other';
  model: string;             // 模型名称
  agentName?: string;        // Agent 名称 (Mastra 专用)
  operation?: string;        // 操作描述
  usage: TokenUsage;         // Token 使用信息
  metadata?: Record<string, any>;  // 自定义元数据
}
```

### TokenSummary

```typescript
interface TokenSummary {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  callCount: number;
  bySource: Record<string, TokenUsage & { count: number }>;
  byModel: Record<string, TokenUsage & { count: number }>;
  byAgent: Record<string, TokenUsage & { count: number }>;
  records: TokenRecord[];
}
```

## API 参考

### 基础追踪方法

#### `track(params)`

通用追踪方法，记录任意 LLM 调用。

```typescript
tokenTracker.track({
  sessionId: 'project-123',
  source: 'other',
  model: 'custom-model',
  operation: 'text-generation',
  usage: {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
  },
  metadata: { customField: 'value' },
});
```

### 快捷追踪方法

#### `trackMastraAgent(params)`

追踪 Mastra Agent 调用，自动从响应中提取 Token 信息。

```typescript
const response = await agent.generate(message);
tokenTracker.trackMastraAgent({
  sessionId: projectId,
  agentName: 'editor-chat',
  model: 'gpt-4o-mini',
  response,
  operation: 'editor-chat',
  metadata: { messageLength: message.length },
});
```

#### `trackOpenAI(params)`

追踪 OpenAI SDK 调用。

```typescript
const response = await openai.chat.completions.create({ ... });
tokenTracker.trackOpenAI({
  sessionId: projectId,
  model: 'gpt-4-turbo',
  response,
  operation: 'game-generation',
});
```

#### `trackAnthropic(params)`

追踪 Anthropic SDK 调用。

```typescript
const response = await anthropic.messages.create({ ... });
tokenTracker.trackAnthropic({
  sessionId: projectId,
  model: 'claude-3-sonnet-20240229',
  response,
  operation: 'story-review',
});
```

### 响应解析方法

| 方法 | 说明 |
|------|------|
| `extractFromMastraResponse(response)` | 解析 Mastra Agent 响应 |
| `extractFromOpenAIResponse(response)` | 解析 OpenAI SDK 响应 |
| `extractFromAnthropicResponse(response)` | 解析 Anthropic SDK 响应 |

这些方法处理不同 SDK 的字段命名差异：
- Mastra: `inputTokens`, `outputTokens`
- OpenAI: `prompt_tokens`, `completion_tokens`
- Anthropic: `input_tokens`, `output_tokens`

### 统计查询方法

#### `getSessionSummary(sessionId)`

获取指定会话的统计汇总。

```typescript
const summary = tokenTracker.getSessionSummary('project-123');
console.log(`会话 Token: ${summary.totalTokens}`);
```

#### `getGlobalSummary()`

获取全局统计汇总。

```typescript
const summary = tokenTracker.getGlobalSummary();
console.log(`总调用次数: ${summary.callCount}`);
```

#### `getSummaryByTimeRange(startTime, endTime?)`

获取指定时间范围的统计。

```typescript
const oneHourAgo = Date.now() - 3600000;
const summary = tokenTracker.getSummaryByTimeRange(oneHourAgo);
```

#### `getFormattedReport(summary?)`

生成格式化的统计报告字符串。

```typescript
const report = tokenTracker.getFormattedReport();
console.log(report);
// 📊 Token 使用统计报告
// ═══════════════════════════════════════
// 🔢 总计: 45,678 tokens
//    ├─ Prompt:     32,100
//    └─ Completion: 13,578
// 📈 调用次数: 25
// ...
```

### 清理方法

| 方法 | 说明 |
|------|------|
| `clearSession(sessionId)` | 清除指定会话的记录 |
| `clearAll()` | 清除所有记录 |

## 使用示例

### 在 Mastra Agent 调用中使用

```typescript
// routes/game.ts
import { tokenTracker } from '../services/token-tracker';

const response = await primaryAgent.generate(fullMessage, {
  maxSteps: 5,
  modelSettings: { temperature: 0.7 },
});

tokenTracker.trackMastraAgent({
  sessionId: projectId,
  agentName: 'editor-chat',
  model: 'gpt-4o-mini',
  response,
  operation: 'editor-chat',
  metadata: { messageLength: fullMessage.length },
});
```

### 在 OpenAI SDK 调用中使用

```typescript
// services/game-generator.ts
import { tokenTracker } from './token-tracker';

const response = await this.openai.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [...],
});

tokenTracker.trackOpenAI({
  sessionId: projectId,
  model: 'gpt-4-turbo',
  response,
  operation: 'generate-from-setup',
});
```

## REST API 端点

TokenTracker 通过以下 API 端点暴露统计数据：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/game/token-stats` | GET | 获取全局统计 |
| `/api/game/token-stats/:sessionId` | GET | 获取会话统计 |
| `/api/game/token-stats/report` | GET | 获取格式化报告 |
| `/api/game/token-stats` | DELETE | 清除所有记录 |

## 日志输出

每次追踪都会输出日志：

```
[TokenTracker] 📊 mastra-agent/gpt-4o-mini/editor-chat: 7995 + 63 = 8058 tokens
[TokenTracker] 📊 openai-sdk/gpt-4-turbo: 2500 + 800 = 3300 tokens
```

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      TokenTracker                           │
├─────────────────────────────────────────────────────────────┤
│  records: Map<sessionId, TokenRecord[]>  ← 会话级记录       │
│  globalRecords: TokenRecord[]            ← 全局记录         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │trackMastra  │  │ trackOpenAI │  │   trackAnthropic    │ │
│  │   Agent()   │  │     ()      │  │         ()          │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         └────────────────┼─────────────────────┘            │
│                          ▼                                  │
│                    ┌──────────┐                             │
│                    │  track() │ ← 统一记录入口              │
│                    └────┬─────┘                             │
│                         │                                   │
│         ┌───────────────┼───────────────┐                   │
│         ▼               ▼               ▼                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ bySource   │  │  byModel   │  │     byAgent        │    │
│  └────────────┘  └────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 注意事项

1. **内存存储**: 当前实现使用内存存储，服务重启后数据丢失。生产环境建议持久化到数据库。

2. **单例模式**: `tokenTracker` 是全局单例，确保所有调用使用同一实例。

3. **响应格式兼容**: 不同 LLM SDK 的响应格式可能变化，`extractFrom*` 方法已处理常见变体。

4. **会话管理**: 建议在用户会话结束时调用 `clearSession()` 释放内存。

