/**
 * 匿名用户 ID 管理
 * 
 * 用于在无登录系统的情况下追踪用户行为和 Token 消耗
 * - 首次访问时生成 UUID
 * - 存储到 localStorage + cookie（跨标签页共享）
 * - 有效期 30 天
 */

const ANON_USER_KEY = 'vng_anon_user_id';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 天（秒）

/**
 * 生成 UUID v4
 */
function generateUUID(): string {
  // 优先使用 crypto.randomUUID()
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // 降级方案
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 设置 cookie
 */
function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === 'undefined') return;
  
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

/**
 * 获取 cookie
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * 获取或创建匿名用户 ID
 * 
 * 优先级：cookie > localStorage > 新生成
 */
export function getAnonymousUserId(): string {
  if (typeof window === 'undefined') {
    // SSR 环境，返回临时 ID
    return `ssr-${Date.now()}`;
  }
  
  // 1. 尝试从 cookie 获取
  let userId = getCookie(ANON_USER_KEY);
  
  // 2. 尝试从 localStorage 获取
  if (!userId) {
    userId = localStorage.getItem(ANON_USER_KEY);
  }
  
  // 3. 都没有则生成新的
  if (!userId) {
    userId = `anon-${generateUUID()}`;
  }
  
  // 4. 同步存储到 cookie 和 localStorage（刷新有效期）
  setCookie(ANON_USER_KEY, userId, COOKIE_MAX_AGE);
  localStorage.setItem(ANON_USER_KEY, userId);
  
  return userId;
}

/**
 * 清除匿名用户 ID（用于"重置身份"功能）
 */
export function clearAnonymousUserId(): void {
  if (typeof window === 'undefined') return;
  
  setCookie(ANON_USER_KEY, '', -1);
  localStorage.removeItem(ANON_USER_KEY);
}

/**
 * 获取用于请求头的用户 ID
 * 
 * 用法：
 * ```ts
 * fetch('/api/xxx', {
 *   headers: {
 *     ...getAnonymousUserHeaders(),
 *   },
 * });
 * ```
 */
export function getAnonymousUserHeaders(): Record<string, string> {
  return {
    'X-Anonymous-User-Id': getAnonymousUserId(),
  };
}


