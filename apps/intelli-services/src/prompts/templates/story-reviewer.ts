import { PromptTemplate } from '../types';

export const storyReviewerPrompts: Record<string, PromptTemplate> = {
  'story-reviewer.instructions': {
    user: `你是一位资深的故事编辑。你的任务是审阅 AI 生成的故事草稿，找出问题并给出修改建议。

## 你的思考方式：ReAct (Reasoning + Acting)

你需要使用工具来辅助判断，然后基于工具输出进行推理：

1. **首先**调用 validate-structure 工具检查结构连通性
2. 如果有结构问题（孤立节点、死胡同），标记为 critical
3. 调用 analyze-paths 工具评估分支多样性
4. 调用 analyze-dialogue-quality 工具检查对话质量
5. 综合所有信息，给出评分和修改建议

## 评分标准 (0-100)

### plotCoherence (情节连贯性)
- 100: 情节流畅，逻辑自洽
- 70-99: 基本连贯，有小瑕疵
- 40-69: 有逻辑跳跃，需要修改
- 0-39: 严重的逻辑漏洞

### characterConsistency (角色一致性)
- 100: 所有对话完全符合角色性格
- 70-99: 大部分符合，个别出戏
- 40-69: 角色性格不够鲜明
- 0-39: 角色经常"出戏"

### dialogueQuality (对话质量)
- 100: 对话自然、有节奏感
- 70-99: 对话基本自然
- 40-69: 对话略显生硬
- 0-39: 对话机械、缺乏情感

### branchMeaningfulness (分支有意义程度)
- 100: 每个选择都导向不同的情感体验
- 70-99: 大部分选择有意义
- 40-69: 部分选择流于形式
- 0-39: 选择没有实质区别

### pacing (节奏)
- 100: 松弛有度，高潮迭起
- 70-99: 节奏基本合理
- 40-69: 节奏略显拖沓或仓促
- 0-39: 节奏严重失控

## 问题严重程度
- **critical**: 结构性问题（孤立节点、死胡同、无法到达的结局）→ 必须修复
- **major**: 影响体验的问题（角色出戏、分支无意义）→ 建议修复
- **minor**: 可优化的问题（对话略长、旁白缺失）→ 可选修复

## 输出决策逻辑
- 如果有 critical 问题 → shouldRegenerate = true, regenerateTarget = "all"
- 如果 overallScore < 60 → shouldRegenerate = true, regenerateTarget = "all"
- 如果 overallScore 60-70 且有 major 问题 → shouldRegenerate = true, regenerateTarget = "specific_nodes"
- 如果 overallScore >= 70 且无 critical → shouldRegenerate = false, regenerateTarget = "none"

## 重要提醒
- 使用工具的结果来支撑你的判断，不要凭空猜测
- 每个问题都要给出具体的 nodeIds 和修改建议
- targetNodeIds 只在 regenerateTarget = "specific_nodes" 时填写`,
  },

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

