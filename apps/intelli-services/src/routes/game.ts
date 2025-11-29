import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { GameGenerator } from '../services/game-generator';
import { getCacheKey, getFromCache, saveToCache, saveProject, getProject, listProjects } from '../services/cache';

export const gameRoutes = new Hono();

// Request schema
const generateSchema = z.object({
    idea: z.string().min(1, 'Idea is required').max(2000, 'Idea is too long'),
    skipCache: z.boolean().optional().default(false),
});

// POST /api/game/generate - 生成新游戏
gameRoutes.post(
    '/generate',
    zValidator('json', generateSchema),
    async (c) => {
        try {
            const { idea, skipCache } = c.req.valid('json');
            const cacheKey = getCacheKey(idea);
            
            console.log(`[GameRoute] Received request for idea: "${idea.slice(0, 50)}..."`);
            
            // 检查缓存
            if (!skipCache) {
                const cached = getFromCache<any>(cacheKey);
                if (cached) {
                    console.log(`[GameRoute] Returning cached result for: "${cached.title}"`);
                    return c.json({
                        success: true,
                        cached: true,
                        data: cached,
                    });
                }
            }
            
            // 生成新内容
            const generator = new GameGenerator();
            const result = await generator.generate(idea);
            
            // 保存到 idea 缓存（下次相同 idea 可以复用）
            saveToCache(cacheKey, result);
            
            // 同时保存为项目（通过 projectId 可以获取）
            saveProject(result);
            
            console.log(`[GameRoute] Successfully generated: "${result.title}"`);
            
            return c.json({
                success: true,
                cached: false,
                data: result,
            });
        } catch (error) {
            console.error('[GameRoute] Error:', error);
            
            const message = error instanceof Error ? error.message : 'Unknown error';
            
            return c.json({
                success: false,
                error: message,
            }, 500);
        }
    }
);

// GET /api/game/projects - 获取所有项目列表
gameRoutes.get('/projects', async (c) => {
    const projects = listProjects();
    return c.json({
        success: true,
        data: projects,
    });
});

// GET /api/game/projects/:id - 获取单个项目详情
gameRoutes.get('/projects/:id', async (c) => {
    const projectId = c.req.param('id');
    
    if (!projectId) {
        return c.json({ success: false, error: 'Project ID is required' }, 400);
    }
    
    const project = getProject(projectId);
    
    if (!project) {
        return c.json({ success: false, error: 'Project not found' }, 404);
    }
    
    return c.json({
        success: true,
        data: project,
    });
});

// PUT /api/game/projects/:id - 更新项目
gameRoutes.put('/projects/:id', async (c) => {
    const projectId = c.req.param('id');
    const body = await c.req.json();
    
    if (!projectId) {
        return c.json({ success: false, error: 'Project ID is required' }, 400);
    }
    
    // 验证项目存在
    const existing = getProject(projectId);
    if (!existing) {
        return c.json({ success: false, error: 'Project not found' }, 404);
    }
    
    // 更新项目（合并数据）
    const updated = {
        ...existing,
        ...body,
        id: projectId, // 确保 ID 不被覆盖
        updatedAt: new Date().toISOString(),
    };
    
    saveProject(updated);
    
    return c.json({
        success: true,
        data: updated,
    });
});
