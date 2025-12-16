/**
 * Chat Memory Service
 * 
 * 项目级别的对话记忆服务，用于：
 * - 存储每个项目的对话历史
 * - 维护剧本结构摘要作为上下文
 * - 支持对话轮次限制
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCalls?: any[];
  actions?: any[];
}

export interface ProjectContext {
  projectId: string;
  title: string;
  nodeCount: number;
  characterCount: number;
  endingCount: number;
  hasStartNode: boolean;
  lastUpdated: number;
}

export interface ChatSession {
  projectId: string;
  messages: ChatMessage[];
  context: ProjectContext | null;
  createdAt: number;
  updatedAt: number;
}

// ============ Session Store 接口 ============

/**
 * 会话存储接口
 * 为了支持生产环境的持久化（如 Redis），我们将存储逻辑抽象为接口。
 */
export interface SessionStore {
  get(projectId: string): ChatSession | undefined;
  set(projectId: string, session: ChatSession): void;
  delete(projectId: string): void;
  getAll(): IterableIterator<ChatSession>;
  size(): number;
}

/**
 * 内存存储实现 (默认)
 * 适用于：开发环境、单机部署、无状态 Serverless (但会丢失记忆)
 * 注意：在 Serverless 环境中，全局变量可能在请求间不共享或被回收。
 * 生产环境建议实现 RedisSessionStore。
 */
export class InMemorySessionStore implements SessionStore {
  private store = new Map<string, ChatSession>();

  get(projectId: string): ChatSession | undefined {
    return this.store.get(projectId);
  }

  set(projectId: string, session: ChatSession): void {
    this.store.set(projectId, session);
  }

  delete(projectId: string): void {
    this.store.delete(projectId);
  }

  getAll(): IterableIterator<ChatSession> {
    return this.store.values();
  }

  size(): number {
    return this.store.size;
  }
}

// 全局存储实例
// TODO: 在生产环境中，可以通过环境变量切换到 Redis 实现
const sessionStore: SessionStore = new InMemorySessionStore();

// 配置
const MAX_MESSAGES_PER_SESSION = 40; // 最多保留 20 轮对话（40 条消息）
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 小时后过期

/**
 * 获取或创建项目的聊天会话
 */
export function getSession(projectId: string): ChatSession {
  let session = sessionStore.get(projectId);
  
  if (!session) {
    session = {
      projectId,
      messages: [],
      context: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    sessionStore.set(projectId, session);
  }
  
  return session;
}

/**
 * 添加消息到会话
 */
export function addMessage(
  projectId: string,
  message: Omit<ChatMessage, "timestamp">
): ChatSession {
  const session = getSession(projectId);
  
  session.messages.push({
    ...message,
    timestamp: Date.now(),
  });
  
  // 限制消息数量
  if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
    // 保留系统消息和最近的消息
    const systemMessages = session.messages.filter((m) => m.role === "system");
    const recentMessages = session.messages
      .filter((m) => m.role !== "system")
      .slice(-MAX_MESSAGES_PER_SESSION + systemMessages.length);
    session.messages = [...systemMessages, ...recentMessages];
  }
  
  session.updatedAt = Date.now();
  sessionStore.set(projectId, session); // 确保更新存储
  return session;
}

/**
 * 更新项目上下文
 */
export function updateContext(
  projectId: string,
  context: Partial<ProjectContext>
): ChatSession {
  const session = getSession(projectId);
  
  session.context = {
    projectId,
    title: context.title || session.context?.title || "未命名项目",
    nodeCount: context.nodeCount ?? session.context?.nodeCount ?? 0,
    characterCount: context.characterCount ?? session.context?.characterCount ?? 0,
    endingCount: context.endingCount ?? session.context?.endingCount ?? 0,
    hasStartNode: context.hasStartNode ?? session.context?.hasStartNode ?? false,
    lastUpdated: Date.now(),
  };
  
  session.updatedAt = Date.now();
  sessionStore.set(projectId, session); // 确保更新存储
  return session;
}

/**
 * 从项目数据生成上下文摘要
 */
export function generateContextFromProject(project: any): ProjectContext {
  const script = project.script || [];
  const characters = project.characters || [];
  
  return {
    projectId: project.id,
    title: project.title || "未命名项目",
    nodeCount: script.length,
    characterCount: characters.length,
    endingCount: script.filter((n: any) => n.isEnding).length,
    hasStartNode: script.some((n: any) => n.isStart),
    lastUpdated: Date.now(),
  };
}

/**
 * 获取用于 LLM 的对话历史格式
 */
export function getMessagesForLLM(
  projectId: string,
  includeContext: boolean = true
): Array<{ role: "user" | "assistant" | "system"; content: string }> {
  const session = getSession(projectId);
  const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
  
  // 添加项目上下文作为系统消息
  if (includeContext && session.context) {
    messages.push({
      role: "system",
      content: `当前项目信息：
- 标题: ${session.context.title}
- 节点数: ${session.context.nodeCount}
- 角色数: ${session.context.characterCount}
- 结局数: ${session.context.endingCount}
- 有开始节点: ${session.context.hasStartNode ? "是" : "否"}`,
    });
  }
  
  // 添加对话历史（只取最近的消息）
  const recentMessages = session.messages
    .filter((m) => m.role !== "system")
    .slice(-20); // 最近 10 轮对话
  
  for (const msg of recentMessages) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }
  
  return messages;
}

/**
 * 清除项目的聊天会话
 */
export function clearSession(projectId: string): void {
  sessionStore.delete(projectId);
}

/**
 * 清理过期会话
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const session of sessionStore.getAll()) {
    if (now - session.updatedAt > SESSION_EXPIRY_MS) {
      sessionStore.delete(session.projectId);
      cleaned++;
    }
  }
  
  return cleaned;
}

/**
 * 获取会话统计信息
 */
export function getSessionStats(): {
  totalSessions: number;
  totalMessages: number;
} {
  let totalMessages = 0;
  for (const session of sessionStore.getAll()) {
    totalMessages += session.messages.length;
  }
  
  return {
    totalSessions: sessionStore.size(),
    totalMessages,
  };
}

// 定期清理过期会话（每小时）
// 注意：在 Serverless 环境中，这个定时器可能不会长期运行
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleaned = cleanupExpiredSessions();
    if (cleaned > 0) {
      console.log(`[ChatMemory] 清理了 ${cleaned} 个过期会话`);
    }
  }, 60 * 60 * 1000);
}
