import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { GameGenerator } from '../services/game-generator';
import { getCacheKey, getFromCache, saveToCache } from '../services/cache';

export const gameRoutes = new Hono();

// Request schema
const generateSchema = z.object({
    idea: z.string().min(1, 'Idea is required').max(2000, 'Idea is too long'),
    skipCache: z.boolean().optional().default(false),
});

// POST /api/game/generate
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
            
            // 保存到缓存
            saveToCache(cacheKey, result);
            
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
