/**
 * 项目本地存储管理
 * 使用 localStorage 持久化项目数据
 */

import { GameProject } from '@vng/core';

const PROJECTS_KEY = 'intelligvng_projects';
const CURRENT_PROJECT_KEY = 'intelligvng_current_project';

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
    saveNote?: string;  // ✅ 版本备注
    autoSaved?: boolean;  // ✅ 是否为自动保存
}

/**
 * 获取所有项目列表(仅元数据)
 */
export function getAllProjects(): ProjectMetadata[] {
    try {
        const data = localStorage.getItem(PROJECTS_KEY);
        if (!data) return [];
        return JSON.parse(data);
    } catch (error) {
        console.error('[ProjectStorage] 获取项目列表失败:', error);
        return [];
    }
}

/**
 * 获取完整项目数据
 */
export function getProject(projectId: string): GameProject | null {
    try {
        const key = `intelligvng_project_${projectId}`;
        const data = localStorage.getItem(key);
        if (!data) return null;
        return JSON.parse(data);
    } catch (error) {
        console.error('[ProjectStorage] 获取项目失败:', error);
        return null;
    }
}

/**
 * 保存项目
 * @param project 项目数据
 * @param saveNote 版本备注(可选)
 * @param autoSaved 是否为自动保存(默认false)
 */
export function saveProject(project: GameProject, saveNote?: string, autoSaved: boolean = false): boolean {
    try {
        // 保存完整项目数据
        const projectKey = `intelligvng_project_${project.id}`;
        localStorage.setItem(projectKey, JSON.stringify(project));

        // 更新项目列表元数据
        const projects = getAllProjects();
        const existingIndex = projects.findIndex(p => p.id === project.id);
        
        const metadata: ProjectMetadata = {
            id: project.id,
            title: project.title,
            description: project.description || '',
            coverImage: project.backgrounds?.[0]?.imageUrl,
            createdAt: existingIndex >= 0 ? projects[existingIndex].createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            genre: project.meta?.genre,
            artStyle: project.meta?.artStyle,
            characterCount: project.characters?.length || 0,
            sceneCount: project.backgrounds?.length || 0,
            nodeCount: project.script?.length || 0,
            saveNote: saveNote,  // ✅ 保存备注
            autoSaved: autoSaved,  // ✅ 标记为自动/手动保存
        };

        if (existingIndex >= 0) {
            projects[existingIndex] = metadata;
        } else {
            projects.unshift(metadata); // 新项目放在最前面
        }

        localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
        
        // 设置为当前项目
        setCurrentProject(project.id);
        
        const saveType = autoSaved ? '自动保存' : '手动保存';
        console.log(`[ProjectStorage] ${saveType}成功:`, project.id, saveNote || '');
        return true;
    } catch (error) {
        console.error('[ProjectStorage] 保存项目失败:', error);
        return false;
    }
}

/**
 * 删除项目
 */
export function deleteProject(projectId: string): boolean {
    try {
        // 删除完整项目数据
        const projectKey = `intelligvng_project_${projectId}`;
        localStorage.removeItem(projectKey);

        // 从列表中移除
        const projects = getAllProjects();
        const filtered = projects.filter(p => p.id !== projectId);
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered));

        // 如果删除的是当前项目,清除当前项目
        if (getCurrentProjectId() === projectId) {
            localStorage.removeItem(CURRENT_PROJECT_KEY);
        }

        console.log('[ProjectStorage] 项目删除成功:', projectId);
        return true;
    } catch (error) {
        console.error('[ProjectStorage] 删除项目失败:', error);
        return false;
    }
}

/**
 * 获取当前项目ID
 */
export function getCurrentProjectId(): string | null {
    return localStorage.getItem(CURRENT_PROJECT_KEY);
}

/**
 * 设置当前项目
 */
export function setCurrentProject(projectId: string): void {
    localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
}

/**
 * 获取当前项目
 */
export function getCurrentProject(): GameProject | null {
    const projectId = getCurrentProjectId();
    if (!projectId) return null;
    return getProject(projectId);
}

/**
 * 清除当前项目
 */
export function clearCurrentProject(): void {
    localStorage.removeItem(CURRENT_PROJECT_KEY);
}
