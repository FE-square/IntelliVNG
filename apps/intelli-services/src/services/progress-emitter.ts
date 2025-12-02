/**
 * 进度事件发射器
 * 用于在 Agent 运行过程中向前端推送实时进度
 */
import { EventEmitter } from "events";

// ============ 进度事件类型 ============

export type ProgressStage = 
  | "init"           // 初始化
  | "planning"       // 规划阶段
  | "plan_validate"  // 规划验证
  | "writing"        // 写作阶段
  | "reviewing"      // 审阅阶段
  | "rewriting"      // 重写阶段
  | "finalizing"     // 最终化
  | "completed"      // 完成
  | "failed";        // 失败

export interface ProgressEvent {
  stage: ProgressStage;
  action: string;           // 当前动作描述
  status: "started" | "in_progress" | "completed" | "failed";
  progress?: number;        // 0-100 进度百分比
  details?: {
    nodeCount?: number;     // 节点数量
    currentNode?: string;   // 当前处理的节点
    layer?: number;         // 当前层级
    totalLayers?: number;   // 总层级
    score?: number;         // 评分
    issues?: number;        // 问题数量
    rewriteNodes?: string[];// 需要重写的节点
    [key: string]: any;
  };
  message?: string;         // 用户友好的消息
  timestamp: number;
}

// ============ 进度发射器类 ============

export class ProgressEmitter extends EventEmitter {
  private sessionId: string;
  private startTime: number;

  constructor(sessionId?: string) {
    super();
    this.sessionId = sessionId || Math.random().toString(36).substring(2, 10);
    this.startTime = Date.now();
  }

  /**
   * 发送进度事件
   */
  emit(event: "progress", data: Omit<ProgressEvent, "timestamp">): boolean {
    const fullEvent: ProgressEvent = {
      ...data,
      timestamp: Date.now(),
    };
    console.log(`[Progress:${this.sessionId}] ${data.stage} - ${data.action} (${data.status})`);
    return super.emit(event, fullEvent);
  }

  /**
   * 便捷方法：开始阶段
   */
  stageStart(stage: ProgressStage, action: string, message?: string, details?: ProgressEvent["details"]) {
    this.emit("progress", {
      stage,
      action,
      status: "started",
      message: message || `开始${this.getStageName(stage)}`,
      details,
    });
  }

  /**
   * 便捷方法：阶段进行中
   */
  stageProgress(stage: ProgressStage, action: string, progress: number, message?: string, details?: ProgressEvent["details"]) {
    this.emit("progress", {
      stage,
      action,
      status: "in_progress",
      progress,
      message,
      details,
    });
  }

  /**
   * 便捷方法：完成阶段
   */
  stageComplete(stage: ProgressStage, action: string, message?: string, details?: ProgressEvent["details"]) {
    this.emit("progress", {
      stage,
      action,
      status: "completed",
      progress: 100,
      message: message || `${this.getStageName(stage)}完成`,
      details,
    });
  }

  /**
   * 便捷方法：阶段失败
   */
  stageFailed(stage: ProgressStage, action: string, message: string, details?: ProgressEvent["details"]) {
    this.emit("progress", {
      stage,
      action,
      status: "failed",
      message,
      details,
    });
  }

  /**
   * 获取阶段中文名称
   */
  private getStageName(stage: ProgressStage): string {
    const names: Record<ProgressStage, string> = {
      init: "初始化",
      planning: "故事规划",
      plan_validate: "规划验证",
      writing: "节点写作",
      reviewing: "故事审阅",
      rewriting: "节点重写",
      finalizing: "最终处理",
      completed: "完成",
      failed: "失败",
    };
    return names[stage] || stage;
  }

  /**
   * 获取运行时长（毫秒）
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 获取会话ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// ============ 全局进度管理器 ============

const activeEmitters = new Map<string, ProgressEmitter>();

/**
 * 创建新的进度发射器
 */
export function createProgressEmitter(sessionId?: string): ProgressEmitter {
  const emitter = new ProgressEmitter(sessionId);
  const id = emitter.getSessionId();
  activeEmitters.set(id, emitter);
  return emitter;
}

/**
 * 获取进度发射器
 */
export function getProgressEmitter(sessionId: string): ProgressEmitter | undefined {
  return activeEmitters.get(sessionId);
}

/**
 * 移除进度发射器
 */
export function removeProgressEmitter(sessionId: string): void {
  activeEmitters.delete(sessionId);
}


