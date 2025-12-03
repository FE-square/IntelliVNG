# Prompt管理系统

## 概述

统一的Prompt管理系统将所有LLM调用的prompt集中管理，提供以下优势：

1. **统一语言支持**：自动为所有prompt添加语言提示
2. **版本控制**：便于跟踪和更新prompt
3. **A/B测试**：可以轻松测试不同版本的prompt
4. **统一格式**：确保所有prompt遵循相同的风格和结构
5. **易于维护**：所有prompt集中在一个地方，便于修改和优化

## 使用方法

### 基本用法

```typescript
import { promptManager } from '../prompts';
import { type Locale } from '../utils/locale';

// 构建prompt（自动添加语言提示）
const { system, user } = promptManager.build(
  'game-generator.setup',
  {
    charactersInfo: '...',
    backgroundsInfo: '...',
  },
  'zh-CN' // locale参数
);

// 调用LLM
const response = await openai.chat.completions.create({
  model: 'gpt-5',
  messages: [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: user },
  ],
});
```

### 模板变量

Prompt模板支持 `{{variableName}}` 格式的变量：

```typescript
// 模板定义
promptManager.register('example', {
  user: `角色信息：{{characters}}
场景信息：{{scenes}}`,
  variables: ['characters', 'scenes'],
});

// 使用
const { user } = promptManager.build('example', {
  characters: JSON.stringify(characters, null, 2),
  scenes: JSON.stringify(scenes, null, 2),
}, 'zh-CN');
```

### 注册新Prompt

```typescript
import { promptManager } from '../prompts';

promptManager.register('my-custom-prompt', {
  system: 'You are a helpful assistant.', // 可选
  user: `## 任务
完成以下任务：{{task}}

## 上下文
{{context}}`,
  variables: ['task', 'context'],
});
```

## 已注册的Prompt模板

### Game Generator
- `game-generator.director-system` - 游戏生成器的系统prompt
- `game-generator.setup` - 基于角色和场景设定的用户prompt

### Story Planner
- `story-planner.generate-candidates` - 生成候选叙事方向
- `story-planner.evaluate` - 评估候选方向
- `story-planner.expand` - 展开为完整节点骨架

### Node Writer
- `node-writer.write` - 为节点撰写对话
- `node-writer.rewrite` - 重写节点

### Story Reviewer
- `story-reviewer.react` - ReAct审阅循环
- `story-reviewer.format` - 格式化审阅报告

## 迁移指南

### 从分散的prompt迁移到统一管理

**之前：**
```typescript
const prompt = `## 任务
${JSON.stringify(data, null, 2)}`;
const finalPrompt = addLocaleToUserPrompt(prompt, locale);
```

**之后：**
```typescript
const { user } = promptManager.build('my-prompt', {
  data: JSON.stringify(data, null, 2),
}, locale);
```

### 迁移步骤

1. **提取prompt到模板**
   - 将硬编码的prompt字符串提取到 `prompts/index.ts`
   - 使用 `{{variable}}` 替换动态内容

2. **注册模板**
   ```typescript
   promptManager.register('prompt-name', {
     system: '...', // 可选
     user: '...',
     variables: ['var1', 'var2'],
   });
   ```

3. **更新调用代码**
   - 使用 `promptManager.build()` 替换原来的prompt构建逻辑
   - 传递变量和locale参数

## 最佳实践

1. **命名规范**：使用 `模块.功能` 格式，如 `story-planner.generate`
2. **变量验证**：在 `variables` 数组中列出所有变量，便于检查
3. **文档化**：在prompt模板中添加注释说明用途
4. **版本控制**：重大prompt更新时，考虑创建新版本（如 `story-planner.generate-v2`）

## 未来扩展

- [ ] Prompt版本管理
- [ ] Prompt性能监控
- [ ] Prompt A/B测试框架
- [ ] Prompt模板继承和组合
- [ ] 多语言prompt模板（不同语言使用不同的基础模板）

