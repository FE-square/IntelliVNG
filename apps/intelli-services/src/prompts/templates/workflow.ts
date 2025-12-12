import { PromptTemplate } from '../types';

export const workflowPrompts: Record<string, PromptTemplate> = {
  'workflow.planner-single-call': {
    user: `## 你的任务
设计一个非线性视觉小说的**故事结构骨架**（只规划结构，不写对话）。

## 世界观设定
{{worldBible}}

## 角色档案
{{characterDB}}

## 风格指南
{{styleGuide}}

## 约束条件
- 目标节点数: {{targetNodeCount}}
- 目标结局数: {{targetEndingCount}}

---

## 🌳 请使用 Tree-of-Thoughts (ToT) 方法进行设计

ToT 是一种结构化思维方法，你需要像下棋一样"向前看几步"，探索多种可能性后选择最优解。

### Step 1: 生成故事前提 (Premise)
首先，用一句话描述故事核心：
> "一个关于 [主角名字] 在 [世界背景] 中 [面对什么核心冲突] 的故事"

### Step 2: 分支思考 - 探索 2-3 条叙事路径
针对这个前提，思考 2-3 种不同的叙事方向。对每条路径进行评估：

| 路径 | 描述 | 戏剧性(1-5) | 角色契合度(1-5) | 分支潜力(1-5) | 总分 |
|------|------|------------|----------------|--------------|------|
| A    | ...  | ?          | ?              | ?            | ?    |
| B    | ...  | ?          | ?              | ?            | ?    |
| C    | ...  | ?          | ?              | ?            | ?    |

### Step 3: 选择最优路径
选择总分最高的路径，并简要说明选择理由。

### Step 4: 展开节点骨架
基于选定的路径，设计具体的节点结构：

1. **START 节点** (唯一，isStart: true)
   - functionTag: "setup"
   - 介绍主角和世界观

2. **发展节点** (SCENE 类型)
   - functionTag: "rising" → "conflict"
   - 矛盾逐渐升温

3. **分支节点** (BRANCH 类型，2-3 个)
   - functionTag: 通常是 "conflict" 或 "climax"
   - 每个选项必须有：
     * emotionalWeight: "轻松" | "沉重" | "痛苦抉择"
     * consequenceHint: 暗示后果（不剧透）
     * pathType: "通向好结局" | "通向坏结局" | "中立路线"

4. **结局节点** (ENDING 类型，2-3 个，isEnding: true)
   - functionTag: "resolution"
   - 不同选择导向不同结局

### Step 5: 验证连通性
- ✅ 每个节点都能从 START 到达
- ✅ 每条路径最终都能到达某个 ENDING
- ✅ 非 ENDING 节点必须有 nextNodeId 或 choicesMeta
- ✅ sceneName 都来自用户定义的场景列表

---

请按照上述步骤思考，然后输出符合 NarrativePlan 格式的 JSON。`,
    variables: ['worldBible', 'characterDB', 'styleGuide', 'targetNodeCount', 'targetEndingCount'],
  },

  'workflow.write-node': {
    user: `## 当前要写的节点
{{planNode}}

## 前序节点摘要
{{previousNodeSummary}}

## 角色档案
{{characters}}

## 风格指南
{{styleGuide}}

请为这个节点撰写对话和旁白。`,
    variables: ['planNode', 'previousNodeSummary', 'characters', 'styleGuide'],
  },

  'workflow.review': {
    user: `## 待审阅的节点草稿
{{drafts}}

## 原始故事规划
{{planOutline}}

## 角色档案
{{characters}}

---

请按照 ReAct 模式审阅这个故事：
1. 调用 validate-structure 检查结构
2. 调用 analyze-paths 分析路径多样性
3. 调用 analyze-dialogue-quality 检查对话质量
4. 基于工具输出，给出综合评分和修改建议

检查用的节点数据:
{{nodesForValidation}}`,
    variables: ['drafts', 'planOutline', 'characters', 'nodesForValidation'],
  },

  'workflow.review.mcp': {
    user: `## 待审阅的节点草稿
{{drafts}}

## 原始故事规划
{{planOutline}}

## 角色档案
{{characters}}

## 约束（可选）
{{constraints}}

---

请按照 ReAct 模式审阅这个故事（可使用更丰富的分析工具）：
1. 调用 validate-structure 检查结构
2. 调用 analyze-paths 分析路径多样性/非线性程度
3. 调用 analyze-dialogue-quality 检查对话质量
4. 调用 analyze-branch-distribution 检测“伪非线性”（分支是否集中在末尾）
5. （可选）如果提供了 constraints，调用 check-constraints-compliance 做约束合规检查
6. 调用 score-nonlinearity 得到 0-100 的综合非线性评分
7. 基于工具输出，给出综合评分和修改建议

检查用的节点数据:
{{nodesForValidation}}`,
    variables: ['drafts', 'planOutline', 'characters', 'constraints', 'nodesForValidation'],
  },

  'workflow.rewrite': {
    user: `## 原始草稿
{{originalDraft}}

## 审稿人的修改建议
{{suggestion}}

## 问题类型
{{issueType}} - {{issueDescription}}

## 角色档案
{{characters}}

## 风格指南
{{styleGuide}}

请根据审稿人的修改建议重写这个节点，保持 id、type、sceneName、nextNodeId/choices 结构不变。`,
    variables: ['originalDraft', 'suggestion', 'issueType', 'issueDescription', 'characters', 'styleGuide'],
  },
};

