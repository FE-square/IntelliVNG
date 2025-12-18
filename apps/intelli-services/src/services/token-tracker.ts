/**
 * Token 使用追踪服务
 * 
 * 统一追踪所有 LLM 调用的 Token 消耗，包括:
 * - Mastra Agent 调用
 * - 直接 OpenAI SDK 调用
 * - 其他 LLM API 调用
 * 
 * 支持文件持久化，数据存储在 .cache/token-stats.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), '.cache');
const TOKEN_STATS_FILE = join(CACHE_DIR, 'token-stats.json');

// 确保缓存目录存在
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TokenRecord {
  id: string;
  timestamp: number;
  source: 'mastra-agent' | 'openai-sdk' | 'anthropic-sdk' | 'other';
  model: string;
  agentName?: string;
  operation?: string;
  usage: TokenUsage;
  metadata?: Record<string, any>;
}

/** 图像生成记录 */
export interface ImageRecord {
  id: string;
  timestamp: number;
  model: string;
  imageType: 'sprite' | 'avatar' | 'background';
  cost: number; // 单位：元
  metadata?: Record<string, any>;
}

/** 图像费用汇总 */
export interface ImageCostSummary {
  totalCost: number;
  totalCount: number;
  byType: Record<string, { count: number; cost: number }>;
  byModel: Record<string, { count: number; cost: number }>;
  records: ImageRecord[];
}

export interface TokenSummary {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  callCount: number;
  bySource: Record<string, TokenUsage & { count: number }>;
  byModel: Record<string, TokenUsage & { count: number }>;
  byAgent: Record<string, TokenUsage & { count: number }>;
  records: TokenRecord[];
  // 图像费用统计
  imageCost?: ImageCostSummary;
}

/** 持久化数据结构 */
interface PersistedData {
  version: number;
  lastUpdated: string;
  globalRecords: TokenRecord[];
  sessionRecords: Record<string, TokenRecord[]>;
  imageRecords?: ImageRecord[];
}

/** 图像生成单价配置（元）- 来源：阿里云百炼平台官方定价 */
const IMAGE_COST_CONFIG: Record<string, number> = {
  // 文生图模型
  'wan2.2-t2i-flash': 0.14,       // 文生图 Flash（官方价格）
  'wan2.2-t2i-plus': 0.20,        // 文生图 Plus
  'wanx2.1-t2i-plus': 0.20,       // 文生图 V2.1 Plus
  'wanx2.1-t2i-turbo': 0.14,      // 文生图 V2.1 Turbo
  'wanx2.0-t2i-turbo': 0.04,      // 文生图 V2.0 Turbo
  'wanx-v1': 0.16,                // 文生图 V1
  'qwen-image-edit-plus': 0.20,   // 图生图 Plus
  'wanx2.1-imageedit': 0.14,      // 图生图 V2.1
  'default': 0.20,                // 默认价格
};

class TokenTracker {
  private records: Map<string, TokenRecord[]> = new Map();
  private globalRecords: TokenRecord[] = [];
  private imageRecords: ImageRecord[] = [];
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SAVE_DEBOUNCE_MS = 1000; // 1秒防抖
  
  constructor() {
    this.loadFromDisk();
  }
  
  /**
   * 从磁盘加载数据
   */
  private loadFromDisk(): void {
    try {
      if (existsSync(TOKEN_STATS_FILE)) {
        const data = readFileSync(TOKEN_STATS_FILE, 'utf-8');
        const parsed: PersistedData = JSON.parse(data);
        
        this.globalRecords = parsed.globalRecords || [];
        this.records = new Map(Object.entries(parsed.sessionRecords || {}));
        this.imageRecords = parsed.imageRecords || [];
        
        console.log(`[TokenTracker] 📂 Loaded ${this.globalRecords.length} token records, ${this.imageRecords.length} image records from disk`);
      }
    } catch (error) {
      console.error('[TokenTracker] ⚠️ Failed to load from disk:', error);
    }
  }
  
  /**
   * 保存数据到磁盘（防抖）
   */
  private saveToDisk(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    
    this.saveDebounceTimer = setTimeout(() => {
      this.saveToDiskImmediate();
    }, this.SAVE_DEBOUNCE_MS);
  }
  
  /**
   * 立即保存到磁盘
   */
  private saveToDiskImmediate(): void {
    try {
      const data: PersistedData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        globalRecords: this.globalRecords,
        sessionRecords: Object.fromEntries(this.records),
        imageRecords: this.imageRecords,
      };
      
      writeFileSync(TOKEN_STATS_FILE, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[TokenTracker] 💾 Saved ${this.globalRecords.length} token records, ${this.imageRecords.length} image records to disk`);
    } catch (error) {
      console.error('[TokenTracker] ⚠️ Failed to save to disk:', error);
    }
  }
  
  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `token-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 从 Mastra Agent 响应中提取 Token 使用信息
   */
  extractFromMastraResponse(response: any): TokenUsage | null {
    if (!response?.usage) return null;
    
    const usage = response.usage;
    
    // Mastra/AI SDK 可能使用不同的属性名
    return {
      promptTokens: usage.promptTokens || usage.prompt_tokens || usage.inputTokens || 0,
      completionTokens: usage.completionTokens || usage.completion_tokens || usage.outputTokens || 0,
      totalTokens: usage.totalTokens || usage.total_tokens || 
        ((usage.promptTokens || usage.prompt_tokens || usage.inputTokens || 0) + 
         (usage.completionTokens || usage.completion_tokens || usage.outputTokens || 0)),
    };
  }

  /**
   * 从 OpenAI SDK 响应中提取 Token 使用信息
   */
  extractFromOpenAIResponse(response: any): TokenUsage | null {
    if (!response?.usage) return null;
    
    const usage = response.usage;
    
    return {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
    };
  }

  /**
   * 从 Anthropic SDK 响应中提取 Token 使用信息
   */
  extractFromAnthropicResponse(response: any): TokenUsage | null {
    if (!response?.usage) return null;
    
    const usage = response.usage;
    
    return {
      promptTokens: usage.input_tokens || 0,
      completionTokens: usage.output_tokens || 0,
      totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
    };
  }

  /**
   * 记录 Token 使用
   */
  track(params: {
    sessionId?: string;
    source: TokenRecord['source'];
    model: string;
    agentName?: string;
    operation?: string;
    usage: TokenUsage;
    metadata?: Record<string, any>;
  }): TokenRecord {
    const record: TokenRecord = {
      id: this.generateId(),
      timestamp: Date.now(),
      source: params.source,
      model: params.model,
      agentName: params.agentName,
      operation: params.operation,
      usage: params.usage,
      metadata: params.metadata,
    };

    // 添加到全局记录
    this.globalRecords.push(record);

    // 如果有 sessionId，也添加到会话记录
    if (params.sessionId) {
      if (!this.records.has(params.sessionId)) {
        this.records.set(params.sessionId, []);
      }
      this.records.get(params.sessionId)!.push(record);
    }

    // 日志输出
    console.log(`[TokenTracker] 📊 ${params.source}/${params.model}${params.agentName ? `/${params.agentName}` : ''}: ${params.usage.promptTokens} + ${params.usage.completionTokens} = ${params.usage.totalTokens} tokens`);

    // 持久化到磁盘
    this.saveToDisk();

    return record;
  }

  /**
   * 快捷方法：追踪 Mastra Agent 调用
   */
  trackMastraAgent(params: {
    sessionId?: string;
    agentName: string;
    model: string;
    response: any;
    operation?: string;
    metadata?: Record<string, any>;
  }): TokenRecord | null {
    const usage = this.extractFromMastraResponse(params.response);
    if (!usage) {
      console.log(`[TokenTracker] ⚠️ Mastra Agent ${params.agentName} 响应中没有 usage 信息`);
      return null;
    }

    return this.track({
      sessionId: params.sessionId,
      source: 'mastra-agent',
      model: params.model,
      agentName: params.agentName,
      operation: params.operation,
      usage,
      metadata: params.metadata,
    });
  }

  /**
   * 快捷方法：追踪 OpenAI SDK 调用
   */
  trackOpenAI(params: {
    sessionId?: string;
    model: string;
    response: any;
    operation?: string;
    metadata?: Record<string, any>;
  }): TokenRecord | null {
    const usage = this.extractFromOpenAIResponse(params.response);
    if (!usage) {
      console.log(`[TokenTracker] ⚠️ OpenAI ${params.model} 响应中没有 usage 信息`);
      return null;
    }

    return this.track({
      sessionId: params.sessionId,
      source: 'openai-sdk',
      model: params.model,
      operation: params.operation,
      usage,
      metadata: params.metadata,
    });
  }

  /**
   * 快捷方法：追踪 Anthropic SDK 调用
   */
  trackAnthropic(params: {
    sessionId?: string;
    model: string;
    response: any;
    operation?: string;
    metadata?: Record<string, any>;
  }): TokenRecord | null {
    const usage = this.extractFromAnthropicResponse(params.response);
    if (!usage) {
      console.log(`[TokenTracker] ⚠️ Anthropic ${params.model} 响应中没有 usage 信息`);
      return null;
    }

    return this.track({
      sessionId: params.sessionId,
      source: 'anthropic-sdk',
      model: params.model,
      operation: params.operation,
      usage,
      metadata: params.metadata,
    });
  }

  /**
   * 追踪图像生成费用
   */
  trackImageGeneration(params: {
    model: string;
    imageType: 'sprite' | 'avatar' | 'background';
    metadata?: Record<string, any>;
  }): ImageRecord {
    const cost = IMAGE_COST_CONFIG[params.model] ?? IMAGE_COST_CONFIG['default'];
    
    const record: ImageRecord = {
      id: this.generateId(),
      timestamp: Date.now(),
      model: params.model,
      imageType: params.imageType,
      cost,
      metadata: params.metadata,
    };

    this.imageRecords.push(record);
    
    console.log(`[TokenTracker] 🖼️ ${params.model}/${params.imageType}: ¥${cost.toFixed(2)}`);
    
    this.saveToDisk();
    return record;
  }

  /**
   * 获取图像费用汇总
   */
  getImageCostSummary(startTime?: number, endTime?: number): ImageCostSummary {
    let records = this.imageRecords;
    
    if (startTime) {
      const end = endTime ?? Date.now();
      records = records.filter(r => r.timestamp >= startTime && r.timestamp <= end);
    }
    
    const summary: ImageCostSummary = {
      totalCost: 0,
      totalCount: records.length,
      byType: {},
      byModel: {},
      records,
    };

    for (const record of records) {
      summary.totalCost += record.cost;

      // 按类型统计
      if (!summary.byType[record.imageType]) {
        summary.byType[record.imageType] = { count: 0, cost: 0 };
      }
      summary.byType[record.imageType].count += 1;
      summary.byType[record.imageType].cost += record.cost;

      // 按模型统计
      if (!summary.byModel[record.model]) {
        summary.byModel[record.model] = { count: 0, cost: 0 };
      }
      summary.byModel[record.model].count += 1;
      summary.byModel[record.model].cost += record.cost;
    }

    return summary;
  }

  /**
   * 获取会话的 Token 统计
   */
  getSessionSummary(sessionId: string): TokenSummary {
    const records = this.records.get(sessionId) || [];
    return this.calculateSummary(records);
  }

  /**
   * 获取全局 Token 统计
   */
  getGlobalSummary(): TokenSummary {
    return this.calculateSummary(this.globalRecords);
  }

  /**
   * 获取指定时间范围内的统计
   */
  getSummaryByTimeRange(startTime: number, endTime: number = Date.now()): TokenSummary {
    const records = this.globalRecords.filter(r => r.timestamp >= startTime && r.timestamp <= endTime);
    return this.calculateSummary(records);
  }

  /**
   * 计算统计汇总
   */
  private calculateSummary(records: TokenRecord[]): TokenSummary {
    const summary: TokenSummary = {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      callCount: records.length,
      bySource: {},
      byModel: {},
      byAgent: {},
      records: records,
    };

    for (const record of records) {
      // 总计
      summary.totalPromptTokens += record.usage.promptTokens;
      summary.totalCompletionTokens += record.usage.completionTokens;
      summary.totalTokens += record.usage.totalTokens;

      // 按来源统计
      if (!summary.bySource[record.source]) {
        summary.bySource[record.source] = { promptTokens: 0, completionTokens: 0, totalTokens: 0, count: 0 };
      }
      summary.bySource[record.source].promptTokens += record.usage.promptTokens;
      summary.bySource[record.source].completionTokens += record.usage.completionTokens;
      summary.bySource[record.source].totalTokens += record.usage.totalTokens;
      summary.bySource[record.source].count += 1;

      // 按模型统计
      if (!summary.byModel[record.model]) {
        summary.byModel[record.model] = { promptTokens: 0, completionTokens: 0, totalTokens: 0, count: 0 };
      }
      summary.byModel[record.model].promptTokens += record.usage.promptTokens;
      summary.byModel[record.model].completionTokens += record.usage.completionTokens;
      summary.byModel[record.model].totalTokens += record.usage.totalTokens;
      summary.byModel[record.model].count += 1;

      // 按 Agent 统计
      if (record.agentName) {
        if (!summary.byAgent[record.agentName]) {
          summary.byAgent[record.agentName] = { promptTokens: 0, completionTokens: 0, totalTokens: 0, count: 0 };
        }
        summary.byAgent[record.agentName].promptTokens += record.usage.promptTokens;
        summary.byAgent[record.agentName].completionTokens += record.usage.completionTokens;
        summary.byAgent[record.agentName].totalTokens += record.usage.totalTokens;
        summary.byAgent[record.agentName].count += 1;
      }
    }

    return summary;
  }

  /**
   * 清除会话记录
   */
  clearSession(sessionId: string): void {
    this.records.delete(sessionId);
    this.saveToDisk();
  }

  /**
   * 清除所有记录
   */
  clearAll(): void {
    this.records.clear();
    this.globalRecords = [];
    this.imageRecords = [];
    this.saveToDiskImmediate();
  }

  /**
   * 获取格式化的统计报告
   */
  getFormattedReport(summary?: TokenSummary): string {
    const s = summary || this.getGlobalSummary();
    
    let report = `
📊 Token 使用统计报告
═══════════════════════════════════════
🔢 总计: ${s.totalTokens.toLocaleString()} tokens
   ├─ Prompt:     ${s.totalPromptTokens.toLocaleString()}
   └─ Completion: ${s.totalCompletionTokens.toLocaleString()}
📈 调用次数: ${s.callCount}

📦 按来源统计:
`;
    
    for (const [source, data] of Object.entries(s.bySource)) {
      report += `   ${source}: ${data.totalTokens.toLocaleString()} tokens (${data.count} 次)\n`;
    }

    report += `\n🤖 按模型统计:\n`;
    for (const [model, data] of Object.entries(s.byModel)) {
      report += `   ${model}: ${data.totalTokens.toLocaleString()} tokens (${data.count} 次)\n`;
    }

    if (Object.keys(s.byAgent).length > 0) {
      report += `\n🧠 按 Agent 统计:\n`;
      for (const [agent, data] of Object.entries(s.byAgent)) {
        report += `   ${agent}: ${data.totalTokens.toLocaleString()} tokens (${data.count} 次)\n`;
      }
    }

    report += `═══════════════════════════════════════`;
    return report;
  }
}

// 导出单例
export const tokenTracker = new TokenTracker();

// 导出类型
export type { TokenTracker };

