import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { GameGenerator } from '../services/game-generator';

export const gameRoutes = new Hono();

// Request schema
const generateSchema = z.object({
    idea: z.string().min(1, 'Idea is required').max(2000, 'Idea is too long'),
});

// POST /api/game/generate
gameRoutes.post(
    '/generate',
    zValidator('json', generateSchema),
    async (c) => {
        try {
            const { idea } = c.req.valid('json');
            
            console.log(`[GameRoute] Received request for idea: "${idea.slice(0, 50)}..."`);
            
            const generator = new GameGenerator();
            const result = await generator.generate(idea);
            
            console.log(`[GameRoute] Successfully generated: "${result.title}"`);
            
            return c.json({
                success: true,
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

