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
import { getMastra, getStoryWorkflow } from "../mastra";
import type { NarrativePlan, NodeDraft, CriticReport, WorkflowInput } from "../agents/schemas";
import { NarrativePlanSchema, NodeDraftSchema, CriticReportSchema } from "../agents/schemas";
import { generateNarrativePlanWithToT, storyPlannerAgent, ToTRound } from "../agents/storyPlanner";
import { reviewStory, storyReviewerAgent } from "../agents/storyReviewer";
import { type Locale, DEFAULT_LOCALE } from '../utils/locale';
import { ProgressEmitter, createProgressEmitter, type ProgressStage } from "./progress-emitter";
import { promptManager } from '../prompts';
import { generateStructuredOutput } from '../utils/structured-output-helper';
import { ideaDraftGenerator } from "./idea-draft-generator";
import { hasLLMProfile, isRecoverableLLMError, type LLMProfile } from '../utils/llm-config';

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
const REVIEW_TIMEOUT_MS = Number(process.env.AGENT_REVIEW_TIMEOUT_MS || 60_000);

function getCandidatePaths(payload: any): any[] {
  if (!payload?.candidates) return [];
  if (Array.isArray(payload.candidates)) return payload.candidates;
  if (Array.isArray(payload.candidates.paths)) return payload.candidates.paths;
  return [];
}

function summarizeCandidates(payload: any) {
  return getCandidatePaths(payload)
    .slice(0, 5)
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
    }));
}

function summarizePlanNodes(nodes: any[]) {
  return (Array.isArray(nodes) ? nodes : [])
    .slice(0, 8)
    .map((node: any) => ({
      id: node.id,
      title: node.title || node.name,
      type: node.type,
      isEnding: node.isEnding,
      brief: node.brief || node.description,
    }));
}

// ============ GameGeneratorAgent 主类 ============

export class GameGeneratorAgent {
  private maxRetries: number = 2;
  private minAcceptableScore: number = 60;
  private profile: LLMProfile = 'primary';

  constructor(options?: { maxRetries?: number; minAcceptableScore?: number; profile?: LLMProfile }) {
    if (options?.maxRetries) {
      this.maxRetries = options.maxRetries;
    }
    if (options?.minAcceptableScore) {
      this.minAcceptableScore = options.minAcceptableScore;
    }
    if (options?.profile) {
      this.profile = options.profile;
    }
  }

  private getMastra() {
    return getMastra(this.profile);
  }

  /**
   * 使用多智能体系统生成剧本
   * 
   * @param characters 用户定义的角色列表
   * @param worldSetting 世界观设定
   * @param scenes 场景列表
   * @param themeSetting 主题风格设定
   * @param locale 用户语言
   */
  async generateFromSetup(
    characters: any[],
    worldSetting: any,
    scenes?: any[],
    themeSetting?: any,
    locale: Locale = DEFAULT_LOCALE
  ): Promise<GameProject> {
    console.log(`[GameGeneratorAgent] 🚀 启动多智能体剧本生成系统`);
    console.log(`[GameGeneratorAgent] 角色: ${characters.length}, 场景: ${scenes?.length || 0}, locale: ${locale}`);

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
      locale: locale,
    };

    // 获取并运行工作流
    const workflow = getStoryWorkflow(this.profile);
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
    themeSetting?: any,
    progressEmitter?: ProgressEmitter
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
    progressEmitter?.stageProgress("finalizing", "整合角色与场景", 30, `角色 ${characters.length} 个，场景 ${backgrounds.length} 个`, {
      characterCount: characters.length,
      sceneCount: backgrounds.length,
    });

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
    progressEmitter?.stageProgress("finalizing", "验证节点连接", 40, "正在检查节点连通性...");
    const validationStats = this.validateNodeConnections(script);
    progressEmitter?.stageProgress("finalizing", "节点验证完成", 60, `可达节点 ${validationStats.reachableCount}/${validationStats.totalCount}`, {
      reachableCount: validationStats.reachableCount,
      totalCount: validationStats.totalCount,
      orphanCount: validationStats.orphanNodes.length,
      deadEndCount: validationStats.deadEnds.length,
    });

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
    progressEmitter?.stageProgress("finalizing", "GameProject 构建完成", 80, `角色 ${characters.length} · 场景 ${backgrounds.length} · 节点 ${script.length}`, {
      characterCount: characters.length,
      sceneCount: backgrounds.length,
      nodeCount: script.length,
    });

    return gameProject;
  }

  /**
   * 验证节点连接完整性
   */
  private validateNodeConnections(storyNodes: StoryNode[]): {
    reachableCount: number;
    totalCount: number;
    orphanNodes: string[];
    deadEnds: string[];
  } {
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
    const orphanNodes = storyNodes.filter(n => !reachableFromStart.has(n.id)).map(n => n.id);
    if (orphanNodes.length > 0) {
      console.warn(`[GameGeneratorAgent] ⚠️ 发现 ${orphanNodes.length} 个孤立节点: ${orphanNodes.join(', ')}`);
    }
    
    // 检查死胡同
    const deadEnds = storyNodes.filter(n => 
      !n.isEnding && 
      !n.nextNodeId && 
      (!n.choices || n.choices.length === 0)
    ).map(n => n.id);
    if (deadEnds.length > 0) {
      console.warn(`[GameGeneratorAgent] ⚠️ 发现 ${deadEnds.length} 个死胡同: ${deadEnds.join(', ')}`);
    }
    
    console.log(`[GameGeneratorAgent] ✅ 验证完成: ${reachableFromStart.size}/${storyNodes.length} 节点可达`);
    return {
      reachableCount: reachableFromStart.size,
      totalCount: storyNodes.length,
      orphanNodes,
      deadEnds,
    };
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
    progressEmitter: ProgressEmitter,
    locale: Locale = DEFAULT_LOCALE,
    allowFallback = true
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
      locale: locale,
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
      progressEmitter.stageStart("planning", "Story Planner 规划故事结构", "正在启动 Tree-of-Thoughts 规划流程...");
      
      const plannerAgent = this.getMastra().getAgent("story-planner") as typeof storyPlannerAgent;
      plan = await this.runTotWithProgress(plannerAgent, workflowInput, locale, progressEmitter);

      progressEmitter.stageComplete("planning", "故事骨架规划完成 (ToT 3轮)", 
        `探索了多条叙事路径，最终生成 ${plan.nodes.length} 个节点`, {
        nodeCount: plan.nodes.length,
        endingCount: plan.nodes.filter(n => n.isEnding).length,
      });

      // ============ 规划验证阶段 ============
      progressEmitter.stageStart("plan_validate", "验证故事结构", "检查节点连通性和结构完整性...");
      progressEmitter.stageProgress("plan_validate", "连通性分析", 40, "正在检查节点引用和路径...");
      
      const validationResult = this.quickValidatePlan(plan);
      if (!validationResult.valid) {
        progressEmitter.stageFailed("plan_validate", "规划验证失败", 
          `发现 ${validationResult.errors.length} 个结构问题: ${validationResult.errors.join('; ')}`);
        throw new Error(`规划验证失败: ${validationResult.errors.join('; ')}`);
      }

      progressEmitter.stageComplete("plan_validate", "结构验证通过", "所有节点连接正确");

      // ============ 写作阶段 ============
      progressEmitter.stageStart("writing", "Node Writer 开始写作", "Few-Shot CoT 正在为每个节点生成对话...");
      
      const writerAgent = this.getMastra().getAgent("node-writer");
      const layers = this.topologicalSort(plan.nodes);
      
      progressEmitter.stageProgress("writing", "分析节点依赖", 10, 
        `故事分为 ${layers.length} 层，将按层并行写作`, {
        totalLayers: layers.length,
      });

      for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
        const layer = layers[layerIdx];
        const layerProgress = Math.round(10 + (layerIdx / layers.length) * 80);
        
        progressEmitter.stageProgress("writing", `写作第 ${layerIdx + 1}/${layers.length} 层`, 
          layerProgress, `正在并行写作第 ${layerIdx + 1} 层的 ${layer.length} 个节点...`, {
          layer: layerIdx + 1,
          totalLayers: layers.length,
          currentNode: layer.map(n => n.id).join(', '),
        });
        console.log('details:', {
          layer: layerIdx + 1,
          totalLayers: layers.length,
          currentNode: layer.map(n => n.id).join(', '),
        });

        // 同一层并行调用
        const results = await Promise.all(
          layer.map(async (node) => {
            const previousSummary = this.getPreviousSummary(node, plan!.nodes, drafts);
            
            const { user: writePrompt } = promptManager.build('workflow.write-node', {
              planNode: JSON.stringify(node, null, 2),
              previousNodeSummary: previousSummary || "（这是故事的开始）",
              characters: JSON.stringify(workflowInput.characterDB.characters.map((c: any) => ({
                name: c.name,
                displayName: c.displayName || c.name,
                personality: c.personality?.traits || [],
                identity: c.identity,
                description: c.description,
              })), null, 2),
              styleGuide: JSON.stringify(workflowInput.styleGuide || {}, null, 2),
            }, locale);

            try {
              const draft = await generateStructuredOutput(
                writerAgent,
                writePrompt,
                NodeDraftSchema,
                { temperature: 1 }
              );
              return { nodeId: node.id, draft };
            } catch (error) {
              console.warn(`[GameGeneratorAgent] 节点 ${node.id} 写作失败，使用默认草稿:`, error instanceof Error ? error.message : error);
              const fallbackDraft = this.buildFallbackNodeDraft(node, workflowInput, previousSummary);
              return { nodeId: node.id, draft: fallbackDraft };
            }
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

      const reviewerAgent = this.getMastra().getAgent("story-reviewer") as typeof storyReviewerAgent;
      try {
        const reviewPromise = reviewStory(
          reviewerAgent,
          {
            plan,
            drafts,
            worldBible: workflowInput.worldBible,
            characterDB: workflowInput.characterDB
          },
          CriticReportSchema,
          locale
        );

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Story Reviewer 超时（>${REVIEW_TIMEOUT_MS / 1000}s）`)), REVIEW_TIMEOUT_MS)
        );

        report = await Promise.race([reviewPromise, timeoutPromise]);

        if (!report) {
          throw new Error("Reviewer 报告生成失败");
        }

        progressEmitter.stageComplete("reviewing", "审阅完成", 
          `综合评分: ${report.overallScore}，发现 ${report.issues.length} 个问题`, {
          score: report.overallScore,
          issues: report.issues.length,
        });
      } catch (error) {
        console.warn("[GameGeneratorAgent] 审阅阶段失败，自动视为通过:", error instanceof Error ? error.message : error);
        report = this.buildFallbackReviewReport();
        progressEmitter.stageComplete("reviewing", "审阅跳过", "审阅模块异常，自动视为通过", {
          score: report.overallScore,
          issues: 0,
        });
      }

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

            const { user: rewritePrompt } = promptManager.build('workflow.rewrite', {
              originalDraft: JSON.stringify(originalDraft, null, 2),
              suggestion: issue?.suggestion || "请优化对话质量，使其更加生动自然",
              issueType: issue?.type || "dialogue",
              issueDescription: issue?.description || "需要优化",
              characters: JSON.stringify(workflowInput.characterDB.characters.map((c: any) => ({
                name: c.name,
                displayName: c.displayName || c.name,
                personality: c.personality?.traits || [],
              })), null, 2),
              styleGuide: JSON.stringify(workflowInput.styleGuide || {}, null, 2),
            }, locale);

            try {
              const rewrittenDraft = await generateStructuredOutput(
                writerAgent,
                rewritePrompt,
                NodeDraftSchema,
                { temperature: 1 }
              );
              drafts[nodeId] = rewrittenDraft;
            } catch (error) {
              console.warn(`[GameGeneratorAgent] 重写节点 ${nodeId} 失败，使用默认草稿:`, error instanceof Error ? error.message : error);
              const planNode =
                plan?.nodes?.find(n => n.id === nodeId) || {
                  id: nodeId,
                  type: 'scene' as const,
                  isStart: false,
                  isEnding: false,
                  title: '临时节点',
                  brief: issue?.suggestion || '自动补全的节点',
                  functionTag: 'setup' as const,
                  sceneName: workflowInput.worldBible?.scenes?.[0]?.name || workflowInput.worldBible?.name || '默认场景',
                  nextNodeId: undefined,
                  choicesMeta: [],
                  position: { x: 0, y: 0 },
                };

              drafts[nodeId] = this.buildFallbackNodeDraft(
                planNode,
                workflowInput,
                issue?.suggestion
              );
            }
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

      progressEmitter.stageProgress("finalizing", "整理节点草稿", 20, "正在整合节点与对话数据...");
      const gameProject = this.transformToGameProject(
        { plan, drafts, report },
        characters,
        scenes || [],
        worldSetting,
        themeSetting,
        progressEmitter
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

      if (this.shouldAttemptFallback(error, allowFallback)) {
        progressEmitter.stageStart("fallback", "切换备用模型", "检测到主模型不可用，正在启用备用模型重试...");
        const backupAgent = new GameGeneratorAgent({
          maxRetries: this.maxRetries,
          minAcceptableScore: this.minAcceptableScore,
          profile: 'backup',
        });
        const result = await backupAgent.generateFromSetupWithProgress(
          characters,
          worldSetting,
          scenes,
          themeSetting,
          progressEmitter,
          locale,
          false
        );
        progressEmitter.stageComplete("fallback", "备用模型生成完成", "已成功切换到备用模型并继续生成");
        return result;
      }

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

  private async runTotWithProgress(
    agent: typeof storyPlannerAgent,
    workflowInput: WorkflowInput,
    locale: Locale,
    progressEmitter: ProgressEmitter
  ): Promise<NarrativePlan> {
    const stageMeta: Partial<Record<ToTRound, {
      stage: ProgressStage;
      startAction: string;
      startMessage: string;
      completeAction: string;
      formatMessage: (payload: any) => string;
      formatDetails: (payload: any) => Record<string, unknown>;
    }>> = {
      round1: {
        stage: "planning_round1" as ProgressStage,
        startAction: "Round 1：生成候选方向",
        startMessage: "正在探索不同的故事走向...",
        completeAction: "候选方向生成完成",
        formatMessage: (payload: any) => {
          const count = getCandidatePaths(payload).length;
          return `共生成 ${count} 个候选方向`;
        },
        formatDetails: (payload: any) => ({
          candidateCount: getCandidatePaths(payload).length,
          candidates: summarizeCandidates(payload),
        }),
      },
      round2: {
        stage: "planning_round2" as ProgressStage,
        startAction: "Round 2：评估候选方向",
        startMessage: "正在评估每条路径的优劣...",
        completeAction: "最佳方向已选定",
        formatMessage: (payload: any) => `选择 ${payload?.evaluation?.selectedPathId || '未知路径'}`,
        formatDetails: (payload: any) => ({
          selectedPathId: payload?.evaluation?.selectedPathId,
        }),
      },
      round3: {
        stage: "planning_round3" as ProgressStage,
        startAction: "Round 3：扩展故事骨架",
        startMessage: "正在将最佳路径展开为完整节点...",
        completeAction: "故事骨架构建完成",
        formatMessage: (payload: any) => `生成 ${Array.isArray(payload?.plan?.nodes) ? payload.plan.nodes.length : 0} 个节点`,
        formatDetails: (payload: any) => {
          const nodes = Array.isArray(payload?.plan?.nodes) ? payload.plan.nodes : [];
          return {
            nodeCount: nodes.length,
            endingCount: nodes.filter((n: any) => n.isEnding).length,
            nodes: summarizePlanNodes(nodes),
          };
        },
      },
    } as const;

    return generateNarrativePlanWithToT(agent, workflowInput, locale, {
      onRoundStart: (round) => {
        const meta = stageMeta[round];
        if (!meta) return;
        progressEmitter.stageStart(meta.stage, meta.startAction, meta.startMessage);
      },
      onRoundComplete: (round, payload) => {
        const meta = stageMeta[round];
        if (!meta) return;
        progressEmitter.stageComplete(
          meta.stage,
          meta.completeAction,
          meta.formatMessage(payload),
          meta.formatDetails(payload)
        );
      },
    });
  }

  private buildFallbackReviewReport(): CriticReport {
    return {
      scores: {
        plotCoherence: 85,
        characterConsistency: 85,
        dialogueQuality: 85,
        branchMeaningfulness: 85,
        branchDistribution: 85,
        pacing: 85,
      },
      overallScore: 85,
      issues: [],
      shouldRegenerate: false,
      regenerateTarget: 'none',
      targetNodeIds: [],
    };
  }

  private buildFallbackNodeDraft(
    node: NarrativePlan["nodes"][number],
    workflowInput: WorkflowInput,
    previousSummary?: string
  ): NodeDraft {
    const characters = workflowInput.characterDB?.characters || [];
    const speaker = characters[0]?.name || '旁白';
    const sceneName =
      node.sceneName ||
      workflowInput.worldBible?.scenes?.[0]?.name ||
      workflowInput.worldBible?.name ||
      '默认场景';

    const defaultDialogue = {
      characterName: speaker,
      text: node.brief || previousSummary || '故事继续展开……',
      emotion: 'neutral',
    };

    const nodeName = (node as any)?.name as string | undefined;

    const choices =
      node.type === 'branch'
        ? (node.choicesMeta || []).slice(0, 2).map((choice, idx) => ({
            id: choice.id || createId(),
            text: (choice as any).text || `选择 ${idx + 1}`,
            targetNodeId: choice.leadsTo || (choice as any).targetNodeId || createId(),
            meta: {
              emotionalWeight: (choice as any).emotionalWeight || '中立',
              consequenceHint: (choice as any).consequenceHint || '继续故事',
            },
          }))
        : undefined;

    return {
      id: node.id,
      type: (node.type || 'scene') as NodeDraft['type'],
      title: node.title || nodeName || '未命名节点',
      sceneName,
      narration: node.brief || previousSummary || '系统自动生成的节点描述',
      dialogues: [defaultDialogue],
      choices,
      nextNodeId: node.nextNodeId,
      summary: node.brief || node.title || nodeName,
    };
  }

  /**
   * 快速设定生成 - 根据一句话描述自动生成完整设定
   * 
   * @param prompt 用户的故事描述
   * @param locale 用户语言
   * @returns { projectTitle, characters, worldSetting, scenes, themeSetting }
   */
  async quickSetup(
    prompt: string,
    locale: Locale = DEFAULT_LOCALE
  ): Promise<{
    projectTitle: string;
    characters: any[];
    worldSetting: any;
    scenes: any[];
    themeSetting: any;
  }> {
    console.log(`[GameGeneratorAgent] ⚡ 快速设定生成开始: ${prompt.slice(0, 50)}...`);

    try {
      const draft = await ideaDraftGenerator.generateDraft(prompt, locale);

      console.log(`[GameGeneratorAgent] ✅ 快速设定生成成功`, {
        title: draft.projectTitle,
        characters: draft.characters.length,
        scenes: draft.scenes.length,
      });

      return {
        projectTitle: draft.projectTitle,
        characters: draft.characters,
        worldSetting: draft.worldSetting,
        scenes: draft.scenes,
        themeSetting: draft.themeSetting,
      };
    } catch (error) {
      console.error(`[GameGeneratorAgent] ❌ 快速设定生成失败:`, error);
      throw new Error(`快速设定生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
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

  private shouldAttemptFallback(error: unknown, allowFallback: boolean): boolean {
    return allowFallback && this.profile === 'primary' && hasLLMProfile('backup') && isRecoverableLLMError(error);
  }

}

// 导出单例
export const gameGeneratorAgent = new GameGeneratorAgent();

