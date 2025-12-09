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
- potentialEndings: 可能的结局类型列表（2-4 个）
- **earlyBranchingOpportunities**: 在故事前半段可以设置的分支点描述（至少2个）
  * 例如："第一幕结束时，玩家可以选择独自调查还是寻求帮助，这会导向完全不同的第二幕"
  * 例如："主角发现真相后，可以选择信任谁，不同信任对象会带来不同的信息和视角"

每个方向都必须考虑如何设计**真正的非线性叙事**，而不是"一条主线 + 结局分叉"。好的非线性叙事应该从故事早期就开始分化出不同的故事线。`,
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
基于选定的叙事方向，展开为完整的**非线性**故事节点骨架。

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

## 非线性叙事

真正的非线性叙事不是"一条主线 + 结局前分叉"，而是**从故事早期就开始分化的多条故事线**。

### Bad cases（伪非线性）
\`\`\`
start → scene1 → scene2 → scene3 → branch1 → [ending1, ending2, ending3]
                                     ↑ 只在结局前有一个分支
\`\`\`

### Good cases（真正的非线性）
\`\`\`
start → scene1 → branch1 → [选择A → scene2a → branch2 → [scene3a → ending1, scene3b → ending2]
                            选择B → scene2b → scene3c → branch3 → [ending2, ending3]]
          ↑ 第一幕就开始分支    ↑ 分支后的路线各自独立发展    ↑ 不同路线可能汇合到相同结局
\`\`\`

---

## 输出要求

请设计完整的节点骨架，包含：

### outline 部分
- premise: 故事前提
- centralConflict: 核心冲突  
- thematicArc: 主题弧线

### nodes 部分
设计 12-18 个节点，包含：

1. **START 节点** (唯一, isStart: true, type: "scene")
   - functionTag: "setup"
   - 建立世界观和主角

2. **发展节点** (SCENE 类型, 6-10 个)
   - functionTag: "rising" 或 "conflict" 或 "twist" 或 "climax" 或 "falling"
   - 通过 nextNodeId 连接
   - 不同分支路线尽量分配不同的 scene

3. **分支节点** (BRANCH 类型, **4-6 个**) 
   
   #### 分支分布要求
   - **第一幕分支** (1-2个): 在 setup 或 rising 阶段，影响故事走向
     * 例如：选择调查方向、选择信任谁、选择如何回应初始事件
   - **第二幕分支** (2-3个): 在 conflict 或 twist 阶段，决定角色关系和剧情发展
     * 例如：选择立场、选择是否揭露真相、选择帮助谁
   - **第三幕分支** (1个): 在 climax 阶段，决定最终结局（不强求，按照前序剧情合理性设计）
     * 例如：最终对决时的选择
   
   #### 分支类型设计（choicesMeta 中的 branchType 字段）：
   - **路线分支** (route): 选择导向完全不同的故事线，后续场景和遭遇不同
   - **关系分支** (relationship): 选择影响与特定角色的关系发展
   - **信息分支** (information): 选择决定玩家获得什么信息/视角
   - **结局分支** (ending): 选择直接决定走向哪个结局
   
   #### choicesMeta 结构：
   - id: 选项唯一ID
   - leadsTo: 目标节点ID
   - emotionalWeight: "轻松" | "沉重" | "痛苦抉择"
   - consequenceHint: 暗示后果（不剧透）
   - branchType: "route" | "relationship" | "information" | "ending"
   - impactDescription: 简述这个选择如何影响后续剧情

4. **结局节点** (ENDING 类型, 2-4 个, isEnding: true)
   - functionTag: "resolution"
   - 不同选择组合导向不同结局
   - ⚠️ 结局应该是多个分支路线的自然延续，而不是最后一个分支的简单分叉

---

## 故事结构示例

假设一个校园悬疑故事，正确的非线性结构应该是：

\`\`\`
[start: 发现异常]
       ↓
[branch-1: 选择调查方向] ← 第一幕分支 (route类型)
    ├→ [选择A: 独自调查] → scene-2a → branch-2 → ...
    └→ [选择B: 寻求帮助] → scene-2b → branch-3 → ...
                              ↓
                    [branch-3: 信任谁] ← 第二幕分支 (relationship类型)
                        ├→ [信任学姐] → scene-4a → ...
                        └→ [信任老师] → scene-4b → ...

不同路线有各自独立的场景和发展，最终汇聚到 2-4 个不同结局
\`\`\`

---

### 布局规则
- position: { x, y } 按从上到下、从左到右布局
- START 节点: x=400, y=50
- 每层 y += 150
- 分支横向展开: x 间隔 250

### 连通性检查
- 每个节点都能从 START 到达
- 每条路径最终都能到达某个 ENDING
- 非 ENDING 节点必须有 nextNodeId 或 choicesMeta
- **sceneName 必须从 worldBible.scenes 中选择场景的 name 字段**

### 场景选择规则
⚠️ **重要**: 每个节点的 sceneName 字段必须使用场景的 **name** 值(不是 id):

可用场景列表(来自 worldBible.scenes):
{{worldBible}}

例如:
- 如果场景是 { "id": "SC01", "name": "咖啡店", ... },则 sceneName 应该是 "咖啡店"
- 如果场景是 { "id": "SC02", "name": "学校教室", ... },则 sceneName 应该是 "学校教室"
- **绝对不要使用场景的 id (如 "SC01", "SC02"),必须使用 name 字段**`,
    variables: ['selectedPathName', 'selectedPathPremise', 'selectedPathConflict', 'selectedPathEndings', 'worldBible', 'characterDB', 'styleGuide', 'targetNodeCount', 'targetEndingCount'],
  },
};

