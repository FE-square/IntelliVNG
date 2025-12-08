import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), '.cache');
const PROJECTS_DIR = join(process.cwd(), '.cache', 'projects');

// 确保缓存目录存在
if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
}
if (!existsSync(PROJECTS_DIR)) {
    mkdirSync(PROJECTS_DIR, { recursive: true });
}

/**
 * 生成缓存 key（基于输入内容的 hash）
 */
export function getCacheKey(input: string): string {
    return createHash('md5').update(input.trim().toLowerCase()).digest('hex');
}

/**
 * 获取缓存文件路径
 */
function getCacheFilePath(key: string): string {
    return join(CACHE_DIR, `${key}.json`);
}

/**
 * 获取项目文件路径
 */
function getProjectFilePath(projectId: string): string {
    return join(PROJECTS_DIR, `${projectId}.json`);
}

/**
 * 从缓存中读取（基于 idea hash）
 * 临时缓存优化，避免重复生成相同内容
 */
export function getFromCache<T>(key: string): T | null {
    const filePath = getCacheFilePath(key);
    
    if (!existsSync(filePath)) {
        return null;
    }
    
    try {
        const data = readFileSync(filePath, 'utf-8');
        const cached = JSON.parse(data);
        
        console.log(`[Cache] Hit for key: ${key.slice(0, 8)}...`);
        return cached.data as T;
    } catch (error) {
        console.error('[Cache] Failed to read cache:', error);
        return null;
    }
}

/**
 * 写入缓存（基于 idea hash）
 */
export function saveToCache<T>(key: string, data: T): void {
    const filePath = getCacheFilePath(key);
    
    try {
        const cacheData = {
            key,
            timestamp: new Date().toISOString(),
            data,
        };
        
        writeFileSync(filePath, JSON.stringify(cacheData, null, 2), 'utf-8');
        console.log(`[Cache] Saved for key: ${key.slice(0, 8)}...`);
    } catch (error) {
        console.error('[Cache] Failed to save cache:', error);
    }
}

/**
 * 保存项目数据（基于 projectId）
 * 持久化项目数据，支持前端页面导航
 */
export function saveProject<T extends { id: string }>(project: T): void {
    const filePath = getProjectFilePath(project.id);
    
    try {
        const projectData = {
            savedAt: new Date().toISOString(),
            project,
        };
        
        writeFileSync(filePath, JSON.stringify(projectData, null, 2), 'utf-8');
        console.log(`[Projects] Saved project: ${project.id}`);
    } catch (error) {
        console.error('[Projects] Failed to save project:', error);
    }
}

/**
 * 获取项目数据（基于 projectId）
 */
export function getProject<T>(projectId: string): T | null {
    const filePath = getProjectFilePath(projectId);
    
    if (!existsSync(filePath)) {
        console.log(`[Projects] Project not found: ${projectId}`);
        return null;
    }
    
    try {
        const data = readFileSync(filePath, 'utf-8');
        const saved = JSON.parse(data);
        
        console.log(`[Projects] Loaded project: ${projectId}`);
        return saved.project as T;
    } catch (error) {
        console.error('[Projects] Failed to load project:', error);
        return null;
    }
}

/**
 * 获取所有项目列表（包含封面和统计信息）
 */
export function listProjects(): Array<{
    id: string;
    title: string;
    description: string;
    coverImage?: string;
    savedAt: string;
    characterCount: number;
    sceneCount: number;
    nodeCount: number;
}> {
    try {
        const files = readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
        const projects = [];
        
        for (const file of files) {
            const data = readFileSync(join(PROJECTS_DIR, file), 'utf-8');
            const saved = JSON.parse(data);
            const project = saved.project;
            
            // ✅ 如果没有 coverImage，使用第一个场景背景图
            let coverImage = project.coverImage;
            if (!coverImage && project.backgrounds && project.backgrounds.length > 0) {
                const firstBg = project.backgrounds[0];
                if (firstBg.imageUrl) {
                    coverImage = firstBg.imageUrl;
                }
            }
            
            projects.push({
                id: project.id,
                title: project.title,
                description: project.description || '',
                coverImage,
                savedAt: saved.savedAt,
                characterCount: project.characters?.length || 0,
                sceneCount: project.backgrounds?.length || 0,
                nodeCount: project.script?.length || 0,
            });
        }
        
        return projects.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    } catch (error) {
        console.error('[Projects] Failed to list projects:', error);
        return [];
    }
}

/**
 * 删除项目（基于 projectId）
 */
export function deleteProject(projectId: string): boolean {
    const filePath = getProjectFilePath(projectId);
    
    if (!existsSync(filePath)) {
        console.log(`[Projects] Project not found: ${projectId}`);
        return false;
    }
    
    try {
        unlinkSync(filePath);
        console.log(`[Projects] Deleted project: ${projectId}`);
        return true;
    } catch (error) {
        console.error('[Projects] Failed to delete project:', error);
        return false;
    }
}

/**
 * 清除所有缓存
 */
export function clearCache(): void {
    const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
        unlinkSync(join(CACHE_DIR, file));
    }
    
    console.log('[Cache] Cleared all cache');
}

