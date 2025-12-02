# 多语言支持与Prompt管理

本文档详细说明了 IntelliVNG 服务端的多语言支持机制（Locale Mechanism）和统一 Prompt 管理系统（Prompt Manager System）的设计与实现。这两个系统协同工作，确保所有 AI 生成内容都能准确响应用户的语言偏好，同时保持 Prompt 的可维护性和扩展性。

## 1. 多语言支持机制 (Locale Mechanism)

### 1.1 核心设计理念

多语言支持的核心理念是 **"透明注入"（Transparent Injection）**。业务逻辑无需关心具体的语言提示词构建细节，只需将用户的语言偏好（Locale）作为参数传递。系统会自动在 Prompt 的末尾追加标准化的语言指令，强制 LLM 使用指定语言进行输出。

### 1.2 核心组件 (`utils/locale.ts`)

位于 `apps/intelli-services/src/utils/locale.ts` 的工具库提供了以下核心功能：

#### 类型定义
```typescript
export type Locale = 'zh-CN' | 'zh-HK' | 'en-US';
export const DEFAULT_LOCALE: Locale = 'zh-CN';
```

#### 语言指令构建 (`buildLocalePrompt`)
生成标准化的语言提示词片段。该片段会被追加到 System Prompt 或 User Prompt 的末尾。

**生成的指令格式：**
> 重要提示：用户的语言是 {locale} ({localeName})，请使用 {localeName} 进行创作和回答。所有生成的内容（包括对话、旁白、描述等）都必须使用 {localeName}。

#### 注入函数
- **`addLocaleToSystemPrompt(prompt, locale)`**: 将语言指令追加到 System Prompt。
- **`addLocaleToUserPrompt(prompt, locale)`**: 将语言指令追加到 User Prompt。

#### 参数获取
- **`getLocaleFromRequest(param)`**: 用于 API 层，安全地从请求参数中提取 Locale，若无效则回退到默认值。

### 1.3 数据流

1.  **API 层**: 接收 HTTP 请求，解析 `locale` 参数。
2.  **Service/Workflow 层**: 接收 `locale` 参数，并在调用 Agent 或底层 LLM 服务时透传该参数。
3.  **Prompt 构建层**: 在构建最终发送给 LLM 的 Prompt 字符串时，调用 `addLocaleTo*Prompt` 函数注入语言指令。

---

## 2. 统一 Prompt 管理系统 (Prompt Manager System)

### 2.1 核心设计理念

Prompt 管理系统旨在解决 Prompt 分散、硬编码和缺乏版本控制的问题。它采用了 **"模板化管理"** 的策略，将 Prompt 视为带有变量的模板，统一注册、解析和构建。

### 2.2 核心组件 (`prompts/index.ts`)

#### PromptTemplate 结构
每个 Prompt 被定义为一个模板对象：
```typescript
interface PromptTemplate {
  system?: string;      // 可选的 System Prompt 模板
  user: string;         // User Prompt 模板
  variables: string[];  // 模板中使用的变量名列表
}
```

#### PromptManager 类
核心管理类，提供以下功能：

1.  **注册 (`register`)**: 将模板存储在内存 Map 中。
2.  **变量替换 (`replaceVariables`)**: 
    - 使用 `{{variable}}` 语法。
    - 自动处理对象类型：若变量值为对象，自动调用 `JSON.stringify(value, null, 2)` 转换为格式化的 JSON 字符串。
    - 字符串类型直接替换。
3.  **构建 (`build`)**: 
    - 接收 `templateName`、`variables` 对象和 `locale`。
    - 执行变量替换。
    - **自动调用 Locale 工具注入语言指令**。
    - 返回最终可用的 `{ system, user }` 字符串对。

### 2.3 使用模式

#### 定义模板
在 `apps/intelli-services/src/prompts/templates/` 目录下按模块定义模板：

```typescript
// 示例模板定义
export const myPrompts = {
  'story.generate': {
    system: '你是一个小说家...',
    user: '请根据以下设定写一段故事：\n{{setting}}',
    variables: ['setting']
  }
};
```

#### 注册模板
系统启动时会自动加载并注册所有模板：
```typescript
// prompts/index.ts
registerAllPrompts(); // 自动执行
```

#### 调用构建
在业务逻辑中，通过 `promptManager` 获取最终 Prompt：

```typescript
import { promptManager } from '../prompts';

const { system, user } = promptManager.build(
  'story.generate',     // 模板名称
  { setting: context }, // 变量数据
  locale                // 用户语言 (自动注入语言提示)
);
```

### 2.4 系统优势

1.  **集中化**: 所有 Prompt 集中管理，便于审查和修改。
2.  **自动化**: 语言支持自动注入，无需手动拼接字符串，防止遗漏。
3.  **类型友好**: 清晰的变量定义，配合 TypeScript 可增强开发体验。
4.  **数据处理**: 内置的对象 JSON 序列化逻辑，简化了调用端的代码。

