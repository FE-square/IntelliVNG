/**
 * 项目存储管理
 * 
 * 设计原则：
 * - 项目数据统一存储在后端 (intelli-services)
 * - 前端只缓存：表单状态、用户偏好等临时数据
 * - 此模块封装后端 API 调用
 */

import { GameProject } from '@vng/core';

const BACKEND_URL = process.env.NEXT_PUBLIC_INTELLI_SERVICES_URL || 'http://localhost:4000';

// =====================================================
// 后端 API 封装
// =====================================================

/**
 * 获取所有项目列表
 */
export async function getAllProjects(): Promise<ProjectMetadata[]> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/game/projects`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        
        // 后端已返回完整的元数据，直接使用
        return (data.data || []).map((p: any) => ({
            id: p.id,
            title: p.title,
            description: p.description || '',
            coverImage: p.coverImage,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            genre: p.genre,
            artStyle: p.artStyle,
            characterCount: p.characterCount || 0,
            sceneCount: p.sceneCount || 0,
            nodeCount: p.nodeCount || 0,
        }));
    } catch (error) {
        console.error('[ProjectStorage] 获取项目列表失败:', error);
        return [];
    }
}

/**
 * 获取完整项目数据
 */
export async function getProject(projectId: string): Promise<GameProject | null> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/game/projects/${projectId}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data.data || null;
    } catch (error) {
        console.error('[ProjectStorage] 获取项目失败:', error);
        return null;
    }
}

/**
 * 保存项目到后端
 */
export async function saveProject(project: GameProject): Promise<boolean> {
    try {
        console.log('[ProjectStorage] 开始保存项目:', project.id);
        console.log('[ProjectStorage] 后端URL:', BACKEND_URL);
        
        const response = await fetch(`${BACKEND_URL}/api/game/projects/${project.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(project),
        });
        
        console.log('[ProjectStorage] 响应状态:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ProjectStorage] 保存失败响应:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        console.log('[ProjectStorage] 项目保存成功:', project.id);
        return true;
    } catch (error) {
        console.error('[ProjectStorage] 保存项目失败:', error);
        return false;
    }
}

// =====================================================
// 本地缓存（仅用于临时状态）
// =====================================================

const CURRENT_PROJECT_KEY = 'vng_current_project_id';
const DRAFT_PREFIX = 'vng_draft_';

/**
 * 获取当前项目ID
 */
export function getCurrentProjectId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CURRENT_PROJECT_KEY);
}

/**
 * 设置当前项目ID
 */
export function setCurrentProjectId(projectId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
}

/**
 * 清除当前项目ID
 */
export function clearCurrentProjectId(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CURRENT_PROJECT_KEY);
}

/**
 * 清理旧的草稿（按时间戳排序，删除最旧的）
 */
function cleanupOldDrafts(keepCount: number = 5): void {
    if (typeof window === 'undefined') return;
    
    try {
        // 收集所有草稿
        const drafts: Array<{ key: string; savedAt: string; size: number }> = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(DRAFT_PREFIX)) {
                try {
                    const value = localStorage.getItem(key);
                    if (value) {
                        const parsed = JSON.parse(value);
                        drafts.push({
                            key,
                            savedAt: parsed.savedAt || '1970-01-01T00:00:00.000Z',
                            size: value.length,
                        });
                    }
                } catch (e) {
                    // 忽略解析失败的项
                }
            }
        }
        
        // 按时间戳排序（最旧的在前）
        drafts.sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
        
        // 删除最旧的草稿，只保留最新的 keepCount 个
        const toDelete = drafts.slice(0, Math.max(0, drafts.length - keepCount));
        let freedSpace = 0;
        
        for (const draft of toDelete) {
            try {
                localStorage.removeItem(draft.key);
                freedSpace += draft.size;
                console.log(`[ProjectStorage] 已删除旧草稿: ${draft.key}, 释放空间: ${draft.size} 字符`);
            } catch (e) {
                console.warn(`[ProjectStorage] 删除草稿失败: ${draft.key}`, e);
            }
        }
        
        if (toDelete.length > 0) {
            console.log(`[ProjectStorage] 清理完成: 删除了 ${toDelete.length} 个旧草稿, 释放了约 ${freedSpace} 字符的空间`);
        }
    } catch (error) {
        console.error('[ProjectStorage] 清理旧草稿失败:', error);
    }
}

/**
 * 保存草稿（编辑器临时状态）
 * 如果存储空间不足，会自动清理旧的草稿
 */
export function saveDraft(projectId: string, data: Partial<GameProject>): void {
    if (typeof window === 'undefined') return;
    
    const key = `${DRAFT_PREFIX}${projectId}`;
    const draftData = {
        ...data,
        savedAt: new Date().toISOString(),
    };
    const value = JSON.stringify(draftData);
    
    try {
        localStorage.setItem(key, value);
    } catch (error: any) {
        // 如果是配额超出错误，尝试清理旧数据后重试
        if (error?.name === 'QuotaExceededError' || error?.code === 22) {
            console.warn('[ProjectStorage] 存储空间不足，开始清理旧草稿...');
            
            // 清理旧草稿（保留最新的 5 个）
            cleanupOldDrafts(5);
            
            // 重试保存
            try {
                localStorage.setItem(key, value);
                console.log('[ProjectStorage] 清理后保存草稿成功');
            } catch (retryError: any) {
                // 如果还是失败，尝试只保留当前这一个草稿
                if (retryError?.name === 'QuotaExceededError' || retryError?.code === 22) {
                    console.warn('[ProjectStorage] 清理后仍空间不足，尝试更激进的清理...');
                    cleanupOldDrafts(1); // 只保留最新的 1 个
                    
                    try {
                        localStorage.setItem(key, value);
                        console.log('[ProjectStorage] 激进清理后保存草稿成功');
                    } catch (finalError) {
                        console.error('[ProjectStorage] 保存草稿失败（存储空间严重不足）:', finalError);
                    }
                } else {
                    console.error('[ProjectStorage] 保存草稿失败:', retryError);
                }
            }
        } else {
            console.error('[ProjectStorage] 保存草稿失败:', error);
        }
    }
}

/**
 * 获取草稿
 */
export function getDraft(projectId: string): (Partial<GameProject> & { savedAt: string }) | null {
    if (typeof window === 'undefined') return null;
    try {
        const data = localStorage.getItem(`${DRAFT_PREFIX}${projectId}`);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('[ProjectStorage] 获取草稿失败:', error);
        return null;
    }
}

/**
 * 清除草稿
 */
export function clearDraft(projectId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${DRAFT_PREFIX}${projectId}`);
}

/**
 * 清除所有草稿（手动清理）
 */
export function clearAllDrafts(): void {
    if (typeof window === 'undefined') return;
    
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(DRAFT_PREFIX)) {
            keysToDelete.push(key);
        }
    }
    
    for (const key of keysToDelete) {
        localStorage.removeItem(key);
    }
    
    console.log(`[ProjectStorage] 已清除 ${keysToDelete.length} 个草稿`);
}

/**
 * 获取草稿存储统计信息
 */
export function getDraftStats(): { count: number; totalSize: number } {
    if (typeof window === 'undefined') return { count: 0, totalSize: 0 };
    
    let count = 0;
    let totalSize = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(DRAFT_PREFIX)) {
            const value = localStorage.getItem(key);
            if (value) {
                count++;
                totalSize += value.length;
            }
        }
    }
    
    return { count, totalSize };
}

/**
 * 删除项目（调用后端 API）
 */
export async function deleteProject(projectId: string): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/game/projects/${projectId}`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[ProjectStorage] 删除失败:', errorData);
            return false;
        }
        
        const data = await response.json();
        console.log('[ProjectStorage] 删除成功:', data);
        return data.success;
    } catch (error) {
        console.error('[ProjectStorage] 删除项目失败:', error);
        return false;
    }
}

// =====================================================
// 类型定义
// =====================================================

export interface ProjectMetadata {
    id: string;
    title: string;
    description: string;
    coverImage?: string;
    createdAt: string;
    updatedAt: string;
    genre?: string;
    artStyle?: string;
    characterCount: number;
    sceneCount: number;
    nodeCount: number;
    autoSaved?: boolean;
    saveNote?: string;
}
