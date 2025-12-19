/**
 * 生成会话管理器
 * 
 * 跟踪活跃的剧本生成会话，支持中断功能
 */

interface GenerationSession {
  sessionId: string;
  startTime: number;
  status: 'running' | 'completed' | 'aborted' | 'failed';
  abortController: AbortController;
}

// 存储活跃的生成会话
const activeSessions = new Map<string, GenerationSession>();

/**
 * 创建新的生成会话
 */
export function createGenerationSession(sessionId: string): AbortController {
  // 如果已存在，先终止旧的
  if (activeSessions.has(sessionId)) {
    abortGenerationSession(sessionId);
  }
  
  const abortController = new AbortController();
  
  activeSessions.set(sessionId, {
    sessionId,
    startTime: Date.now(),
    status: 'running',
    abortController,
  });
  
  console.log(`[SessionManager] 创建会话: ${sessionId}`);
  return abortController;
}

/**
 * 中断生成会话
 */
export function abortGenerationSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    console.log(`[SessionManager] 会话不存在: ${sessionId}`);
    return false;
  }
  
  if (session.status !== 'running') {
    console.log(`[SessionManager] 会话已结束: ${sessionId}, status=${session.status}`);
    return false;
  }
  
  session.abortController.abort();
  session.status = 'aborted';
  
  console.log(`[SessionManager] 已中断会话: ${sessionId}`);
  return true;
}

/**
 * 检查会话是否已被中断
 */
export function isSessionAborted(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  return session?.status === 'aborted' || session?.abortController.signal.aborted || false;
}

/**
 * 获取会话的 AbortSignal
 */
export function getSessionAbortSignal(sessionId: string): AbortSignal | null {
  return activeSessions.get(sessionId)?.abortController.signal || null;
}

/**
 * 标记会话完成
 */
export function completeGenerationSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session && session.status === 'running') {
    session.status = 'completed';
    console.log(`[SessionManager] 会话完成: ${sessionId}`);
  }
}

/**
 * 标记会话失败
 */
export function failGenerationSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session && session.status === 'running') {
    session.status = 'failed';
    console.log(`[SessionManager] 会话失败: ${sessionId}`);
  }
}

/**
 * 移除会话
 */
export function removeGenerationSession(sessionId: string): void {
  activeSessions.delete(sessionId);
  console.log(`[SessionManager] 移除会话: ${sessionId}`);
}

/**
 * 获取会话状态
 */
export function getSessionStatus(sessionId: string): GenerationSession | null {
  return activeSessions.get(sessionId) || null;
}

/**
 * 获取所有活跃会话
 */
export function getActiveSessions(): string[] {
  return Array.from(activeSessions.entries())
    .filter(([_, session]) => session.status === 'running')
    .map(([id]) => id);
}

/**
 * 清理过期会话（超过 1 小时的非运行会话）
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.status !== 'running' && now - session.startTime > ONE_HOUR) {
      activeSessions.delete(sessionId);
      console.log(`[SessionManager] 清理过期会话: ${sessionId}`);
    }
  }
}

// 定时清理（每 30 分钟）
setInterval(cleanupExpiredSessions, 30 * 60 * 1000);

/**
 * 自定义错误类：生成已中断
 */
export class GenerationAbortedError extends Error {
  constructor(sessionId: string) {
    super(`生成已被用户中断 (sessionId: ${sessionId})`);
    this.name = 'GenerationAbortedError';
  }
}



