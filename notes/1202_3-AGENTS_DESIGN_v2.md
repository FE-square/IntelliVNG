# IntelliVNG 多智能体剧本创作系统设计 (Opus)

> **目标**：用 3 个 Agent + 1 个 Orchestrator 实现"规划 → 写作 → 审稿"的非线性故事创作闭环

## 一、总体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR (状态机)                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                      │
│  │   PLANNING  │───►│   WRITING   │───►│  REVIEWING  │──┐                   │
│  │    阶段     │    │    阶段     │    │    阶段     │  │                   │
│  └─────────────┘    └─────────────┘    └─────────────┘  │                   │
│         ▲                                    │          │                   │
│         └────────────────────────────────────┘          │                   │
│                    (需要重写时回退)                       │                   │
│                                                          ▼                   │
│                                              ┌─────────────┐                │
│                                              │   OUTPUT    │                │
│                                              │ GameProject │                │
│                                              └─────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          SHARED CONTEXT (共享上下文)                          │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  WorldBible  │  │ CharacterDB  │  │  StyleGuide  │  │  NodeDrafts  │    │
│  │  (世界观)     │  │  (角色档案)   │  │  (风格指南)   │  │  (节点草稿)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 二、技术模式映射（Hackathon 可讲点）

| Agent | 角色 | 采用的技术模式 | 可讲点 |
|-------|------|---------------|--------|
| **Story Planner** | 故事规划师 | **Tree-of-Thoughts (ToT)** + JSON Schema Enforcement | 结构化推理、多路径探索 |
| **Node Writer** | 节点写作师 | **Few-Shot CoT** + 并行生成 | 上下文学习、高效并发 |
| **Story Reviewer** | 故事审稿人 | **ReAct (Reasoning + Acting)** | 工具增强推理、可解释性 |
| **Orchestrator** | 流程控制器 | **Plan-and-Execute** + 状态机 | 流程编排、自适应重试 |

## 三、Shared Context 设计

### 3.1 数据来源映射

```typescript
// 从用户 Setup 流程映射到 Shared Context
interface SharedContext {
  // 来源: worldSetting + scenes
  worldBible: {
    name: string;           // worldSetting.name
    era: string;            // worldSetting.era
    location: string;       // worldSetting.location
    rules: string;          // worldSetting.rules
    scenes: Scene[];        // scenes[] 直接复用
  };
  
  // 来源: characters[]
  characterDB: {
    characters: Character[];
    relationshipGraph: Map<string, string[]>; // 角色关系图（可选扩展）
  };
  
  // 来源: themeSetting
  styleGuide: {
    themes: string[];       // themeSetting.themes
    styles: string[];       // themeSetting.styles
    tone: string;           // themeSetting.tone
  };
  
  // 运行时生成
  narrativePlan: NarrativePlan | null;
  nodeDrafts: Map<string, NodeDraft>;
  criticReports: CriticReport[];
}
```

### 3.2 上下文传递策略

由于 LLM 上下文窗口有限，采用**分层压缩**策略：

| 层级 | 内容 | 传递方式 |
|------|------|---------|
| L1: 核心设定 | WorldBible 摘要 + 角色简表 | 每次调用都包含（~500 tokens） |
| L2: 当前任务 | 当前节点的 PlanNode + 前序节点摘要 | 按需包含（~300 tokens） |
| L3: 详细档案 | 完整角色档案、场景细节 | 仅相关时包含（~200 tokens/角色） |

## 四、Agent A: Story Planner（故事规划师）

### 4.1 职责

- 根据用户设定，生成**非线性故事骨架**（NarrativePlan）
- 只规划结构和节点元信息，**不生成具体对话**

### 4.2 技术实现：Tree-of-Thoughts (ToT)

```
                        ┌─────────────────┐
                        │   用户设定输入   │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │ Step 1: 生成前提 │
                        │ (Premise)        │
                        └────────┬────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────▼────────┐ ┌──────▼──────┐ ┌────────▼────────┐
     │ 路径A: 冲突型    │ │ 路径B: 成长型 │ │ 路径C: 反转型    │
     └────────┬────────┘ └──────┬──────┘ └────────┬────────┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 │
                        ┌────────▼────────┐
                        │ Step 2: 评估并选择│
                        │ 最佳叙事路径      │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │ Step 3: 展开为   │
                        │ 完整节点骨架      │
                        └─────────────────┘
```

### 4.3 输入/输出接口

```typescript
// === 输入 ===
interface PlannerInput {
  worldBible: WorldBible;
  characterDB: CharacterDB;
  styleGuide: StyleGuide;
  constraints: {
    targetNodeCount: number;    // 目标节点数（10-15）
    targetEndingCount: number;  // 目标结局数（2-3）
    complexity: 'simple' | 'medium';
  };
}

// === 输出 ===
interface NarrativePlan {
  // 故事大纲
  outline: {
    premise: string;           // 前提："一个关于...的故事"
    centralConflict: string;   // 核心冲突
    thematicArc: string;       // 主题弧线
  };
  
  // 节点骨架列表
  nodes: PlanNode[];
}

interface PlanNode {
  id: string;
  type: 'scene' | 'branch' | 'ending';
  isStart?: boolean;
  isEnding?: boolean;
  
  // 元信息（不是具体内容）
  title: string;
  brief: string;               // 一句话摘要
  functionTag: FunctionTag;    // 叙事功能标签
  sceneName: string;           // 绑定用户定义的场景
  
  // 连接信息
  nextNodeId?: string;         // 线性连接
  choicesMeta?: ChoiceMeta[];  // 分支元信息
  
  // 布局
  position: { x: number; y: number };
}

type FunctionTag = 'setup' | 'rising' | 'conflict' | 'twist' | 'climax' | 'falling' | 'resolution';

interface ChoiceMeta {
  id: string;
  leadsTo: string;             // targetNodeId
  emotionalWeight: string;     // "轻松" | "沉重" | "痛苦抉择"
  consequenceHint: string;     // 后果暗示（不剧透）
  pathType: string;            // "通向好结局" | "通向坏结局" | "中立路线"
}
```

### 4.4 Prompt 结构

```markdown
## System Prompt (Story Planner)

你是一位专业的非线性叙事设计师。你的任务是设计故事的**结构骨架**，不是写具体对话。

### 输入信息
[世界观摘要]
[角色简表]
[风格指南]
[约束: 节点数/结局数/复杂度]

### 输出要求
请按以下步骤思考并输出 JSON：

**Step 1: 故事前提**
- 用一句话描述故事核心："一个关于[主角]在[世界]中[面对什么冲突]的故事"
- 列出 2-3 个可能的叙事方向

**Step 2: 选择最佳方向**
- 评估每个方向的：戏剧性、与角色的契合度、分支潜力
- 选择得分最高的方向

**Step 3: 展开节点骨架**
- 设计 START 节点（必须唯一）
- 设计 2-3 个 BRANCH 节点（分支点）
- 设计 2-3 个 ENDING 节点
- 用 SCENE 节点连接它们

**Step 4: 输出 JSON**
输出符合 NarrativePlan 接口的 JSON，确保：
- 每个节点有 functionTag 标注其叙事功能
- 每个分支有 choicesMeta 描述选择的情感重量
```

### 4.5 快速结构校验（TS 工具）

Planner 输出后，Orchestrator 立即运行轻量校验：

```typescript
function quickValidatePlan(plan: NarrativePlan): ValidationResult {
  const errors: string[] = [];
  
  // 1. 检查 START 节点
  const startNodes = plan.nodes.filter(n => n.isStart);
  if (startNodes.length !== 1) {
    errors.push(`需要恰好 1 个 START 节点，当前有 ${startNodes.length} 个`);
  }
  
  // 2. 检查 ENDING 节点数量
  const endingNodes = plan.nodes.filter(n => n.isEnding);
  if (endingNodes.length < 2) {
    errors.push(`需要至少 2 个 ENDING 节点，当前有 ${endingNodes.length} 个`);
  }
  
  // 3. 检查 BRANCH 节点
  const branchNodes = plan.nodes.filter(n => n.type === 'branch');
  if (branchNodes.length < 1) {
    errors.push(`需要至少 1 个 BRANCH 节点（分支点）`);
  }
  
  // 4. 检查所有 nextNodeId 和 choicesMeta.leadsTo 指向有效节点
  const nodeIds = new Set(plan.nodes.map(n => n.id));
  plan.nodes.forEach(node => {
    if (node.nextNodeId && !nodeIds.has(node.nextNodeId)) {
      errors.push(`节点 ${node.id} 的 nextNodeId "${node.nextNodeId}" 不存在`);
    }
    node.choicesMeta?.forEach(choice => {
      if (!nodeIds.has(choice.leadsTo)) {
        errors.push(`节点 ${node.id} 的选项指向不存在的节点 "${choice.leadsTo}"`);
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
```

## 五、Agent B: Node Writer（节点写作师）

### 5.1 职责

- 根据 `PlanNode` 生成具体的对话、旁白、选项文案
- 每个节点单独生成，支持并行调用

### 5.2 技术实现：Few-Shot CoT + 并行生成

#### 并行策略：拓扑分层

```
        ┌───────────────┐
        │    START      │  ← Layer 0 (先生成)
        └───────┬───────┘
                │
        ┌───────▼───────┐
        │   Scene 1     │  ← Layer 1
        └───────┬───────┘
                │
        ┌───────▼───────┐
        │   Branch 1    │  ← Layer 2
        └───┬───────┬───┘
            │       │
    ┌───────▼───┐ ┌─▼───────┐
    │  Scene 2A │ │ Scene 2B│  ← Layer 3 (可并行)
    └───────┬───┘ └─┬───────┘
            │       │
    ┌───────▼───┐ ┌─▼───────┐
    │ Ending A  │ │ Ending B│  ← Layer 4 (可并行)
    └───────────┘ └─────────┘
```

**实现策略**：
1. 对 `NarrativePlan.nodes` 进行拓扑排序，按"层"分组
2. 同一层的节点可以并行调用 LLM
3. 每个节点调用时，携带**前序节点摘要**（而非完整内容）保证连贯性

### 5.3 输入/输出接口

```typescript
// === 输入 ===
interface WriterInput {
  planNode: PlanNode;                    // 当前要写的节点
  worldBible: WorldBible;                // L1 上下文
  relevantCharacters: Character[];       // 只包含本节点涉及的角色
  styleGuide: StyleGuide;                // 风格指南
  previousNodeSummary?: string;          // 前序节点的一句话摘要
}

// === 输出 ===
interface NodeDraft {
  id: string;                            // 与 planNode.id 对齐
  type: 'scene' | 'branch' | 'ending';
  title: string;
  sceneName: string;
  
  // 内容
  narration?: string;                    // 旁白
  dialogues: DialogueDraft[];            // 对话列表
  
  // 分支选项（仅 branch 类型）
  choices?: ChoiceDraft[];
  
  // 线性连接（仅 scene 类型）
  nextNodeId?: string;
  
  // 生成的摘要（供后续节点使用）
  summary: string;
}

interface DialogueDraft {
  characterName: string;                 // 使用角色名，稍后映射为 ID
  text: string;
  emotion?: string;
}

interface ChoiceDraft {
  id: string;
  text: string;                          // 玩家看到的选项文案
  targetNodeId: string;
  meta: {
    emotionalWeight: string;             // 从 PlanNode.choicesMeta 继承
    consequenceHint: string;
  };
}
```

### 5.4 Prompt 结构

```markdown
## System Prompt (Node Writer)

你是一位专业的视觉小说编剧。你的任务是为单个故事节点撰写对话和旁白。

### 写作原则
1. 对话要体现角色性格（参考角色档案）
2. 每个节点 3-6 段对话，节奏紧凑
3. 分支选项要有"情感重量"差异，让玩家感受到选择的意义
4. 保持与前序节点的连贯性

### Few-Shot 示例

**示例输入**:
节点: { id: "branch-1", type: "branch", title: "命运的十字路口", functionTag: "conflict" }
前序摘要: "主角在学校花园与女主角相遇，两人因误会发生争执。"

**示例输出**:
{
  "narration": "夕阳将教室染成橘红色，空气中弥漫着紧张的气息。",
  "dialogues": [
    { "characterName": "小明", "text": "我...我不是故意的...", "emotion": "embarrassed" },
    { "characterName": "小红", "text": "你每次都这样说！", "emotion": "angry" }
  ],
  "choices": [
    { 
      "text": "真诚道歉", 
      "targetNodeId": "scene-2a",
      "meta": { "emotionalWeight": "温暖", "consequenceHint": "也许她会原谅你" }
    },
    { 
      "text": "保持沉默，转身离开",
      "targetNodeId": "scene-2b", 
      "meta": { "emotionalWeight": "沉重", "consequenceHint": "有些话，错过就再也说不出口" }
    }
  ],
  "summary": "主角在误会升级后面临选择：道歉或逃避。"
}
```

## 六、Agent C: Story Reviewer（故事审稿人）

### 6.1 职责

- 评估整体叙事质量
- 检查连续性和逻辑漏洞
- 给出具体的修改建议

### 6.2 技术实现：ReAct (Reasoning + Acting)

Reviewer 可以调用**TS 工具**来辅助判断，实现"工具增强推理"：

```
┌─────────────────────────────────────────────────────────────┐
│                    ReAct 循环                               │
│                                                             │
│  Thought: "让我先检查节点连通性..."                          │
│      │                                                      │
│      ▼                                                      │
│  Action: call validateNodeConnections(nodes)                │
│      │                                                      │
│      ▼                                                      │
│  Observation: "发现 2 个孤立节点: scene-3, ending-2"         │
│      │                                                      │
│      ▼                                                      │
│  Thought: "这是结构性问题，需要标记为 critical..."           │
│      │                                                      │
│      ▼                                                      │
│  Action: call analyzePathDiversity(nodes)                   │
│      │                                                      │
│      ▼                                                      │
│  Observation: "3 条路径，但 2 条几乎相同..."                 │
│      │                                                      │
│      ▼                                                      │
│  Thought: "分支不够有意义，需要重写分支节点..."              │
│      │                                                      │
│      ▼                                                      │
│  Final Answer: CriticReport                                 │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 可用工具列表

```typescript
// 工具 1: 结构校验（复用现有代码）
function validateNodeConnections(nodes: NodeDraft[]): {
  hasOrphans: boolean;
  orphanIds: string[];
  hasDeadEnds: boolean;
  deadEndIds: string[];
  invalidLinks: string[];
}

// 工具 2: 路径分析
function analyzePathDiversity(nodes: NodeDraft[]): {
  totalPaths: number;
  pathDescriptions: string[];  // 每条路径的简要描述
  diversityScore: number;      // 0-1，衡量路径差异性
}

// 工具 3: 角色一致性检查
function checkCharacterConsistency(
  nodes: NodeDraft[], 
  characterDB: CharacterDB
): {
  oocInstances: Array<{
    nodeId: string;
    characterName: string;
    issue: string;
  }>;
}

// 工具 4: 对话质量分析
function analyzeDialogueQuality(nodes: NodeDraft[]): {
  avgDialoguesPerNode: number;
  shortNodes: string[];        // 对话过少的节点
  longNodes: string[];         // 对话过多的节点
}
```

### 6.4 输入/输出接口

```typescript
// === 输入 ===
interface ReviewerInput {
  nodeDrafts: NodeDraft[];
  narrativePlan: NarrativePlan;
  worldBible: WorldBible;
  characterDB: CharacterDB;
  // 来自 TS 工具的结构报告（预先生成，传给 LLM）
  structureReport: {
    validation: ReturnType<typeof validateNodeConnections>;
    pathAnalysis: ReturnType<typeof analyzePathDiversity>;
    characterCheck: ReturnType<typeof checkCharacterConsistency>;
    dialogueQuality: ReturnType<typeof analyzeDialogueQuality>;
  };
}

// === 输出 ===
interface CriticReport {
  // 评分（0-100）
  scores: {
    plotCoherence: number;       // 情节连贯性
    characterConsistency: number; // 角色一致性
    dialogueQuality: number;     // 对话质量
    branchMeaningfulness: number; // 分支有意义程度
    pacing: number;              // 节奏
  };
  overallScore: number;
  
  // 问题列表
  issues: Issue[];
  
  // 重写建议
  shouldRegenerate: boolean;
  regenerateTarget: 'none' | 'specific_nodes' | 'all';
  targetNodeIds?: string[];
  rewriteInstructions?: Map<string, string>; // nodeId -> 修改指令
}

interface Issue {
  type: 'structure' | 'logic' | 'character' | 'dialogue' | 'branch';
  severity: 'minor' | 'major' | 'critical';
  nodeIds: string[];
  description: string;
  suggestion: string;
}
```

### 6.5 Prompt 结构

```markdown
## System Prompt (Story Reviewer)

你是一位资深的故事编辑。你的任务是审阅 AI 生成的故事草稿，找出问题并给出修改建议。

### 你可以使用以下工具的输出（已预先生成）
- **structureReport.validation**: 节点连通性校验结果
- **structureReport.pathAnalysis**: 路径多样性分析
- **structureReport.characterCheck**: 角色一致性检查
- **structureReport.dialogueQuality**: 对话质量统计

### 审阅维度
1. **结构完整性** (critical)
   - 是否有孤立节点？
   - 是否所有路径都能到达结局？

2. **分支有意义性** (major)
   - 不同选择是否导向不同的情感体验？
   - 玩家是否能感受到"选择的重量"？

3. **角色一致性** (major)
   - 角色的语气、用词是否符合设定？
   - 是否有"出戏"的对话？

4. **对话质量** (minor)
   - 是否有过于冗长或过于简短的节点？
   - 对话是否推动剧情？

### 输出格式
请输出符合 CriticReport 接口的 JSON。
- 如果有 critical 问题，`shouldRegenerate = true`
- 如果 overallScore < 70，建议重写评分最低的节点
```

## 七、Orchestrator 实现

### 7.1 状态机设计

```typescript
type OrchestratorState = 
  | 'INIT'
  | 'PLANNING'
  | 'PLAN_VALIDATION'
  | 'WRITING'
  | 'REVIEWING'
  | 'REWRITING'
  | 'FINALIZING'
  | 'DONE'
  | 'FAILED';

interface OrchestratorContext {
  state: OrchestratorState;
  input: GenerateFromSetupInput;
  sharedContext: SharedContext;
  
  // 计数器
  planAttempts: number;
  reviewIterations: number;
  
  // 配置
  maxPlanAttempts: number;      // 默认 2
  maxReviewIterations: number;  // 默认 2
  minAcceptableScore: number;   // 默认 70
}
```

### 7.2 状态转换图

```
          ┌─────────────────────────────────────────┐
          │                                          │
          ▼                                          │
┌──────┐     ┌──────────┐     ┌────────────────┐    │
│ INIT │────►│ PLANNING │────►│ PLAN_VALIDATION│────┤
└──────┘     └──────────┘     └────────────────┘    │
                   ▲                   │            │
                   │                   │ valid      │ invalid
                   │                   ▼            │ (retry)
                   │            ┌──────────┐        │
                   │            │ WRITING  │        │
                   │            └────┬─────┘        │
                   │                 │              │
                   │                 ▼              │
                   │            ┌──────────┐        │
                   │            │ REVIEWING│        │
                   │            └────┬─────┘        │
                   │                 │              │
                   │    ┌────────────┼────────────┐ │
                   │    │            │            │ │
                   │ critical    score>=70    score<70
                   │    │            │            │
                   │    ▼            ▼            ▼
                   │ ┌──────┐  ┌───────────┐ ┌───────────┐
                   └─┤FAILED│  │ FINALIZING│ │ REWRITING │
                     └──────┘  └─────┬─────┘ └─────┬─────┘
                                     │             │
                                     ▼             │
                                 ┌──────┐          │
                                 │ DONE │◄─────────┘
                                 └──────┘       (max iterations)
```

### 7.3 核心代码框架

```typescript
export class StoryOrchestrator {
  private context: OrchestratorContext;
  private planner: StoryPlanner;
  private writer: NodeWriter;
  private reviewer: StoryReviewer;
  
  async generate(input: GenerateFromSetupInput): Promise<GameProject> {
    this.initContext(input);
    
    while (this.context.state !== 'DONE' && this.context.state !== 'FAILED') {
      await this.step();
    }
    
    if (this.context.state === 'FAILED') {
      throw new Error('Story generation failed after maximum attempts');
    }
    
    return this.finalizeOutput();
  }
  
  private async step(): Promise<void> {
    switch (this.context.state) {
      case 'INIT':
        this.buildSharedContext();
        this.context.state = 'PLANNING';
        break;
        
      case 'PLANNING':
        const plan = await this.planner.generate(this.context.sharedContext);
        this.context.sharedContext.narrativePlan = plan;
        this.context.state = 'PLAN_VALIDATION';
        break;
        
      case 'PLAN_VALIDATION':
        const validation = quickValidatePlan(this.context.sharedContext.narrativePlan!);
        if (validation.valid) {
          this.context.state = 'WRITING';
        } else if (this.context.planAttempts < this.context.maxPlanAttempts) {
          this.context.planAttempts++;
          this.context.state = 'PLANNING';
          console.log(`[Orchestrator] Plan validation failed, retrying (${this.context.planAttempts}/${this.context.maxPlanAttempts})`);
        } else {
          this.context.state = 'FAILED';
        }
        break;
        
      case 'WRITING':
        await this.writeAllNodes();
        this.context.state = 'REVIEWING';
        break;
        
      case 'REVIEWING':
        const report = await this.reviewer.review(this.context);
        this.handleReviewResult(report);
        break;
        
      case 'REWRITING':
        await this.rewriteTargetNodes();
        this.context.state = 'REVIEWING';
        break;
        
      case 'FINALIZING':
        this.context.state = 'DONE';
        break;
    }
  }
  
  private async writeAllNodes(): Promise<void> {
    const plan = this.context.sharedContext.narrativePlan!;
    const layers = this.topologicalSort(plan.nodes);
    
    for (const layer of layers) {
      // 同一层并行写作
      const drafts = await Promise.all(
        layer.map(node => this.writer.write({
          planNode: node,
          ...this.context.sharedContext,
          previousNodeSummary: this.getPreviousSummary(node),
        }))
      );
      
      // 保存到 SharedContext
      drafts.forEach(draft => {
        this.context.sharedContext.nodeDrafts.set(draft.id, draft);
      });
    }
  }
  
  private handleReviewResult(report: CriticReport): void {
    this.context.sharedContext.criticReports.push(report);
    
    if (report.issues.some(i => i.severity === 'critical')) {
      // 有严重问题，且重试次数已满，标记失败
      if (this.context.reviewIterations >= this.context.maxReviewIterations) {
        this.context.state = 'FAILED';
      } else {
        this.context.reviewIterations++;
        this.context.state = 'REWRITING';
      }
    } else if (report.overallScore >= this.context.minAcceptableScore) {
      this.context.state = 'FINALIZING';
    } else if (this.context.reviewIterations < this.context.maxReviewIterations) {
      this.context.reviewIterations++;
      this.context.state = 'REWRITING';
    } else {
      // 分数不够但已达到最大迭代，接受当前结果
      this.context.state = 'FINALIZING';
    }
  }
}
```

## 八、与现有代码的集成

### 8.1 文件结构建议

```
apps/intelli-services/src/
├── services/
│   ├── game-generator.ts          # 保留，作为向后兼容入口
│   └── story-orchestrator/
│       ├── index.ts               # StoryOrchestrator 主类
│       ├── agents/
│       │   ├── StoryPlanner.ts
│       │   ├── NodeWriter.ts
│       │   └── StoryReviewer.ts
│       ├── context/
│       │   └── SharedContext.ts
│       ├── tools/
│       │   ├── structureValidator.ts  # 复用现有 validateNodeConnections
│       │   ├── pathAnalyzer.ts
│       │   └── qualityChecker.ts
│       └── types/
│           └── index.ts           # 所有接口定义
```

### 8.2 向后兼容

保留 `GameGenerator.generateFromSetup()` 作为入口，内部调用 `StoryOrchestrator`：

```typescript
// game-generator.ts
export class GameGenerator {
  private orchestrator: StoryOrchestrator;
  
  async generateFromSetup(characters: any[], worldSetting: any, scenes?: any[], themeSetting?: any): Promise<GameProject> {
    // 新模式：使用 Orchestrator
    if (process.env.USE_ORCHESTRATOR === 'true') {
      return this.orchestrator.generate({
        characters,
        worldSetting,
        scenes: scenes || [],
        themeSetting,
      });
    }
    
    // 旧模式：保持现有逻辑（兼容）
    // ... 现有代码 ...
  }
}
```

## 九、Hackathon 演示策略

### 9.1 可视化演示点

| 演示环节 | 展示内容 | 技术亮点 |
|---------|---------|---------|
| **Step 1: 用户设定** | Setup 界面配置角色/世界观/场景 | 表单自动补全（已有） |
| **Step 2: 规划阶段** | 实时显示 Planner 输出的骨架图 | Tree-of-Thoughts 可视化 |
| **Step 3: 写作阶段** | 显示并行写作进度条 | 并行生成 + 实时流式输出 |
| **Step 4: 审稿阶段** | 显示 Reviewer 的评分和修改建议 | ReAct 推理过程可视化 |
| **Step 5: 最终输出** | Flow Editor 中展示完整故事图 | 与现有编辑器无缝对接 |

### 9.2 关键

> "我们的系统不是简单的 'prompt → 输出'，而是一个**多智能体协作系统**：
> - **Story Planner** 使用 Tree-of-Thoughts 探索多条叙事路径，选择最优方案
> - **Node Writer** 支持并行写作，大幅提升生成效率
> - **Story Reviewer** 采用 ReAct 模式，结合工具调用和推理，确保故事质量
> - 整个流程由**状态机驱动**，支持自动重试和局部修正"

## 十、迭代计划

### Phase 1: MVP
- [ ] 实现 StoryOrchestrator 状态机
- [ ] 实现 StoryPlanner (ToT 简化版)
- [ ] 实现 NodeWriter (带并行)
- [ ] 实现 StoryReviewer (ReAct 简化版)
- [ ] 集成到现有 API

### Phase 2: 增强
- [ ] 添加更多 Reviewer 工具
- [ ] 支持"角色关系图"输入
- [ ] 支持用户干预中间结果
- [ ] 流式输出优化
