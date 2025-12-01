import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { GameGenerator } from '../services/game-generator';
import { ImageGenerator, ImageType } from '../services/image-generator';
import { CharacterAutocomplete } from '../services/character-autocomplete';
import { getCacheKey, getFromCache, saveToCache, saveProject, getProject, listProjects } from '../services/cache';

export const gameRoutes = new Hono();

// Request schema
const generateSchema = z.object({
    // 旧的模式：一句创意
    idea: z.string().optional(),
    
    // 新的模式：角色 + 世界观 + 场景 + 主题风格
    characters: z.array(z.any()).optional(),
    worldSetting: z.any().optional(),
    scenes: z.array(z.any()).optional(),
    themeSetting: z.any().optional(),
    
    // 兼容旧模式：角色 + 背景
    backgrounds: z.array(z.any()).optional(),
    
    skipCache: z.boolean().optional().default(false),
});

// POST /api/game/generate - 生成新游戏
gameRoutes.post(
    '/generate',
    zValidator('json', generateSchema),
    async (c) => {
        try {
            const { idea, characters, worldSetting, scenes, themeSetting, backgrounds, skipCache } = c.req.valid('json');
            
            // 验证：必须提供 idea 或 characters
            if (!idea && (!characters || characters.length === 0)) {
                return c.json({
                    success: false,
                    error: 'Either "idea" or "characters" is required',
                }, 400);
            }
            
            const generator = new GameGenerator();
            let result;
            
            // 新模式：基于角色/世界观/场景/主题风格生成
            if (characters && worldSetting && scenes) {
                console.log(`[GameRoute] Generating from ${characters.length} characters, world setting, ${scenes.length} scenes, and theme setting`);
                result = await generator.generateFromSetup(characters, worldSetting, scenes, themeSetting);
            }
            // 兼容旧模式：基于角色/背景生成
            else if (characters && backgrounds) {
                console.log(`[GameRoute] Generating from ${characters.length} characters and ${backgrounds.length} backgrounds (legacy mode)`);
                result = await generator.generateFromSetup(characters, backgrounds);
            }
            // 旧模式：基于创意生成
            else if (idea) {
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
                
                result = await generator.generate(idea);
                
                // 保存到 idea 缓存
                saveToCache(cacheKey, result);
            } else {
                return c.json({
                    success: false,
                    error: 'Invalid request',
                }, 400);
            }
            
            // 保存为项目
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

// =====================================================
// 图片生成 API
// =====================================================

const generateImageSchema = z.object({
    prompt: z.string().min(1, 'prompt is required'),
    type: z.enum(['sprite', 'avatar', 'background']),
    size: z.string().optional(),
    refImageUrl: z.string().optional(), // 参考图URL（用于保持形象一致性）
    refStrength: z.number().min(0).max(1).optional().default(0.7),
});

// POST /api/game/generate-image - AI生成图片
gameRoutes.post(
    '/generate-image',
    zValidator('json', generateImageSchema),
    async (c) => {
        try {
            const { prompt, type, size, refImageUrl, refStrength } = c.req.valid('json');
            
            console.log(`[GameRoute] 生成图片: type=${type}, hasRef=${!!refImageUrl}, prompt=${prompt.substring(0, 50)}...`);
            
            const imageGenerator = new ImageGenerator();
            let result;
            
            // 如果提供了参考图，使用参考图生成
            if (refImageUrl) {
                result = await imageGenerator.generateWithReference(
                    prompt,
                    refImageUrl,
                    type as ImageType,
                    size,
                    refStrength
                );
            } else {
                result = await imageGenerator.generate(prompt, type as ImageType, size);
            }
            
            return c.json({
                success: true,
                imageUrl: result.imageUrl,
                prompt: result.prompt,
                type: result.type,
                taskId: result.taskId,
            });
        } catch (error) {
            console.error('[GameRoute] 图片生成错误:', error);
            
            const message = error instanceof Error ? error.message : '未知错误';
            
            return c.json({
                success: false,
                error: '图片生成失败',
                details: message,
            }, 500);
        }
    }
);

// POST /api/game/generate-image-stream - AI生成图片（流式状态返回）
gameRoutes.post(
    '/generate-image-stream',
    zValidator('json', generateImageSchema),
    async (c) => {
        const { prompt, type, size, refImageUrl, refStrength } = c.req.valid('json');
        
        console.log(`[GameRoute] 流式生成图片: type=${type}, hasRef=${!!refImageUrl}`);
        
        // 创建 SSE 流
        return new Response(
            new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    
                    const sendEvent = (data: any) => {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    };
                    
                    try {
                        const imageGenerator = new ImageGenerator();
                        
                        // 状态回调
                        const onStatus = (status: string, message: string, progress?: number) => {
                            sendEvent({ status, message, progress });
                        };
                        
                        let result;
                        
                        if (refImageUrl) {
                            result = await imageGenerator.generateWithReference(
                                prompt,
                                refImageUrl,
                                type as ImageType,
                                size,
                                refStrength,
                                onStatus
                            );
                        } else {
                            result = await imageGenerator.generate(
                                prompt,
                                type as ImageType,
                                size,
                                onStatus
                            );
                        }
                        
                        // 发送最终结果
                        sendEvent({
                            status: 'COMPLETED',
                            imageUrl: result.imageUrl,
                            prompt: result.prompt,
                            type: result.type,
                            taskId: result.taskId,
                        });
                    } catch (error) {
                        const message = error instanceof Error ? error.message : '未知错误';
                        sendEvent({
                            status: 'FAILED',
                            error: message,
                        });
                    } finally {
                        controller.close();
                    }
                },
            }),
            {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            }
        );
    }
);

// =====================================================
// 角色自动补全 API
// =====================================================

const autocompleteCharacterSchema = z.object({
    partialData: z.object({
        name: z.string().optional(),
        displayName: z.string().optional(),
        description: z.string().optional(),
        gender: z.string().optional(),
        age: z.string().optional(),
        identity: z.string().optional(),
        appearance: z.object({
            hairStyle: z.string().optional(),
            clothing: z.string().optional(),
            facialFeatures: z.string().optional(),
            bodyType: z.string().optional(),
            height: z.string().optional(),
            otherFeatures: z.string().optional(),
        }).optional(),
        personality: z.object({
            traits: z.array(z.string()).optional(),
            temperament: z.string().optional(),
            values: z.string().optional(),
        }).optional(),
        coreTraits: z.object({
            specialSkills: z.array(z.string()).optional(),
            obsession: z.string().optional(),
            backstory: z.string().optional(),
        }).optional(),
    }),
    context: z.object({
        storyGenre: z.string().optional(),
        worldSetting: z.string().optional(),
        existingCharacters: z.array(z.string()).optional(),
    }).optional(),
});

// POST /api/game/autocomplete-character - AI自动补全角色信息
gameRoutes.post(
    '/autocomplete-character',
    zValidator('json', autocompleteCharacterSchema),
    async (c) => {
        try {
            const { partialData, context } = c.req.valid('json');
            
            console.log(`[GameRoute] 自动补全角色信息`);
            
            const autocomplete = new CharacterAutocomplete();
            const result = await autocomplete.autocomplete(partialData, context);
            
            if (!result.success) {
                return c.json({
                    success: false,
                    error: result.error || '自动补全失败',
                }, 500);
            }
            
            return c.json({
                success: true,
                data: result.data,
            });
        } catch (error) {
            console.error('[GameRoute] 角色自动补全错误:', error);
            
            const message = error instanceof Error ? error.message : '未知错误';
            
            return c.json({
                success: false,
                error: '自动补全失败',
                details: message,
            }, 500);
        }
    }
);
