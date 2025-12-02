/**
 * GameGeneratorAgent
 * 使用 Mastra 多智能体系统生成剧本
 * 
 * 技术架构：
 * - Story Planner Agent: Tree-of-Thoughts 非线性故事规划
 * - Node Writer Agent: Few-Shot CoT 并行节点写作
 * - Story Reviewer Agent: ReAct 工具增强审阅
 * - Orchestrator: Plan-and-Execute 状态机编排
 */
import { mastra, getStoryWorkflow } from "../mastra";
import type { NarrativePlan, NodeDraft, CriticReport, WorkflowInput } from "../agents/schemas";
import { NarrativePlanSchema, NodeDraftSchema, CriticReportSchema } from "../agents/schemas";
import { generateNarrativePlanWithToT, storyPlannerAgent } from "../agents/storyPlanner";
import { ProgressEmitter, createProgressEmitter } from "./progress-emitter";

// ============ 类型定义（与 game-generator.ts 保持一致）============

interface GameProject {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
  meta: {
    author: string;
    version: string;
    genre: string;
    artStyle: string;
  };
  characters: Character[];
  backgrounds: Background[];
  script: StoryNode[];
  settings: {
    textSpeed: number;
    autoPlayDelay: number;
    defaultTransition: string;
  };
}

interface Character {
  id: string;
  name: string;
  displayName: string;
  description: string;
  avatarUrl?: string;
  sprites: any[];
  defaultSpriteId: string;
}

interface Background {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

interface StoryNode {
  id: string;
  type: 'scene' | 'branch' | 'ending';
  isStart?: boolean;
  isEnding?: boolean;
  position: { x: number; y: number };
  title: string;
  sceneName?: string;
  backgroundId?: string;
  visualAssets?: {
    backgroundImageUrl?: string;
    characters?: Array<{
      characterId: string;
      spriteUrl?: string;
      position?: { x: number; y: number };
      scale?: number;
    }>;
  };
  audioAssets?: {
    bgmUrl?: string;
    bgmVolume?: number;
    bgmLoop?: boolean;
  };
  narration?: string;
  dialogues: Dialogue[];
  choices?: Choice[];
  nextNodeId?: string;
  notes?: string;
  tags?: string[];
}

interface Dialogue {
  id: string;
  characterId: string;
  text: string;
  emotion?: string;
}

interface Choice {
  id: string;
  text: string;
  targetNodeId: string;
  condition?: string;
}

// ============ 工具函数 ============

const createId = () => Math.random().toString(36).substring(2, 12);

// ============ GameGeneratorAgent 主类 ============

export class GameGeneratorAgent {
  private maxRetries: number = 2;
  private minAcceptableScore: number = 60;

  constructor(options?: { maxRetries?: number; minAcceptableScore?: number }) {
    if (options?.maxRetries) {
      this.maxRetries = options.maxRetries;
    }
    if (options?.minAcceptableScore) {
      this.minAcceptableScore = options.minAcceptableScore;
    }
  }

  /**
   * 使用多智能体系统生成剧本
   * 
   * @param characters 用户定义的角色列表
   * @param worldSetting 世界观设定
   * @param scenes 场景列表
   * @param themeSetting 主题风格设定
   */
  async generateFromSetup(
    characters: any[],
    worldSetting: any,
    scenes?: any[],
    themeSetting?: any
  ): Promise<GameProject> {
    console.log(`[GameGeneratorAgent] 🚀 启动多智能体剧本生成系统`);
    console.log(`[GameGeneratorAgent] 角色: ${characters.length}, 场景: ${scenes?.length || 0}`);

    // 构建工作流输入
    const workflowInput: WorkflowInput = {
      worldBible: {
        name: worldSetting?.name || '未命名世界',
        era: worldSetting?.era || '现代',
        location: worldSetting?.location || '未知地点',
        rules: worldSetting?.rules || '',
        scenes: scenes?.map(s => ({
          id: s.id || createId(),
          name: s.name,
          type: s.type || 'location',
          atmosphere: s.atmosphere || '',
          details: s.details || '',
        })) || [],
      },
      characterDB: {
        characters: characters.map(c => ({
          id: c.id || createId(),
          name: c.name,
          displayName: c.displayName || c.name,
          gender: c.gender,
          identity: c.identity,
          description: c.description,
          personality: c.personality || {},
          coreTraits: c.coreTraits || {},
        })),
      },
      styleGuide: themeSetting ? {
        themes: themeSetting.themes || [],
        styles: themeSetting.styles || [],
        tone: themeSetting.tone || '',
      } : undefined,
      constraints: {
        targetNodeCount: 12,
        targetEndingCount: 3,
      },
    };

    // 获取并运行工作流
    const workflow = getStoryWorkflow();
    console.log(`[GameGeneratorAgent] 📋 获取工作流: story-generation`);

    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= this.maxRetries) {
      try {
        console.log(`[GameGeneratorAgent] 🔄 第 ${retryCount + 1}/${this.maxRetries + 1} 次尝试...`);
        
        const run = await workflow.createRunAsync();
        const result = await run.start({
          inputData: workflowInput,
        });

        if (result.status !== "success") {
          throw new Error(`工作流执行失败: ${result.status}`);
        }

        const workflowResult = result.result as {
          plan: NarrativePlan;
          drafts: Record<string, NodeDraft>;
          report: CriticReport;
          rewritten: string[];
        };

        // 检查审阅分数
        const { report } = workflowResult;
        console.log(`[GameGeneratorAgent] 📊 审阅评分: ${report.overallScore}`);
        console.log(`[GameGeneratorAgent] 评分详情:`, JSON.stringify(report.scores, null, 2));

        if (report.overallScore < this.minAcceptableScore && report.shouldRegenerate && report.regenerateTarget === "all") {
          console.log(`[GameGeneratorAgent] ⚠️ 评分过低 (${report.overallScore} < ${this.minAcceptableScore})，需要重新生成`);
          
          if (retryCount < this.maxRetries) {
            retryCount++;
            continue;
          }
          
          console.log(`[GameGeneratorAgent] ⚠️ 已达最大重试次数，使用当前结果`);
        }

        // 转换为 GameProject 格式
        const gameProject = this.transformToGameProject(
          workflowResult,
          characters,
          scenes || [],
          worldSetting,
          themeSetting
        );

        console.log(`[GameGeneratorAgent] ✅ 剧本生成完成: "${gameProject.title}"`);
        console.log(`[GameGeneratorAgent] 📊 最终评分: ${report.overallScore}`);
        if (workflowResult.rewritten.length > 0) {
          console.log(`[GameGeneratorAgent] 🔄 重写节点: ${workflowResult.rewritten.join(', ')}`);
        }

        return gameProject;

      } catch (error) {
        lastError = error as Error;
        console.error(`[GameGeneratorAgent] ❌ 第 ${retryCount + 1} 次尝试失败:`, lastError.message);
        
        if (retryCount < this.maxRetries) {
          retryCount++;
          continue;
        }
        
        break;
      }
    }

    throw new Error(`剧本生成失败（已重试 ${this.maxRetries} 次）: ${lastError?.message}`);
  }

  /**
   * 将工作流结果转换为 GameProject 格式
   */
  private transformToGameProject(
    workflowResult: {
      plan: NarrativePlan;
      drafts: Record<string, NodeDraft>;
      report: CriticReport;
    },
    userCharacters: any[],
    userScenes: any[],
    worldSetting: any,
    themeSetting?: any
  ): GameProject {
    const now = new Date().toISOString();
    const projectId = createId();

    const { plan, drafts } = workflowResult;

    // 1️⃣ 收集所有角色名称
    const aiCharacterNames = new Set<string>();
    Object.values(drafts).forEach(draft => {
      draft.dialogues?.forEach(d => {
        if (d.characterName && d.characterName !== '旁白' && d.characterName !== 'Narrator') {
          aiCharacterNames.add(d.characterName);
        }
      });
    });

    // 2️⃣ 构建角色列表（使用用户定义 + 自动补充）
    const characters: Character[] = userCharacters.map(char => ({
      ...char,
      id: char.id || createId(),
      displayName: char.displayName || char.name,
      description: char.description || '',
      sprites: char.sprites || [],
      defaultSpriteId: char.defaultSpriteId || '',
    }));

    // 补充新角色
    const existingNames = new Set<string>();
    characters.forEach(c => {
      existingNames.add(c.name.toLowerCase());
      if (c.displayName) existingNames.add(c.displayName.toLowerCase());
    });

    aiCharacterNames.forEach(aiName => {
      if (!existingNames.has(aiName.toLowerCase())) {
        characters.push({
          id: createId(),
          name: aiName,
          displayName: aiName,
          description: `AI生成的角色: ${aiName}`,
          avatarUrl: '',
          sprites: [],
          defaultSpriteId: '',
        });
        console.log(`[GameGeneratorAgent] ✅ 自动创建新角色: ${aiName}`);
      }
    });

    // 3️⃣ 构建角色映射
    const characterMap = new Map<string, Character>();
    characters.forEach(c => {
      characterMap.set(c.name.toLowerCase(), c);
      if (c.displayName) {
        characterMap.set(c.displayName.toLowerCase(), c);
      }
    });
    characterMap.set('narrator', { id: 'narrator', name: 'Narrator', displayName: '旁白' } as any);
    characterMap.set('旁白', { id: 'narrator', name: 'Narrator', displayName: '旁白' } as any);

    // 4️⃣ 构建场景/背景列表
    const backgrounds: Background[] = userScenes.map(scene => ({
      id: scene.id || createId(),
      name: scene.name,
      description: scene.details || `${scene.type} · ${scene.atmosphere}`,
      imageUrl: scene.imageUrl || '',
    }));

    // 场景名到ID的映射
    const sceneNameToId = new Map<string, string>();
    backgrounds.forEach(bg => {
      sceneNameToId.set(bg.name.toLowerCase(), bg.id);
    });

    // 5️⃣ 构建 StoryNode[]
    const script: StoryNode[] = [];

    // 按 plan.nodes 的顺序遍历，从 drafts 中获取内容
    plan.nodes.forEach(planNode => {
      const draft = drafts[planNode.id];
      
      if (!draft) {
        console.warn(`[GameGeneratorAgent] ⚠️ 节点 ${planNode.id} 没有对应的草稿`);
        return;
      }

      // 匹配对话中的角色ID
      const dialogues: Dialogue[] = draft.dialogues?.map(d => {
        const charName = d.characterName.toLowerCase();
        const char = characterMap.get(charName);
        return {
          id: createId(),
          characterId: char?.id || '',
          text: d.text,
          emotion: d.emotion,
        };
      }) || [];

      // 匹配背景ID
      const backgroundId = draft.sceneName 
        ? sceneNameToId.get(draft.sceneName.toLowerCase()) 
        : undefined;

      const storyNode: StoryNode = {
        id: draft.id,
        type: draft.type,
        isStart: planNode.isStart,
        isEnding: planNode.isEnding,
        position: planNode.position || { x: 0, y: 0 },
        title: draft.title,
        sceneName: draft.sceneName,
        backgroundId,
        narration: draft.narration,
        dialogues,
      };

      // 分支节点：添加 choices
      if (draft.type === 'branch' && draft.choices) {
        storyNode.choices = draft.choices.map(c => ({
          id: c.id || createId(),
          text: c.text,
          targetNodeId: c.targetNodeId,
          condition: c.meta?.consequenceHint,  // 使用 consequenceHint 作为条件标签
        }));
      }

      // 非分支非结局节点：添加 nextNodeId
      if (draft.type !== 'branch' && !planNode.isEnding && draft.nextNodeId) {
        storyNode.nextNodeId = draft.nextNodeId;
      }

      script.push(storyNode);
    });

    // 6️⃣ 验证节点连接
    this.validateNodeConnections(script);

    // 7️⃣ 构建 GameProject
    const gameProject: GameProject = {
      id: projectId,
      title: plan.outline.premise.slice(0, 50) || '未命名故事',
      description: `${plan.outline.premise}\n\n核心冲突: ${plan.outline.centralConflict}`,
      createdAt: now,
      updatedAt: now,
      meta: {
        author: 'IntelliVNG Multi-Agent System',
        version: '2.0.0',
        genre: themeSetting?.styles?.[0] || 'drama',
        artStyle: 'anime',
      },
      characters,
      backgrounds,
      script,
      settings: {
        textSpeed: 50,
        autoPlayDelay: 3000,
        defaultTransition: 'fade',
      },
    };

    console.log(`[GameGeneratorAgent] 📦 GameProject 构建完成:`);
    console.log(`  - 角色: ${characters.length}`);
    console.log(`  - 场景: ${backgrounds.length}`);
    console.log(`  - 节点: ${script.length}`);

    return gameProject;
  }

  /**
   * 验证节点连接完整性
   */
  private validateNodeConnections(storyNodes: StoryNode[]): void {
    console.log('[GameGeneratorAgent] 🔍 验证节点连接...');
    
    const nodeIds = new Set(storyNodes.map(n => n.id));
    const reachableFromStart = new Set<string>();
    
    // 找到开始节点
    const startNode = storyNodes.find(n => n.isStart);
    if (!startNode) {
      throw new Error('没有找到开始节点 (isStart: true)');
    }
    
    // 找到结局节点
    const endingNodes = storyNodes.filter(n => n.isEnding);
    if (endingNodes.length === 0) {
      throw new Error('没有找到结局节点 (isEnding: true)');
    }
    
    // BFS 检查可达性
    const queue = [startNode.id];
    reachableFromStart.add(startNode.id);
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = storyNodes.find(n => n.id === currentId);
      if (!currentNode) continue;
      
      if (currentNode.nextNodeId && !reachableFromStart.has(currentNode.nextNodeId)) {
        if (nodeIds.has(currentNode.nextNodeId)) {
          reachableFromStart.add(currentNode.nextNodeId);
          queue.push(currentNode.nextNodeId);
        } else {
          console.warn(`[GameGeneratorAgent] ⚠️ 无效链接: ${currentId} → ${currentNode.nextNodeId}`);
        }
      }
      
      currentNode.choices?.forEach(choice => {
        if (choice.targetNodeId && !reachableFromStart.has(choice.targetNodeId)) {
          if (nodeIds.has(choice.targetNodeId)) {
            reachableFromStart.add(choice.targetNodeId);
            queue.push(choice.targetNodeId);
          } else {
            console.warn(`[GameGeneratorAgent] ⚠️ 无效链接: ${currentId} → ${choice.targetNodeId}`);
          }
        }
      });
    }
    
    // 检查孤立节点
    const orphanNodes = storyNodes.filter(n => !reachableFromStart.has(n.id));
    if (orphanNodes.length > 0) {
      console.warn(`[GameGeneratorAgent] ⚠️ 发现 ${orphanNodes.length} 个孤立节点: ${orphanNodes.map(n => n.id).join(', ')}`);
    }
    
    // 检查死胡同
    const deadEnds = storyNodes.filter(n => 
      !n.isEnding && 
      !n.nextNodeId && 
      (!n.choices || n.choices.length === 0)
    );
    if (deadEnds.length > 0) {
      console.warn(`[GameGeneratorAgent] ⚠️ 发现 ${deadEnds.length} 个死胡同: ${deadEnds.map(n => n.id).join(', ')}`);
    }
    
    console.log(`[GameGeneratorAgent] ✅ 验证完成: ${reachableFromStart.size}/${storyNodes.length} 节点可达`);
  }

  /**
   * 使用多智能体系统生成剧本（带进度回调）
   * 
   * 这个方法直接调用各个 Agent，而不是通过 Workflow，
   * 以便在每个阶段发射进度事件。
   */
  async generateFromSetupWithProgress(
    characters: any[],
    worldSetting: any,
    scenes: any[] | undefined,
    themeSetting: any | undefined,
    progressEmitter: ProgressEmitter
  ): Promise<GameProject> {
    const startTime = Date.now();
    
    // ============ 初始化阶段 ============
    progressEmitter.stageStart("init", "初始化智能体系统", "正在初始化多智能体剧本生成系统...");
    
    // 构建工作流输入
    const workflowInput: WorkflowInput = {
      worldBible: {
        name: worldSetting?.name || '未命名世界',
        era: worldSetting?.era || '现代',
        location: worldSetting?.location || '未知地点',
        rules: worldSetting?.rules || '',
        scenes: scenes?.map(s => ({
          id: s.id || createId(),
          name: s.name,
          type: s.type || 'location',
          atmosphere: s.atmosphere || '',
          details: s.details || '',
        })) || [],
      },
      characterDB: {
        characters: characters.map(c => ({
          id: c.id || createId(),
          name: c.name,
          displayName: c.displayName || c.name,
          gender: c.gender,
          identity: c.identity,
          description: c.description,
          personality: c.personality || {},
          coreTraits: c.coreTraits || {},
        })),
      },
      styleGuide: themeSetting ? {
        themes: themeSetting.themes || [],
        styles: themeSetting.styles || [],
        tone: themeSetting.tone || '',
      } : undefined,
      constraints: {
        targetNodeCount: 12,
        targetEndingCount: 3,
      },
    };

    progressEmitter.stageComplete("init", "初始化完成", `已加载 ${characters.length} 个角色, ${scenes?.length || 0} 个场景`, {
      nodeCount: characters.length,
    });

    let plan: NarrativePlan | null = null;
    let drafts: Record<string, NodeDraft> = {};
    let report: CriticReport | null = null;
    let rewritten: string[] = [];

    try {
      // ============ 规划阶段（真正的 Tree-of-Thoughts） ============
      progressEmitter.stageStart("planning", "Story Planner 规划故事结构", "Tree-of-Thoughts 第 1 轮：生成候选叙事方向...");
      
      // 使用真正的 ToT 多轮调用
      // Round 1: 生成候选方向
      // Round 2: 评估并选择最佳方向  
      // Round 3: 展开为完整节点骨架
      plan = await generateNarrativePlanWithToT(storyPlannerAgent, workflowInput);

      progressEmitter.stageComplete("planning", "故事骨架规划完成 (ToT 3轮)", 
        `探索了多条叙事路径，最终生成 ${plan.nodes.length} 个节点`, {
        nodeCount: plan.nodes.length,
        endingCount: plan.nodes.filter(n => n.isEnding).length,
      });

      // ============ 规划验证阶段 ============
      progressEmitter.stageStart("plan_validate", "验证故事结构", "检查节点连通性和结构完整性...");
      
      const validationResult = this.quickValidatePlan(plan);
      if (!validationResult.valid) {
        progressEmitter.stageFailed("plan_validate", "规划验证失败", 
          `发现 ${validationResult.errors.length} 个结构问题: ${validationResult.errors.join('; ')}`);
        throw new Error(`规划验证失败: ${validationResult.errors.join('; ')}`);
      }

      progressEmitter.stageComplete("plan_validate", "结构验证通过", "所有节点连接正确");

      // ============ 写作阶段 ============
      progressEmitter.stageStart("writing", "Node Writer 开始写作", "Few-Shot CoT 正在为每个节点生成对话...");
      
      const writerAgent = mastra.getAgent("node-writer");
      const layers = this.topologicalSort(plan.nodes);
      
      progressEmitter.stageProgress("writing", "分析节点依赖", 10, 
        `故事分为 ${layers.length} 层，将按层并行写作`, {
        totalLayers: layers.length,
      });

      for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
        const layer = layers[layerIdx];
        const layerProgress = Math.round(10 + (layerIdx / layers.length) * 80);
        
        progressEmitter.stageProgress("writing", `写作第 ${layerIdx + 1}/${layers.length} 层`, 
          layerProgress, `正在并行写作 ${layer.length} 个节点...`, {
          layer: layerIdx + 1,
          totalLayers: layers.length,
          currentNode: layer.map(n => n.id).join(', '),
        });

        // 同一层并行调用
        const results = await Promise.all(
          layer.map(async (node) => {
            const previousSummary = this.getPreviousSummary(node, plan!.nodes, drafts);
            
            const writePrompt = `## 当前要写的节点
${JSON.stringify(node, null, 2)}

## 前序节点摘要
${previousSummary || "（这是故事的开始）"}

## 角色档案
${JSON.stringify(workflowInput.characterDB.characters.map((c: any) => ({
  name: c.name,
  displayName: c.displayName || c.name,
  personality: c.personality?.traits || [],
  identity: c.identity,
  description: c.description,
})), null, 2)}

## 风格指南
${JSON.stringify(workflowInput.styleGuide || {}, null, 2)}

请为这个节点撰写对话和旁白。`;

            const response = await writerAgent.generate(writePrompt, {
              structuredOutput: {
                schema: NodeDraftSchema,
              },
            });
            return { nodeId: node.id, draft: response.object as NodeDraft };
          })
        );

        results.forEach(r => {
          drafts[r.nodeId] = r.draft;
        });
      }

      progressEmitter.stageComplete("writing", "所有节点写作完成", 
        `共完成 ${Object.keys(drafts).length} 个节点的对话写作`, {
        nodeCount: Object.keys(drafts).length,
      });

      // ============ 审阅阶段 ============
      progressEmitter.stageStart("reviewing", "Story Reviewer 审阅故事", "ReAct 模式正在使用工具分析故事质量...");

      const reviewerAgent = mastra.getAgent("story-reviewer");
      
      const nodesForValidation = Object.values(drafts).map((d: any) => ({
        id: d.id,
        type: d.type,
        isStart: plan!.nodes.find(n => n.id === d.id)?.isStart,
        isEnding: plan!.nodes.find(n => n.id === d.id)?.isEnding,
        nextNodeId: d.nextNodeId,
        choices: d.choices?.map((c: any) => ({ targetNodeId: c.targetNodeId })),
        dialogues: d.dialogues,
        narration: d.narration,
      }));

      const reviewPrompt = `## 待审阅的节点草稿
${JSON.stringify(Object.values(drafts), null, 2)}

## 原始故事规划
${JSON.stringify(plan.outline, null, 2)}

## 角色档案
${JSON.stringify(workflowInput.characterDB.characters.map((c: any) => ({
  name: c.name,
  displayName: c.displayName,
  personality: c.personality?.traits,
})), null, 2)}

---

请按照 ReAct 模式审阅这个故事：
1. 调用 validate-structure 检查结构
2. 调用 analyze-paths 分析路径多样性
3. 调用 analyze-dialogue-quality 检查对话质量
4. 基于工具输出，给出综合评分和修改建议

检查用的节点数据:
${JSON.stringify(nodesForValidation, null, 2)}`;

      const reviewResponse = await reviewerAgent.generate(reviewPrompt, {
        structuredOutput: {
          schema: CriticReportSchema,
        },
        maxSteps: 5,
      });
      report = reviewResponse.object as CriticReport;

      progressEmitter.stageComplete("reviewing", "审阅完成", 
        `综合评分: ${report.overallScore}，发现 ${report.issues.length} 个问题`, {
        score: report.overallScore,
        issues: report.issues.length,
      });

      // ============ 重写阶段（如需） ============
      if (report.shouldRegenerate && report.regenerateTarget === "specific_nodes" && report.targetNodeIds) {
        progressEmitter.stageStart("rewriting", "重写问题节点", 
          `根据审阅建议重写 ${report.targetNodeIds.length} 个节点...`, {
          rewriteNodes: report.targetNodeIds,
        });

        const targetIds = report.targetNodeIds;
        
        await Promise.all(
          targetIds.map(async (nodeId, idx) => {
            progressEmitter.stageProgress("rewriting", `重写节点 ${nodeId}`, 
              Math.round((idx / targetIds.length) * 100), 
              `正在重写第 ${idx + 1}/${targetIds.length} 个节点...`);

            const issue = report!.issues.find(i => i.nodeIds.includes(nodeId));
            const originalDraft = drafts[nodeId];
            
            if (!originalDraft) return;

            const rewritePrompt = `## 原始草稿
${JSON.stringify(originalDraft, null, 2)}

## 审稿人的修改建议
${issue?.suggestion || "请优化对话质量，使其更加生动自然"}

## 问题类型
${issue?.type || "dialogue"} - ${issue?.description || "需要优化"}

## 角色档案
${JSON.stringify(workflowInput.characterDB.characters.map((c: any) => ({
  name: c.name,
  displayName: c.displayName || c.name,
  personality: c.personality?.traits || [],
})), null, 2)}

## 风格指南
${JSON.stringify(workflowInput.styleGuide || {}, null, 2)}

请根据审稿人的修改建议重写这个节点。`;

            const response = await writerAgent.generate(rewritePrompt, {
              structuredOutput: {
                schema: NodeDraftSchema,
              },
            });

            drafts[nodeId] = response.object as NodeDraft;
            rewritten.push(nodeId);
          })
        );

        progressEmitter.stageComplete("rewriting", "重写完成", 
          `已重写 ${rewritten.length} 个节点`, {
          rewriteNodes: rewritten,
        });
      }

      // ============ 最终化阶段 ============
      progressEmitter.stageStart("finalizing", "构建最终剧本", "正在将故事转换为 GameProject 格式...");

      const gameProject = this.transformToGameProject(
        { plan, drafts, report },
        characters,
        scenes || [],
        worldSetting,
        themeSetting
      );

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      progressEmitter.stageComplete("finalizing", "剧本生成完成", 
        `用时 ${totalTime}s，生成了 ${gameProject.script.length} 个场景节点`, {
        nodeCount: gameProject.script.length,
        score: report.overallScore,
      });

      progressEmitter.stageComplete("completed", "全部完成", 
        `剧本 "${gameProject.title}" 生成成功！评分: ${report.overallScore}`, {
        score: report.overallScore,
      });

      return gameProject;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      progressEmitter.stageFailed("failed", "生成失败", errorMessage);
      throw error;
    }
  }

  /**
   * 快速验证规划结构
   */
  private quickValidatePlan(plan: NarrativePlan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 检查 START 节点
    const startNodes = plan.nodes.filter(n => n.isStart);
    if (startNodes.length !== 1) {
      errors.push(`需要恰好 1 个 START 节点，当前有 ${startNodes.length} 个`);
    }
    
    // 检查 ENDING 节点
    const endingNodes = plan.nodes.filter(n => n.isEnding);
    if (endingNodes.length < 2) {
      errors.push(`需要至少 2 个 ENDING 节点，当前有 ${endingNodes.length} 个`);
    }
    
    // 检查节点引用
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
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * 拓扑排序：按 BFS 深度分层
   */
  private topologicalSort(nodes: NarrativePlan["nodes"]) {
    const layers: (typeof nodes)[] = [];
    const visited = new Set<string>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const startNode = nodes.find(n => n.isStart);
    if (!startNode) return [nodes];

    let currentLayer = [startNode];
    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      currentLayer.forEach(n => visited.add(n.id));

      const nextLayer: typeof nodes = [];
      currentLayer.forEach(node => {
        if (node.nextNodeId && !visited.has(node.nextNodeId)) {
          const next = nodeMap.get(node.nextNodeId);
          if (next && !nextLayer.some(n => n.id === next.id)) {
            nextLayer.push(next);
          }
        }
        node.choicesMeta?.forEach(choice => {
          if (!visited.has(choice.leadsTo)) {
            const next = nodeMap.get(choice.leadsTo);
            if (next && !nextLayer.some(n => n.id === next.id)) {
              nextLayer.push(next);
            }
          }
        });
      });

      currentLayer = nextLayer;
    }

    const orphans = nodes.filter(n => !visited.has(n.id));
    if (orphans.length > 0) {
      layers.push(orphans);
    }

    return layers;
  }

  /**
   * 获取前序节点摘要
   */
  private getPreviousSummary(
    node: NarrativePlan["nodes"][number],
    allNodes: NarrativePlan["nodes"],
    drafts: Record<string, NodeDraft>
  ): string | undefined {
    for (const n of allNodes) {
      if (n.nextNodeId === node.id) {
        return drafts[n.id]?.summary;
      }
      if (n.choicesMeta?.some(c => c.leadsTo === node.id)) {
        return drafts[n.id]?.summary;
      }
    }
    return undefined;
  }

  /**
   * 构建 Story Planner 的提示词
   * 详细说明 Tree-of-Thoughts (ToT) 方法的执行步骤
   */
  private buildPlannerPrompt(inputData: WorkflowInput): string {
    return `## 你的任务
设计一个非线性视觉小说的**故事结构骨架**（只规划结构，不写对话）。

## 世界观设定
${JSON.stringify(inputData.worldBible, null, 2)}

## 角色档案
${JSON.stringify(inputData.characterDB, null, 2)}

## 风格指南
${JSON.stringify(inputData.styleGuide || {}, null, 2)}

## 约束条件
- 目标节点数: ${inputData.constraints?.targetNodeCount || 12}
- 目标结局数: ${inputData.constraints?.targetEndingCount || 3}

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

请按照上述步骤思考，然后输出符合 NarrativePlan 格式的 JSON。`;
  }
}

// 导出单例
export const gameGeneratorAgent = new GameGeneratorAgent();

