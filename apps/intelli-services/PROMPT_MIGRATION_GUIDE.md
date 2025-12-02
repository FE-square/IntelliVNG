# Prompt统一管理迁移指南

## 已完成的工作

✅ **所有LLM调用已添加语言支持**
- 所有prompt都自动添加语言提示
- locale参数已传递到所有服务层和agents

✅ **创建了统一的Prompt管理系统**
- `apps/intelli-services/src/prompts/index.ts` - Prompt管理器
- 支持模板变量替换
- 自动添加语言提示

## 当前状态

### 已迁移到PromptManager
- ✅ `game-generator.ts` - 部分迁移（setup prompt已迁移）

### 仍使用分散的prompt（需要逐步迁移）
- ⚠️ `game-generator.ts` - generate方法中的idea prompt
- ⚠️ `agents/storyPlanner.ts` - 所有prompt
- ⚠️ `agents/nodeWriter.ts` - write prompt
- ⚠️ `agents/storyReviewer.ts` - react和format prompt
- ⚠️ `workflows/storyGeneration.ts` - 所有prompt
- ⚠️ `services/form-autocomplete.ts` - system和user prompt

## 迁移步骤

### 1. 将prompt提取到模板

**示例：迁移 storyPlanner 的 generatePrompt**

**之前（agents/storyPlanner.ts）：**
```typescript
const generatePrompt = `## 任务
基于以下设定，生成 3 个不同的叙事方向（候选方案）。

## 世界观设定
${JSON.stringify(input.worldBible, null, 2)}
...`;
```

**之后（prompts/index.ts）：**
```typescript
promptManager.register('story-planner.generate-candidates', {
  user: `## 任务
基于以下设定，生成 3 个不同的叙事方向（候选方案）。

## 世界观设定
{{worldBible}}

## 角色档案
{{characterDB}}
...`,
  variables: ['worldBible', 'characterDB', 'styleGuide'],
});
```

**更新调用代码（agents/storyPlanner.ts）：**
```typescript
import { promptManager } from '../prompts';

// 替换原来的prompt构建
const { user } = promptManager.build('story-planner.generate-candidates', {
  worldBible: JSON.stringify(input.worldBible, null, 2),
  characterDB: JSON.stringify(input.characterDB, null, 2),
  styleGuide: JSON.stringify(input.styleGuide || {}, null, 2),
}, locale);
```

### 2. 处理复杂逻辑

如果prompt构建包含复杂逻辑（如条件判断），可以：

**方案A：在调用代码中处理**
```typescript
const params: Record<string, any> = {
  // 基础参数
};

// 添加条件参数
if (someCondition) {
  params.extraInfo = '...';
}

const { user } = promptManager.build('prompt-name', params, locale);
```

**方案B：创建多个模板**
```typescript
promptManager.register('prompt-name.simple', { ... });
promptManager.register('prompt-name.with-extra', { ... });
```

## 迁移优先级

### 高优先级（使用频繁）
1. `story-planner.generate-candidates` - 故事规划候选生成
2. `story-planner.expand` - 节点骨架展开
3. `node-writer.write` - 节点写作

### 中优先级
4. `story-reviewer.react` - 审阅循环
5. `story-reviewer.format` - 格式化报告

### 低优先级（可以保持现状）
6. `form-autocomplete` - 表单自动补全（prompt相对简单）

## 优势总结

### 统一管理的优势
1. **集中维护**：所有prompt在一个地方，便于更新和优化
2. **版本控制**：可以轻松创建prompt的不同版本进行A/B测试
3. **自动语言支持**：所有prompt自动添加语言提示
4. **类型安全**：可以定义prompt变量的类型
5. **文档化**：prompt模板本身就是文档

### 当前混合模式
- 新代码使用PromptManager
- 旧代码保持现状（但已添加语言支持）
- 逐步迁移，不破坏现有功能

## 下一步建议

1. **逐步迁移**：按优先级逐个迁移prompt
2. **保持兼容**：迁移时确保功能不变
3. **测试验证**：每次迁移后测试生成质量
4. **文档更新**：更新prompt时同步更新文档

