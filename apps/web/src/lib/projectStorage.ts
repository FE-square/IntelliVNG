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
 * 保存草稿（编辑器临时状态）
 */
export function saveDraft(projectId: string, data: Partial<GameProject>): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(`${DRAFT_PREFIX}${projectId}`, JSON.stringify({
            ...data,
            savedAt: new Date().toISOString(),
        }));
    } catch (error) {
        console.error('[ProjectStorage] 保存草稿失败:', error);
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
 * 删除项目（调用后端 API）
 * 注意：后端暂未实现删除接口，此函数预留
 */
export async function deleteProject(projectId: string): Promise<boolean> {
    try {
        // TODO: 后端实现删除接口后启用
        // const response = await fetch(`${BACKEND_URL}/api/game/projects/${projectId}`, {
        //     method: 'DELETE',
        // });
        // return response.ok;
        console.warn('[ProjectStorage] 删除功能暂未实现');
        return false;
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
