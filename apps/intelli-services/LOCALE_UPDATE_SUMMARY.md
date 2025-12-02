# 多语言支持更新总结

## ✅ 已完成的工作

### 1. 创建语言工具函数
- `apps/intelli-services/src/utils/locale.ts`
  - `buildLocalePrompt()` - 构建语言提示
  - `addLocaleToSystemPrompt()` - 在system prompt中添加语言提示
  - `addLocaleToUserPrompt()` - 在user prompt中添加语言提示
  - `getLocaleFromRequest()` - 从请求中获取locale

### 2. 更新API路由
- `apps/intelli-services/src/routes/game.ts`
  - ✅ `generateSchema` 添加了 `locale` 字段
  - ✅ `generateByAgentsSchema` 添加了 `locale` 字段
  - ✅ 两个路由都获取locale并传递给服务层

### 3. 更新服务层
- `apps/intelli-services/src/services/game-generator.ts`
  - ✅ `generate()` 方法添加了 `locale` 参数
  - ✅ `generateFromSetup()` 方法添加了 `locale` 参数
  - ✅ 所有prompt都添加了语言提示

- `apps/intelli-services/src/services/game-generator-agent.ts`
  - ✅ `generateFromSetup()` 方法添加了 `locale` 参数
  - ✅ `generateFromSetupWithProgress()` 方法添加了 `locale` 参数
  - ✅ 所有prompt都添加了语言提示

### 4. 更新Agents
- `apps/intelli-services/src/agents/storyPlanner.ts`
  - ✅ `generateNarrativePlanWithToT()` 添加了 `locale` 参数
  - ✅ 所有prompt（generatePrompt, evaluatePrompt, expandPrompt）都添加了语言提示

### 5. 更新前端
- `apps/web/src/app/setup/summary/page.tsx`
  - ✅ 获取当前locale并传递给API

- `apps/web/src/app/api/generate/route.ts`
  - ✅ 获取locale并传递给后端服务

## 📝 需要手动完成的更新

以下文件需要按照相同模式添加locale支持：

### 1. `apps/intelli-services/src/agents/nodeWriter.ts`
```typescript
export async function writeNodeContent(
  agent: typeof nodeWriterAgent,
  input: {
    planNode: any;
    characterDB: any;
    styleGuide: any;
    previousNodeSummary?: string;
  },
  schema: any,
  locale: Locale = DEFAULT_LOCALE  // 添加这个参数
): Promise<any> {
  const { addLocaleToUserPrompt } = await import('../utils/locale');
  const prompt = addLocaleToUserPrompt(`## 当前要写的节点...`, locale);
  // ...
}
```

### 2. `apps/intelli-services/src/agents/storyReviewer.ts`
```typescript
export async function reviewStory(
  agent: typeof storyReviewerAgent,
  input: { ... },
  schema: any,
  locale: Locale = DEFAULT_LOCALE  // 添加这个参数
): Promise<any> {
  const { addLocaleToUserPrompt } = await import('../utils/locale');
  const reactPrompt = addLocaleToUserPrompt(`## 任务...`, locale);
  // ...
}
```

### 3. `apps/intelli-services/src/services/form-autocomplete.ts`
在 `buildSystemPrompt()` 和 `buildUserPrompt()` 方法中添加locale参数：
```typescript
private buildSystemPrompt(schema: FormSchema, context?: AutocompleteRequest['context'], locale: Locale = DEFAULT_LOCALE): string {
  let prompt = schema.systemPrompt;
  // ... 现有代码 ...
  return addLocaleToSystemPrompt(prompt, locale);
}

private buildUserPrompt(..., locale: Locale = DEFAULT_LOCALE): string {
  // ... 现有代码 ...
  return addLocaleToUserPrompt(prompt, locale);
}
```

然后在调用这些方法的地方传递locale参数。

### 4. `apps/intelli-services/src/workflows/storyGeneration.ts`
在workflow的各个步骤中添加locale参数，并在所有prompt中添加语言提示。

## 🔧 使用模式

所有LLM调用都应该遵循以下模式：

```typescript
import { addLocaleToSystemPrompt, addLocaleToUserPrompt, type Locale, DEFAULT_LOCALE } from '../utils/locale';

// 在方法签名中添加locale参数
async someMethod(..., locale: Locale = DEFAULT_LOCALE) {
  // 在system prompt中添加语言提示
  const systemPrompt = addLocaleToSystemPrompt(originalSystemPrompt, locale);
  
  // 在user prompt中添加语言提示
  const userPrompt = addLocaleToUserPrompt(originalUserPrompt, locale);
  
  // 调用LLM
  const response = await agent.generate(userPrompt, {
    systemPrompt, // 如果有system prompt
    // ...
  });
}
```

## 📌 注意事项

1. **默认值**: 所有locale参数都应该有默认值 `DEFAULT_LOCALE` ('zh-CN')
2. **向后兼容**: 确保不传locale时使用默认值，保持向后兼容
3. **语言提示格式**: 语言提示会自动添加到prompt末尾，格式为：
   ```
   重要提示：用户的语言是 {locale} ({localeName})，请使用 {localeName} 进行创作和回答。所有生成的内容（包括对话、旁白、描述等）都必须使用 {localeName}。
   ```

## ✅ 验证清单

- [x] API路由获取locale
- [x] game-generator.ts 添加语言提示
- [x] game-generator-agent.ts 添加语言提示
- [x] storyPlanner.ts 添加语言提示
- [ ] nodeWriter.ts 添加语言提示
- [ ] storyReviewer.ts 添加语言提示
- [ ] form-autocomplete.ts 添加语言提示
- [ ] workflows/storyGeneration.ts 添加语言提示
- [x] 前端API调用传递locale

