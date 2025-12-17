/**
 * Token 使用追踪服务
 * 
 * 统一追踪所有 LLM 调用的 Token 消耗，包括:
 * - Mastra Agent 调用
 * - 直接 OpenAI SDK 调用
 * - 其他 LLM API 调用
 */

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

export interface TokenSummary {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  callCount: number;
  bySource: Record<string, TokenUsage & { count: number }>;
  byModel: Record<string, TokenUsage & { count: number }>;
  byAgent: Record<string, TokenUsage & { count: number }>;
  records: TokenRecord[];
}

class TokenTracker {
  private records: Map<string, TokenRecord[]> = new Map();
  private globalRecords: TokenRecord[] = [];
  
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
  }

  /**
   * 清除所有记录
   */
  clearAll(): void {
    this.records.clear();
    this.globalRecords = [];
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

