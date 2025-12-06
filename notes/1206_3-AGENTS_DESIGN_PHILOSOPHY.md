# IntelliVNG 概念建模设计与演进思考

> **写在前面**
> 
> 在构建 IntelliVNG 时，我们并没有一开始就去定义 JSON Schema。相反，我们花了很多时间去思考一个更本质的问题：**“一个人类编剧团队是如何创作一部非线性非线性视觉小说游戏的？”**
> 
> 本文尝试还原我们的探索路径：从解构非线性视觉小说游戏的创作本质，到推导核心数据模型，再到设计 Agent 协作范式。这是一场关于如何将“艺术创作直觉”转化为“工程化数据结构”的思维实验。

## 第一章：寻找创作的“原点” —— 核心概念建模

在系统设计的初期，我们面临的第一个挑战是：**如何定义输入？**

最简单的做法是给 LLM 一个 Prompt：“写一个校园恋爱故事”。但根据我们对大量优秀非线性视觉小说游戏（如`《Fate/stay night》、《逆转裁判》、《底特律：变人》`）的调研，发现决定一部作品上限的，往往不是具体的对话，而是底层的**设定地基**。

为了让 AI 的创作不至于“天马行空但空洞无物”，我们从人类创作方法论中提炼出了 **四个核心维度** ，作为系统的**WorkflowInput（工作流起点）**：

### 1. WorldBible（世界观圣经）：沉浸感的边界
- **思考**：为什么 AI 写的故事容易“出戏”？
- **发现**：因为 AI 缺乏“常识边界”。它可能前一秒还在写古代宫廷，后一秒就出现了手机。
- **设计推导**：我们需要一个**WorldBible**。它不仅是背景介绍，更是**规则集（Rules）**。它定义了物理法则（有无魔法？）、社会结构（等级制度？）和可用场景池。
- **作用**：这成为了后续所有 Agent 的“宪法”。Planner 规划剧情时不能违背物理法则，Writer 描写场景时必须从场景池中取材，确保了逻辑的一致性。

### 2. CharacterDB（角色数据库）：驱动剧情的引擎
- **思考**：什么是好的非线性叙事？
- **发现**：好的分支不是为了分而分，而是**基于性格的选择**。
- **设计推导**：简单的“姓名/年龄”是不够的。我们在 **CharacterDB** 中引入了两个关键字段：
    - **`personality.traits` (性格标签)**：决定了角色“怎么说话”。
    - **`coreTraits.obsession` (核心执念)**：决定了角色“怎么做选择”。**
- **作用**：当 Node Writer 撰写对话时，它不再是随机生成，而是基于“执念”进行角色扮演。

### 3. StyleGuide（风格指南）：统一叙事的调性
- **思考**：多 Agent 协作最大的风险是什么？
- **发现**：是“风格割裂”。Planner 想要赛博朋克风，Writer 却写成了青春疼痛文学。
- **设计推导**：我们需要一个显式的 **StyleGuide**，包含 `tone` (基调) 和 `themes` (主题标签)。
- **作用**：它是 Agent 间的“对齐信号”，确保所有生成的文本在氛围上保持高度统一。

### 4. Constraints（工程约束）：落地的保障
- **思考**：这是游戏，不是纯小说。
- **发现**：游戏开发有资源限制（美术资源有限、工期有限）。
- **设计推导**：引入 **Constraints**，明确 `targetNodeCount`（节点预算）和 `targetEndingCount`（结局预算）。
- **作用**：这迫使 Story Planner 戴着镣铐跳舞，在有限的资源内通过结构设计最大化叙事张力，而不是无限制地发散。

## 第二章：从“上帝视角”到“专业分工” —— Agent 架构演进

有了输入，该如何处理？我们经历了一次认知的迭代。

**早期尝试：Single Pass (大模型一把梭)**
最初，我们试图让 LLM 一次性生成整个剧本。结果是灾难性的：
- **逻辑崩坏**：写到结局时忘了开头的伏笔。
- **伪非线性**：只有结局前有一个分支，中间全是流水账。
- **细节丢失**：顾着推剧情，忘了写环境描写。

**进阶思考：模拟“人类编辑部”**
观察成熟的游戏文案团队，我们发现了三个关键角色：**主编（规划结构）、编剧（填充内容）、监修（审核质量）**。我们将这套人类协作模式映射到了 Agent 系统中：

1.  **Story Planner (主编)**：不写具体对话，只画流程图。
    -   *关注点：结构、分支逻辑、起承转合。*
2.  **Node Writer (编剧)**：拿着流程图填空，只负责当前节点的演出。
    -   *关注点：台词、表演、氛围。*
3.  **Story Reviewer (监修)**：拿着放大镜找茬。
    -   *关注点：逻辑漏洞、人设崩塌、分支分布。*

## 第三章：Story Planner 的设计哲学 —— 为什么是 ToT？

在三个角色中，**Story Planner** 是最具挑战性的。它是整个系统的“大脑”。

### 1. 为什么普通的 Prompt 搞不定非线性规划？
只看单次 LLM 调用，其本质是“预测下一个 token”，如果没有设计良好的上下文工程 (Context Engineering)，那么注定只能进行**线性**的思维方式。但设计非线性剧本需要**全局思维**和**回溯能力**——“如果我在这里设置分支，会导致结局收不回来吗？”

### 2. 引入 Tree of Thoughts (ToT) 范式
为了赋予 AI “推演”的能力，我们设计了三轮 ToT 流程：
- **Round 1 (发散)**：基于设定，先构思 3 种截然不同的故事走向 (CandidatePaths)。
- **Round 2 (评估)**：像制作人一样，从戏剧性、角色契合度等维度给方案打分。
- **Round 3 (收束)**：选定最优方案，展开为节点骨架。

### 3. Schema 的深层设计意图：PlanNode
在 Round 3 的输出 `NarrativePlan` 中，每一个 `PlanNode` 的设计都经过深思熟虑：

-   **`functionTag` (叙事功能标签)**：
    -   *设计初衷*：防止 AI 写流水账。
    -   *作用*：强制要求节点必须承载“Setup(铺垫)”、“Conflict(冲突)”、“Climax(高潮)”等功能，确保故事有起伏的节奏。

-   **`choicesMeta` (选项元数据)** —— **这是系统的灵魂字段**：
    -   *设计初衷*：我们发现 AI 喜欢出“毫无意义的选项”（如：吃饭还是吃面）。
    -   *建模*：我们为此设计了复杂的结构：
        -   `emotionalWeight` (情感重量)：强制 AI 思考这个选择是否足够艰难？
        -   `branchType` (分支类型)：强制分类——是改变剧情路线 (`route`)，还是仅仅影响好感度 (`relationship`)？
        -   `consequenceHint` (后果暗示)：要求 AI 预判选择的蝴蝶效应。
    -   *作用*：这迫使 Story Planner 在画骨架时，就必须确保每一个分支都是**“由于剧情冲突推导出的必然结果”**，从而实现真正的非线性。

## 第四章：Node Writer 的并行艺术 —— 上下文的传递

当 Planner 画好骨架后，Node Writer 需要将其血肉化。这里我们设计了一个精妙的**拓扑并行机制**。

-   **思考**：节点 B 依赖节点 A 的剧情，但为了速度，我们需要并行生成。
-   **解决方案**：利用 Schema 中的 `previousNodeSummary`。
-   **流转逻辑**：
    1.  Planner 生成骨架，包含节点的 `brief`（简述）。
    2.  系统对节点进行拓扑排序分层。
    3.  生成 Layer N 时，将 Layer N-1 的生成结果压缩为 `summary` 传给 Writer。
-   **意义**：这既保证了生成速度（并行），又确保了剧情连贯性（上下文传递），完美平衡了工程效率与叙事逻辑。


## 第五章：Orchestrator 的诞生 —— 从“线性脚本”到“状态机”

到目前为止，我们有了三个各司其职的 Agent。但如何将它们优雅地组织起来？

### 1. 为什么不能用简单的线性调用？
最直接的想法是写一个线性脚本：`planner.run() -> writer.run() -> reviewer.run()`。
但在第一次测试中，我们就遇到了致命问题：
* **问题**：Reviewer 审阅后发现 `overallScore: 58`，剧本质量不合格。怎么办？
* **线性脚本的困境**：整个流程结束了，无法回头。难道要让用户重新生成一次，再祈祷下一次运气好？这不叫“系统”，这叫“开盲盒”。

### 2. 引入 Plan-and-Execute 状态机
- **思考**：一个真实的项目经理是如何工作的？他不会等到项目彻底失败才介入，而是在每个阶段结束后进行决策：是进入下一阶段、打回重做、还是终止项目？
- **设计推导**：这个“决策过程”就是一个**状态机**。我们将整个创作流程抽象为一系列状态（`PLANNING`, `WRITING`, `REVIEWING`, `FAILED`, `DONE`）和状态之间的转移条件。
- **Orchestrator 的角色**：它不是一个 LLM Agent，而是一个**确定性的工作流控制器**。它负责：
    1.  **调用 Agent**：在每个状态下，调用对应的 Agent 执行任务。
    2.  **管理数据**：将上一个状态的输出（如 `NarrativePlan`）作为下一个状态的输入。
    3.  **决策流转**：根据 Agent 的输出（如 `CriticReport`）决定下一个状态是什么。

```
          ┌─────────────────────────────────────────┐
          │                                          │
          ▼                                          │
┌──────┐     ┌──────────┐     ┌───────────┐        │
│ INIT │────►│ PLANNING │────►│  WRITING  │        │
└──────┘     └──────────┘     └─────┬─────┘        │
                   ▲                  │              │
                   │                  ▼              │
                   │            ┌───────────┐        │
                   │            │ REVIEWING │        │
                   │            └─────┬─────┘        │
                   │                  │              │
                   │    ┌─────────────┼────────────┐ │
                   │    │             │            │ │
           打回重写 │ critical/score<60  score>=60 │ 通过
                   │    │             │            │
                   │    ▼             ▼            ▼
                   │ ┌──────┐   ┌───────────┐  ┌──────┐
                   └─┤FAILED│   │ REWRITING │  │ DONE │
                     └──────┘   └─────┬─────┘  └──────┘
                                      │
                                      └────────────────► WRITING
```

- **意义**：通过引入状态机，我们的系统获得了**自我修正**的能力。当 Reviewer 发现问题，Orchestrator 可以决定是**全局重写**（退回到 `PLANNING`），还是**局部修正**（进入 `REWRITING` 状态，只让 Node Writer 重写特定节点）。这让系统从一个“一次性”的脚本，变成了一个可持续迭代的“工厂”。

## 第六章：Story Reviewer 的进化 —— 从“主观评价”到“客观证据”

系统有了自我修正的能力，但修正的依据是什么？

### 1. 为什么“让 AI 评价 AI”是不可靠的？
- **思考**：我们最初的 Reviewer Prompt 是：“请为这个剧本打分，并给出修改意见。”
- **发现**：LLM 很容易陷入“彩虹屁”模式，给出诸如“故事很精彩，节奏很棒”这样空洞的评价。或者，它会随机找一些无关紧要的细节进行批评。这种反馈毫无价值。
- **洞察**：人类编辑在审稿时，依靠的是**客观分析工具**：大纲视图（检查结构）、字数统计（检查节奏）、角色出场表（检查人物弧光）。他们不是“感觉”有问题，而是“看到”了问题。

### 2. 引入 Reasoning + Acting (ReAct) 范式
- **设计推导**：要让 Reviewer 变得可靠，就必须让它的评价基于**证据（Evidence）**。我们不能只让它“读”，还要让它能“分析”。
- **工具的诞生**：我们为 Reviewer 开发了一套工具箱：
    - `validate-structure`: 运行图算法，检查是否存在**孤立节点**或**死胡同**。
    - `analyze-paths`: 枚举所有从开始到结局的路径，计算**分支多样性**。
    - `analyze-dialogue-quality`: 统计每个节点的**对话数量**。
- **ReAct 的本质**：Reviewer 的工作模式从“一步到位”变成了“侦探破案”：
    1.  **Thought (思考)**：“我应该先检查结构是否完整。”
    2.  **Action (行动)**：调用 `validate-structure` 工具。
    3.  **Observation (观察)**：看到工具返回 `deadEnds: ["scene-3"]`。
    4.  **Thought (再思考)**：“OK，我找到了一个致命的结构问题。接下来我再看看分支设计得怎么样……”
- **意义**：ReAct 范式将 Reviewer 从一个“主观的文学评论家”转变为一个**“客观的数据分析师”**。它的每一条批评，背后都有工具返回的数据作为支撑。

### 3. Schema 的再进化：CriticReport
为了承载这些“证据”，我们设计了 `CriticReport` Schema：
- **`scores` (多维度评分)**：
    - *设计初衷*：将“好/坏”的模糊感觉，拆解为 `plotCoherence`、`characterConsistency`、`branchDistribution` 等多个可量化的维度。
    - *数据来源*：每个维度的分数都直接或间接地来自工具的输出。
- **`issues[]` (问题列表)**：
    - *设计初衷*：将抽象的扣分项，落实到具体的问题上。
    - *建模*：每个 `Issue` 都包含 `type` (问题类型)、`severity` (严重等级)、`nodeIds` (问题节点)、`description` (描述) 和 `suggestion` (修改建议)。
    - *作用*：这使得反馈变得**精确且可操作**。Orchestrator 可以根据 `severity` 为 `critical` 的 `structure` 问题做出“必须重写”的决策。

## 结语

IntelliVNG 的多智能体系统的概念设计与优化过程，其实也是 [程序化叙事生成（Procedural Narrative Generation）](https://www.psyxel.com/ai-and-narrative-pcg/) 在智能体技术栈下的一次工程实践。

我们通过 `WorldBible` 确立边界，通过 `CharacterDB` 注入灵魂，通过 `ToT 机制` 赋予逻辑，并且处处通过精细的 `Schema` 编织成网。

这套系统的价值，不仅在于它能自动创作游戏剧本，更在于它探索了一种人机协作的新范式：**人类定义规则、边界与协作流程，AI 在这个框架内扮演不同的专业角色，进行探索、创作与自我审视。**

## 扩展阅读

> [1] Klein, S. (1973). Automatic Novel Writing: A Status Report. University of Wisconsin-Madison Department of Computer Sciences.
> 
> [2] Dehn, Natalie (1981). “Story Generation after Tale-Spin.” A. Drinan (ed). Proceedings of the Seventh International Joint Conference on Artificial Intelligence, August 24–28, University of British Columbia, Vancouver, Canada. Los Altos, CA: Kaufmann, vol. 116–18.
> 
> [3] Lebowitz, Michael (1983). “Creating a Story-Telling Universe.” A. Nundy (ed). Proceedings of the Eighth International Joint Conference on Artiﬁcial Intelligence, August 8–12, Karlsruhe, Germany. Los Altos, CA: Kaufmann, vol. 1, 63–65.
> 
> [4] Turner, Scott R. (1993). Minstrel: a computer model of creativity and storytelling. PhD Dissertation, University of California at Los Angeles, Los Angeles.
> 
> [5] Pérez y Pérez, R., & Sharples, M. (2001). MEXICA: A computer model of a cognitive account of creative writing. Journal of Experimental and Theoretical Artificial Intelligence, 13, 119–139.
> 
> [6] Gervás, P., Díaz-Agudo, B., Peinado, F., & Hervás, R. (2005). Story plot generation based on CBR. Journal of Knowledge-Based Systems, 18 (4–5), 235–242.
> 
> [7] Meehan, J. R. (1977). TALE-SPIN: An interactive program that writes stories. In Proceedings of the 5th International Joint Conference on Artificial Intelligence, pp. 91–98.
> 
> [8] http://www.cs.cmu.edu/afs/cs.cmu.edu/project/oz/web/papers.html
> 
> [9] Riedl, Mark Owen; Young, Robert Michael. (2014) Narrative Planning: Balancing Plot and Character. Journal Of Artificial Intelligence Research, Volume 39, pages 217-268, 2010; doi:10.1613/jair.2989
> 
> [10] Jonathan Doran and Ian Parberry, "A Prototype Quest Generator Based on a Structural Analysis of Quests from Four MMORPGs", Proceedings of the Second International Workshop on Procedural Content Generation in Games, pp. 1-8, Bordeaux, France, 2011.