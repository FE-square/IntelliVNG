import { PromptTemplate } from '../types';

export const storyPlannerPrompts: Record<string, PromptTemplate> = {
  'story-planner.instructions': {
    user: `你是一位专业的非线性叙事设计师。你善于设计复杂的、有分支的故事结构。

## 关键原则
- 故事骨架只包含结构和元信息，不包含具体对话
- 所有节点必须相互连通，从 START 可达所有节点，所有路径最终到达 ENDING
- 分支选择必须有"剧情重量"，让玩家感受到选择对故事走向的影响`,
  },

  'story-planner.generate-candidates': {
    user: `## 任务
基于以下设定，生成 3 个不同的叙事方向（候选方案）。

## 世界观设定
{{worldBible}}

## 角色档案
{{characterDB}}

## 风格指南
{{styleGuide}}

---

请生成 3 个风格不同的叙事方向，每个方向包含：
- id: 唯一标识 (path-1, path-2, path-3)
- name: 方向名称（如"冲突型"、"成长型"、"悬疑型"）
- description: 一句话描述这个方向的特点
- premise: 故事前提（"一个关于...的故事"）
- centralConflict: 核心冲突
- potentialEndings: 可能的结局类型列表（2-3 个）`,
    variables: ['worldBible', 'characterDB', 'styleGuide'],
  },

  'story-planner.evaluate': {
    user: `## 任务
评估以下 {{candidateCount}} 个叙事方向，为每个方向打分并选择最佳方向。

## 候选方向
{{candidates}}

## 原始设定
- 角色数量: {{characterCount}}
- 场景数量: {{sceneCount}}
- 风格: {{styles}}
- 基调: {{tone}}

## 评分维度（每项 1-5 分）
1. **dramatic** (戏剧性): 冲突是否激烈、情节是否跌宕起伏
2. **characterFit** (角色契合度): 是否能充分发挥每个角色的特点
3. **branchPotential** (分支潜力): 是否容易设计有意义的分支选择
4. **thematicDepth** (主题深度): 主题是否有深度、能引发思考

---

请：
1. 为每个方向打分并给出理由
2. 计算总分 (totalScore = dramatic + characterFit + branchPotential + thematicDepth)
3. 选择总分最高的方向，并解释选择理由`,
    variables: ['candidateCount', 'candidates', 'characterCount', 'sceneCount', 'styles', 'tone'],
  },

  'story-planner.expand': {
    user: `## 任务
基于选定的叙事方向，展开为完整的故事节点骨架。

## 选定的叙事方向
- 名称: {{selectedPathName}}
- 前提: {{selectedPathPremise}}
- 核心冲突: {{selectedPathConflict}}
- 可能的结局: {{selectedPathEndings}}

## 原始设定
### 世界观
{{worldBible}}

### 角色
{{characterDB}}

### 风格
{{styleGuide}}

## 约束条件
- 目标节点数: {{targetNodeCount}}
- 目标结局数: {{targetEndingCount}}

---

## 输出要求

请设计完整的节点骨架，包含：

### outline 部分
- premise: 故事前提
- centralConflict: 核心冲突  
- thematicArc: 主题弧线

### nodes 部分
设计 10-15 个节点，包含：

1. **START 节点** (唯一, isStart: true, type: "scene")
   - functionTag: "setup"
   - 建立世界观和主角

2. **发展节点** (SCENE 类型, 5-8 个)
   - functionTag: "rising" 或 "conflict" 或 "twist" 或 "climax" 或 "falling"
   - 通过 nextNodeId 连接

3. **分支节点** (BRANCH 类型, 2-3 个)
   - functionTag: 通常是 "conflict" 或 "climax"
   - choicesMeta 包含 2-3 个选项，每个选项有：
     * id: 选项唯一ID
     * leadsTo: 目标节点ID
     * emotionalWeight: "轻松" | "沉重" | "痛苦抉择"
     * consequenceHint: 暗示后果（不剧透）
     * pathType: "通向好结局" | "通向坏结局" | "中立路线"

4. **结局节点** (ENDING 类型, 2-3 个, isEnding: true)
   - functionTag: "resolution"
   - 不同选择导向不同结局

### 布局规则
- position: { x, y } 按从上到下、从左到右布局
- START 节点: x=400, y=50
- 每层 y += 150
- 分支横向展开: x 间隔 250

### 连通性检查
- 每个节点都能从 START 到达
- 每条路径最终都能到达某个 ENDING
- 非 ENDING 节点必须有 nextNodeId 或 choicesMeta
- sceneName 都来自用户定义的场景列表`,
    variables: ['selectedPathName', 'selectedPathPremise', 'selectedPathConflict', 'selectedPathEndings', 'worldBible', 'characterDB', 'styleGuide', 'targetNodeCount', 'targetEndingCount'],
  },
};

