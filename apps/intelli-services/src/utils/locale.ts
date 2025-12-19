/**
 * 语言工具函数
 */

export type Locale = 'zh-CN' | 'zh-HK' | 'en-US';

export const DEFAULT_LOCALE: Locale = 'zh-CN';
export const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'zh-HK', 'en-US'];

/**
 * 获取语言名称
 */
export function getLocaleName(locale: Locale): string {
  const names: Record<Locale, string> = {
    'zh-CN': '简体中文',
    'zh-HK': '繁體中文',
    'en-US': 'English',
  };
  return names[locale] || locale;
}

/**
 * 构建语言提示，添加到prompt中
 * @param locale 用户语言
 * @returns 语言提示字符串
 */
export function buildLocalePrompt(locale: Locale = DEFAULT_LOCALE): string {
  const localeName = getLocaleName(locale);
  
  if (isEnglish(locale)) {
    return `\n\n**IMPORTANT**: The user's language is ${locale} (${localeName}). You MUST use ${localeName} for ALL generated content, including dialogue, narration, descriptions, names, titles, and any other text. DO NOT use Chinese characters or any other language. All output must be in English.`;
  }
  
  return `\n\n重要提示：用户的语言是 ${locale} (${localeName})，请使用 ${localeName} 进行创作和回答。所有生成的内容（包括对话、旁白、描述等）都必须使用 ${localeName}。`;
}

const getTodayDatePrompt = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `\nToday is ${year}-${month}-${day}.`;
}

/**
 * 在system prompt中添加语言提示
 * @param systemPrompt 原始system prompt
 * @param locale 用户语言
 * @returns 添加了语言提示的system prompt
 */
export function addLocaleToSystemPrompt(systemPrompt: string, locale: Locale = DEFAULT_LOCALE): string {

  return systemPrompt + buildLocalePrompt(locale) + getTodayDatePrompt();
}

/**
 * 在user prompt中添加语言提示
 * @param userPrompt 原始user prompt
 * @param locale 用户语言
 * @returns 添加了语言提示的user prompt
 */
export function addLocaleToUserPrompt(userPrompt: string, locale: Locale = DEFAULT_LOCALE): string {
  
  return userPrompt + buildLocalePrompt(locale) + getTodayDatePrompt();
}

/**
 * 从请求中获取locale
 * @param localeParam URL参数或请求体中的locale
 * @returns 有效的locale
 */
export function getLocaleFromRequest(localeParam?: string | null): Locale {
  if (localeParam && SUPPORTED_LOCALES.includes(localeParam as Locale)) {
    return localeParam as Locale;
  }
  return DEFAULT_LOCALE;
}

/**
 * 判断是否为英文语言环境
 */
export function isEnglish(locale: Locale): boolean {
  return locale === 'en-US';
}

/**
 * 智能体进度消息的国际化映射
 */
type ProgressMessageKey = 
  | 'system_started'
  | 'init_system'
  | 'init_system_detail'
  | 'init_complete'
  | 'init_loaded'
  | 'characters_count'
  | 'scenes_count'
  | 'planning_start'
  | 'planning_detail'
  | 'planning_round1_start'
  | 'planning_round1_detail'
  | 'planning_round1_complete'
  | 'planning_round1_count'
  | 'planning_round1_count_suffix'
  | 'planning_round2_start'
  | 'planning_round2_detail'
  | 'planning_round2_complete'
  | 'planning_round2_selected'
  | 'planning_round3_start'
  | 'planning_round3_detail'
  | 'planning_round3_complete'
  | 'planning_round3_generated'
  | 'planning_round3_nodes'
  | 'planning_complete'
  | 'planning_explored'
  | 'plan_validate_start'
  | 'plan_validate_detail'
  | 'plan_validate_checking'
  | 'plan_validate_complete'
  | 'plan_validate_all_correct'
  | 'writing_start'
  | 'writing_detail'
  | 'writing_layer'
  | 'writing_complete'
  | 'writing_completed_count'
  | 'writing_completed_suffix'
  | 'reviewing_start'
  | 'reviewing_detail'
  | 'reviewing_complete'
  | 'reviewing_score'
  | 'reviewing_issues'
  | 'reviewing_issues_suffix'
  | 'rewriting_node'
  | 'rewriting_complete'
  | 'rewriting_count'
  | 'rewriting_count_suffix'
  | 'finalizing_start'
  | 'finalizing_detail'
  | 'finalizing_integrate'
  | 'finalizing_validate'
  | 'finalizing_validate_detail'
  | 'finalizing_complete'
  | 'finalizing_time'
  | 'finalizing_generated'
  | 'finalizing_scenes'
  | 'all_complete'
  | 'script_generated'
  | 'script_success'
  | 'fallback_start'
  | 'fallback_detail'
  | 'generation_aborted'
  | 'generation_aborted_detail';

const PROGRESS_MESSAGES: Record<ProgressMessageKey, Record<'zh' | 'en', string>> = {
  system_started: {
    zh: '多智能体剧本生成系统已启动',
    en: 'Multi-Agent Script Generation System Started',
  },
  init_system: {
    zh: '初始化智能体系统',
    en: 'Initialize Agent System',
  },
  init_system_detail: {
    zh: '正在初始化多智能体剧本生成系统...',
    en: 'Initializing multi-agent script generation system...',
  },
  planning_start: {
    zh: 'Story Planner 规划故事结构',
    en: 'Story Planner: Planning Story Structure',
  },
  planning_detail: {
    zh: '正在启动 Tree-of-Thoughts 规划流程...',
    en: 'Starting Tree-of-Thoughts planning process...',
  },
  planning_round1_start: {
    zh: 'Round 1：生成候选方向',
    en: 'Round 1: Generate Candidate Directions',
  },
  planning_round1_detail: {
    zh: '正在探索不同的故事走向...',
    en: 'Exploring different story directions...',
  },
  planning_round2_start: {
    zh: 'Round 2：评估候选方向',
    en: 'Round 2: Evaluate Candidates',
  },
  planning_round2_detail: {
    zh: '正在评估每条路径的优劣...',
    en: 'Evaluating each story path...',
  },
  planning_round3_start: {
    zh: 'Round 3：扩展故事骨架',
    en: 'Round 3: Expand Story Skeleton',
  },
  planning_round3_detail: {
    zh: '正在将最佳路径展开为完整节点...',
    en: 'Expanding the best path into complete nodes...',
  },
  plan_validate_start: {
    zh: '验证故事结构',
    en: 'Validate Story Structure',
  },
  plan_validate_detail: {
    zh: '检查节点连通性和结构完整性...',
    en: 'Checking node connectivity and structural integrity...',
  },
  plan_validate_checking: {
    zh: '正在检查节点引用和路径...',
    en: 'Checking node references and paths...',
  },
  writing_start: {
    zh: 'Node Writer 开始写作',
    en: 'Node Writer: Start Writing',
  },
  writing_detail: {
    zh: 'Few-Shot CoT 正在为每个节点生成对话...',
    en: 'Few-Shot CoT generating dialogues for each node...',
  },
  writing_layer: {
    zh: '正在并行写作',
    en: 'Writing in parallel',
  },
  reviewing_start: {
    zh: 'Story Reviewer 审阅故事',
    en: 'Story Reviewer: Review Story',
  },
  reviewing_detail: {
    zh: 'ReAct 模式正在使用工具分析故事质量...',
    en: 'ReAct mode analyzing story quality with tools...',
  },
  rewriting_node: {
    zh: '正在重写节点',
    en: 'Rewriting node',
  },
  finalizing_start: {
    zh: '构建最终剧本',
    en: 'Build Final Script',
  },
  finalizing_detail: {
    zh: '正在将故事转换为 GameProject 格式...',
    en: 'Converting story to GameProject format...',
  },
  finalizing_integrate: {
    zh: '正在整合节点与对话数据...',
    en: 'Integrating nodes and dialogue data...',
  },
  finalizing_validate: {
    zh: '验证节点连接',
    en: 'Validate Node Connections',
  },
  finalizing_validate_detail: {
    zh: '正在检查节点连通性...',
    en: 'Checking node connectivity...',
  },
  fallback_start: {
    zh: '切换备用模型',
    en: 'Switch to Backup Model',
  },
  fallback_detail: {
    zh: '检测到主模型不可用，正在启用备用模型重试...',
    en: 'Main model unavailable, enabling backup model for retry...',
  },
  generation_aborted: {
    zh: '用户中断',
    en: 'User Aborted',
  },
  generation_aborted_detail: {
    zh: '生成已被用户中断',
    en: 'Generation aborted by user',
  },
  init_complete: {
    zh: '初始化完成',
    en: 'Initialization Complete',
  },
  init_loaded: {
    zh: '已加载',
    en: 'Loaded',
  },
  characters_count: {
    zh: '个角色',
    en: 'characters',
  },
  scenes_count: {
    zh: '个场景',
    en: 'scenes',
  },
  planning_round1_complete: {
    zh: '候选方向生成完成',
    en: 'Candidate Directions Generated',
  },
  planning_round1_count: {
    zh: '共生成',
    en: 'Generated',
  },
  planning_round1_count_suffix: {
    zh: '个候选方向',
    en: 'candidate directions',
  },
  planning_round2_complete: {
    zh: '最佳方向已选定',
    en: 'Best Direction Selected',
  },
  planning_round2_selected: {
    zh: '选择',
    en: 'Selected',
  },
  planning_round3_complete: {
    zh: '故事骨架构建完成',
    en: 'Story Skeleton Completed',
  },
  planning_round3_generated: {
    zh: '生成',
    en: 'Generated',
  },
  planning_round3_nodes: {
    zh: '个节点',
    en: 'nodes',
  },
  planning_complete: {
    zh: '故事骨架规划完成 (ToT 3轮)',
    en: 'Story Planning Complete (ToT 3 Rounds)',
  },
  planning_explored: {
    zh: '探索了多条叙事路径，最终生成',
    en: 'Explored multiple narrative paths, generated',
  },
  plan_validate_complete: {
    zh: '结构验证通过',
    en: 'Structure Validation Passed',
  },
  plan_validate_all_correct: {
    zh: '所有节点连接正确',
    en: 'All node connections are correct',
  },
  writing_complete: {
    zh: '所有节点写作完成',
    en: 'All Nodes Written',
  },
  writing_completed_count: {
    zh: '共完成',
    en: 'Completed',
  },
  writing_completed_suffix: {
    zh: '个节点的对话写作',
    en: 'node dialogues',
  },
  reviewing_complete: {
    zh: '审阅完成',
    en: 'Review Complete',
  },
  reviewing_score: {
    zh: '综合评分',
    en: 'Overall Score',
  },
  reviewing_issues: {
    zh: '发现',
    en: 'Found',
  },
  reviewing_issues_suffix: {
    zh: '个问题',
    en: 'issues',
  },
  rewriting_complete: {
    zh: '重写完成',
    en: 'Rewriting Complete',
  },
  rewriting_count: {
    zh: '已重写',
    en: 'Rewrote',
  },
  rewriting_count_suffix: {
    zh: '个节点',
    en: 'nodes',
  },
  finalizing_complete: {
    zh: '剧本生成完成',
    en: 'Script Generation Complete',
  },
  finalizing_time: {
    zh: '用时',
    en: 'Time',
  },
  finalizing_generated: {
    zh: '生成了',
    en: 'Generated',
  },
  finalizing_scenes: {
    zh: '个场景节点',
    en: 'scene nodes',
  },
  all_complete: {
    zh: '全部完成',
    en: 'All Complete',
  },
  script_generated: {
    zh: '剧本',
    en: 'Script',
  },
  script_success: {
    zh: '生成成功！评分',
    en: 'generated successfully! Score',
  },
};

/**
 * 获取进度消息（支持国际化）
 * @param key 消息键
 * @param locale 语言
 * @returns 国际化后的消息
 */
export function getProgressMessage(key: ProgressMessageKey, locale: Locale = DEFAULT_LOCALE): string {
  const messages = PROGRESS_MESSAGES[key];
  if (!messages) return key;
  
  return isEnglish(locale) ? messages.en : messages.zh;
}

/**
 * 获取格式化的进度消息（支持插值）
 * @example getProgressMessageF('writing_layer', 'en-US', { layer: 1, total: 3, count: 5 })
 */
export function getProgressMessageF(
  key: ProgressMessageKey, 
  locale: Locale,
  params?: Record<string, any>
): string {
  const base = getProgressMessage(key, locale);
  
  if (!params) return base;
  
  // 特殊处理某些带参数的消息
  if (key === 'writing_layer' && params.layer && params.total && params.count) {
    return isEnglish(locale)
      ? `${base} Layer ${params.layer}/${params.total} (${params.count} nodes)...`
      : `${base}第 ${params.layer}/${params.total} 层的 ${params.count} 个节点...`;
  }
  
  if (key === 'rewriting_node' && params.index && params.total) {
    return isEnglish(locale)
      ? `${base} ${params.index}/${params.total}...`
      : `${base}第 ${params.index}/${params.total} 个节点...`;
  }
  
  return base;
}

