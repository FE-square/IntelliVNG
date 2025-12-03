import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { GameGenerator } from '../services/game-generator';
import { GameGeneratorAgent, gameGeneratorAgent } from '../services/game-generator-agent';
import { ideaDraftGenerator } from '../services/idea-draft-generator';
import { createProgressEmitter, removeProgressEmitter, type ProgressEvent } from '../services/progress-emitter';
import { ImageGenerator, ImageType } from '../services/image-generator';
import { FormAutocomplete, FormType } from '../services/form-autocomplete';
import { getCacheKey, getFromCache, saveToCache, saveProject, getProject, listProjects } from '../services/cache';
import { getLocaleFromRequest, type Locale } from '../utils/locale';

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
    
    // 用户语言
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
    
    skipCache: z.boolean().optional().default(false),
});

// POST /api/game/generate - 生成新游戏
gameRoutes.post(
    '/generate',
    zValidator('json', generateSchema),
    async (c) => {
        try {
            const { idea, characters, worldSetting, scenes, themeSetting, backgrounds, locale, skipCache } = c.req.valid('json');
            
            // 获取locale
            const userLocale = getLocaleFromRequest(locale);
            console.log(`[GameRoute] User locale: ${userLocale}`);
            
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
                result = await generator.generateFromSetup(characters, worldSetting, scenes, themeSetting, userLocale);
            }
            // 兼容旧模式：基于角色/背景生成
            else if (characters && backgrounds) {
                console.log(`[GameRoute] Generating from ${characters.length} characters and ${backgrounds.length} backgrounds (legacy mode)`);
                result = await generator.generateFromSetup(characters, backgrounds, undefined, undefined, userLocale);
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
                
                result = await generator.generate(idea, userLocale);
                
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

// =====================================================
// 多智能体剧本生成 API（带实时进度）
// =====================================================

const generateByAgentsSchema = z.object({
    // 角色 + 世界观 + 场景 + 主题风格
    characters: z.array(z.any()),
    worldSetting: z.any(),
    scenes: z.array(z.any()).optional(),
    themeSetting: z.any().optional(),
    
    // 用户语言
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
    
    // 模式选择
    mode: z.enum(['agent', 'fast']).default('agent'),
});

// POST /api/game/generate-by-agents - 多智能体剧本生成（SSE 实时进度）
gameRoutes.post(
    '/generate-by-agents',
    zValidator('json', generateByAgentsSchema),
    async (c) => {
        const { characters, worldSetting, scenes, themeSetting, locale, mode } = c.req.valid('json');
        
        // 获取locale
        const userLocale = getLocaleFromRequest(locale);
        console.log(`[GameRoute] 开始生成剧本: mode=${mode}, locale=${userLocale}, ${characters.length} 角色, ${scenes?.length || 0} 场景`);
        
        // Fast 模式：使用旧的单次 LLM 调用（非 SSE）
        if (mode === 'fast') {
            try {
                const generator = new GameGenerator();
                const result = await generator.generateFromSetup(characters, worldSetting, scenes, themeSetting, userLocale);
                
                saveProject(result);
                
                return c.json({
                    success: true,
                    mode: 'fast',
                    data: result,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : '未知错误';
                return c.json({
                    success: false,
                    error: message,
                }, 500);
            }
        }
        
        // Agent 模式：使用多智能体系统（SSE 实时进度）
        return new Response(
            new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    const progressEmitter = createProgressEmitter();
                    const sessionId = progressEmitter.getSessionId();
                    
                    const sendEvent = (event: string, data: any) => {
                        const payload = JSON.stringify({ event, ...data });
                        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                    };
                    
                    // 监听进度事件
                    progressEmitter.on('progress', (progressEvent: ProgressEvent) => {
                        sendEvent('progress', progressEvent);
                    });
                    
                    try {
                        // 发送会话开始事件
                        sendEvent('session', { 
                            sessionId, 
                            status: 'started',
                            message: '多智能体剧本生成系统已启动',
                        });
                        
                        const agent = new GameGeneratorAgent({
                            maxRetries: 2,
                            minAcceptableScore: 60,
                        });
                        
                        const result = await agent.generateFromSetupWithProgress(
                            characters,
                            worldSetting,
                            scenes,
                            themeSetting,
                            progressEmitter,
                            userLocale
                        );
                        
                        // 保存项目
                        saveProject(result);
                        
                        // 发送最终结果
                        sendEvent('result', {
                            success: true,
                            mode: 'agent',
                            data: result,
                        });
                        
                    } catch (error) {
                        const message = error instanceof Error ? error.message : '未知错误';
                        console.error('[GameRoute] Agent 模式生成失败:', message);
                        
                        sendEvent('error', {
                            success: false,
                            error: message,
                        });
                    } finally {
                        // 清理
                        removeProgressEmitter(sessionId);
                        
                        // 发送结束事件
                        sendEvent('session', { 
                            sessionId, 
                            status: 'ended',
                            elapsedTime: progressEmitter.getElapsedTime(),
                        });
                        
                        controller.close();
                    }
                },
            }),
            {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
                },
            }
        );
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

// PUT /api/game/projects/:id - 更新或创建项目（upsert）
gameRoutes.put('/projects/:id', async (c) => {
    const projectId = c.req.param('id');
    const body = await c.req.json();
    
    if (!projectId) {
        return c.json({ success: false, error: 'Project ID is required' }, 400);
    }
    
    // 检查项目是否存在
    const existing = getProject(projectId);
    
    let result;
    if (existing) {
        // 项目存在，合并更新
        result = {
            ...existing,
            ...body,
            id: projectId, // 确保 ID 不被覆盖
            updatedAt: new Date().toISOString(),
        };
        console.log(`[GameRoute] 更新项目: ${projectId}`);
    } else {
        // 项目不存在，创建新项目
        result = {
            ...body,
            id: projectId,
            createdAt: body.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        console.log(`[GameRoute] 创建新项目: ${projectId}`);
    }
    
    saveProject(result);
    
    return c.json({
        success: true,
        data: result,
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
// 通用表单自动补全 API
// =====================================================

const autocompleteFormSchema = z.object({
    formType: z.enum(['character', 'world', 'scene', 'theme', 'background']),
    partialData: z.record(z.any()),
    context: z.object({
        projectTitle: z.string().optional(),
        genre: z.string().optional(),
        worldSetting: z.string().optional(),
        existingItems: z.array(z.string()).optional(),
    }).optional(),
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
});

// POST /api/game/autocomplete-form - 通用表单AI自动补全
gameRoutes.post(
    '/autocomplete-form',
    zValidator('json', autocompleteFormSchema),
    async (c) => {
        try {
            const { formType, partialData, context, locale } = c.req.valid('json');
            const userLocale = getLocaleFromRequest(locale);
            
            console.log(`[GameRoute] 自动补全表单: ${formType}, locale: ${userLocale}`);
            
            const autocomplete = new FormAutocomplete();
            const result = await autocomplete.autocomplete({
                formType: formType as FormType,
                partialData,
                context,
            }, userLocale);
            
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
            console.error('[GameRoute] 表单自动补全错误:', error);
            
            const message = error instanceof Error ? error.message : '未知错误';
            
            return c.json({
                success: false,
                error: '自动补全失败',
                details: message,
            }, 500);
        }
    }
);

// POST /api/game/autocomplete-character - 兼容旧API（转发到通用接口）
gameRoutes.post(
    '/autocomplete-character',
    async (c) => {
        try {
            const body = await c.req.json();
            
            console.log(`[GameRoute] 兼容旧API: autocomplete-character`);
            
            const autocomplete = new FormAutocomplete();
            const result = await autocomplete.autocomplete({
                formType: 'character',
                partialData: body.partialData || {},
                context: {
                    genre: body.context?.storyGenre,
                    worldSetting: body.context?.worldSetting,
                    existingItems: body.context?.existingCharacters,
                },
            });
            
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

// =====================================================
// 快速生成 API - 一句话生成全部设定
// =====================================================

const quickSetupSchema = z.object({
    prompt: z.string().min(1, '请提供故事描述'),
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
});

const ideaToDraftSchema = z.object({
    idea: z.string().min(1, 'idea 不能为空'),
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
});

// POST /api/game/quick-setup - 快速设定生成
gameRoutes.post(
    '/quick-setup',
    zValidator('json', quickSetupSchema),
    async (c) => {
        try {
            const { prompt, locale } = c.req.valid('json');
            const userLocale = getLocaleFromRequest(locale);
            
            console.log(`[GameRoute] 快速设定生成: prompt=${prompt.slice(0, 50)}..., locale=${userLocale}`);
            
            const result = await gameGeneratorAgent.quickSetup(prompt, userLocale);
            
            return c.json({
                success: true,
                data: result,
            });
        } catch (error) {
            console.error('[GameRoute] 快速设定生成错误:', error);
            
            const message = error instanceof Error ? error.message : '未知错误';
            
            return c.json({
                success: false,
                error: '设定生成失败',
                details: message,
            }, 500);
        }
    }
);

// POST /api/game/idea-to-draft - 根据创意生成设定草稿
gameRoutes.post(
    '/idea-to-draft',
    zValidator('json', ideaToDraftSchema),
    async (c) => {
        try {
            const { idea, locale } = c.req.valid('json');
            const userLocale = getLocaleFromRequest(locale);

            console.log(`[GameRoute] Idea to draft: locale=${userLocale}, idea="${idea.slice(0, 40)}..."`);
            const cacheKey = getCacheKey(`idea-draft:${userLocale}:${idea}`);
            const cachedDraft = getFromCache<any>(cacheKey);
            if (cachedDraft) {
                return c.json({
                    success: true,
                    cached: true,
                    data: cachedDraft,
                });
            }

            const draft = await ideaDraftGenerator.generateDraft(idea, userLocale);
            saveToCache(cacheKey, draft);

            return c.json({
                success: true,
                cached: false,
                data: draft,
            });
        } catch (error) {
            console.error('[GameRoute] Idea to draft error:', error);

            const message = error instanceof Error ? error.message : '未知错误';

            return c.json({
                success: false,
                error: message,
            }, 500);
        }
    }
);
