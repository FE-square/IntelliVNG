import { PromptTemplate } from '../types';

export const storyReviewerPrompts: Record<string, PromptTemplate> = {
  'story-reviewer.react': {
    user: `## 任务
你需要审阅以下故事草稿，使用工具收集信息，然后给出评估。

## 待审阅的节点草稿
{{drafts}}

## 原始故事规划
{{planOutline}}

## 角色档案（用于检查角色一致性）
{{characters}}

## 检查用的节点数据（传给工具）
{{nodesForValidation}}

---

## 请按以下步骤执行 ReAct 审阅：

### Step 1: 调用 validate-structure 工具
检查节点连通性，输入上面的 "检查用的节点数据"。

### Step 2: 调用 analyze-paths 工具  
分析路径多样性，输入上面的 "检查用的节点数据"。

### Step 3: 调用 analyze-dialogue-quality 工具
检查对话质量，输入上面的 "检查用的节点数据"。

### Step 4: 综合分析
基于三个工具的输出，写出你的分析报告，包括：
- 结构校验结果（是否有孤立节点、死胡同）
- 路径分析结果（有多少条路径、多样性如何）
- 对话质量结果（是否有过短或过长的节点）
- 你对每个评分维度的判断（plotCoherence, characterConsistency, dialogueQuality, branchMeaningfulness, pacing）
- 发现的问题列表
- 是否需要重新生成`,
    variables: ['drafts', 'planOutline', 'characters', 'nodesForValidation'],
  },

  'story-reviewer.format': {
    user: `## 任务
将以下审阅分析转换为结构化的 CriticReport 格式。

## 审阅分析
{{reactAnalysis}}

## 工具调用结果
{{toolResults}}

---

请根据上述分析，输出符合 CriticReport 格式的 JSON：

### scores 评分（0-100）
- plotCoherence: 情节连贯性
- characterConsistency: 角色一致性  
- dialogueQuality: 对话质量
- branchMeaningfulness: 分支有意义程度
- pacing: 节奏

### overallScore
五项评分的加权平均（plotCoherence 25%, characterConsistency 20%, dialogueQuality 20%, branchMeaningfulness 20%, pacing 15%）

### issues 问题列表
每个问题包含：
- type: "structure" | "logic" | "character" | "dialogue" | "branch"
- severity: "minor" | "major" | "critical"
- nodeIds: 相关节点ID数组
- description: 问题描述
- suggestion: 修改建议

### shouldRegenerate 判断
- 如果有 critical 问题 → true
- 如果 overallScore < 60 → true
- 如果 overallScore 60-70 且有 major 问题 → true
- 否则 → false

### regenerateTarget
- "all": 需要全部重写
- "specific_nodes": 只需重写特定节点
- "none": 不需要重写

### targetNodeIds
只在 regenerateTarget = "specific_nodes" 时填写`,
    variables: ['reactAnalysis', 'toolResults'],
  },
};

