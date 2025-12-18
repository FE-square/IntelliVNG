import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { GameGenerator } from '../services/game-generator';
import { GameGeneratorAgent, gameGeneratorAgent } from '../services/game-generator-agent';
import { ideaDraftGenerator } from '../services/idea-draft-generator';
import { createProgressEmitter, removeProgressEmitter, type ProgressEvent } from '../services/progress-emitter';
import { ImageGenerator, ImageType } from '../services/image-generator';
import { FormAutocomplete, FormType } from '../services/form-autocomplete';
import { getCacheKey, getFromCache, saveToCache, saveProject, getProject, listProjects, deleteProject } from '../services/cache';
import { getLocaleFromRequest, type Locale } from '../utils/locale';
import { tokenTracker } from '../services/token-tracker';

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
                const cacheKey = getCacheKey(`idea-script:${userLocale}:${idea}`);
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
    // 用户输入创意 (quickPrompt)
    idea: z.string().optional(),
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

// POST /api/game/generate-by-agents - 大模型生成 (普通 HTTP) / 多智能体剧本生成（SSE 实时进度）
gameRoutes.post(
    '/generate-by-agents',
    zValidator('json', generateByAgentsSchema),
    async (c) => {
        const { idea, characters, worldSetting, scenes, themeSetting, locale, mode } = c.req.valid('json');
        
        // 获取locale
        const userLocale = getLocaleFromRequest(locale);
        console.log(`[GameRoute] 开始生成剧本: mode=${mode}, locale=${userLocale}, ${characters.length} 角色, ${scenes?.length || 0} 场景`);
        // ============================================================
        // 检查缓存（如果有 idea）
        // ============================================================
        if (idea && idea.trim()) {
            const cacheKey = getCacheKey(`idea-script:${userLocale}:${idea}`);
            const cachedProject = getFromCache<any>(cacheKey);
            
            if (cachedProject) {
                console.log(`[GameRoute] 命中完整项目缓存: idea="${idea.slice(0, 30)}..."`);
                
                // Fast 模式：直接返回 JSON
                if (mode === 'fast') {
                    return c.json({
                        success: true,
                        mode: 'fast',
                        data: cachedProject,
                        cached: true, // 标记为缓存数据
                    });
                }
                
                // Agent 模式：通过 SSE 返回
                return new Response(
                    new ReadableStream({
                        async start(controller) {
                            const encoder = new TextEncoder();
                            const sendEvent = (event: string, data: any) => {
                                const payload = JSON.stringify({ event, ...data });
                                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                            };
                            
                            // 发送会话开始事件
                            sendEvent('session', { 
                                sessionId: `cached-${Date.now()}`,
                                status: 'started',
                                message: '已命中缓存，无需重新生成',
                            });
                            
                            // 模拟短暂进度
                            sendEvent('progress', {
                                stage: 'completed',
                                action: '从缓存加载',
                                status: 'completed',
                                progress: 100,
                                message: '已从缓存加载完整项目数据',
                                timestamp: Date.now(),
                            });
                            
                            // 发送结果
                            sendEvent('result', {
                                success: true,
                                mode: 'agent',
                                data: cachedProject,
                                cached: true,
                            });
                            
                            // 发送结束事件
                            sendEvent('session', { 
                                sessionId: `cached-${Date.now()}`,
                                status: 'ended',
                                elapsedTime: 0,
                            });
                            
                            controller.close();
                        }
                    }),
                    {
                        headers: {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                        },
                    }
                );
            } else {
                console.log(`[GameRoute] 未命中缓存，将生成新项目: idea="${idea.slice(0, 30)}..."`);
            }
        }
        
        // ============================================================
        // 未命中缓存，正常生成流程
        // ============================================================
        
        // Fast 模式：使用单次 LLM 调用（非 SSE）
        if (mode === 'fast') {
            try {
                const generator = new GameGenerator();
                const result = await generator.generateFromSetup(characters, worldSetting, scenes, themeSetting, userLocale);
                
                saveProject(result);
                
                // 如果有 idea，将生成的项目保存到缓存
                if (idea && idea.trim()) {
                    const cacheKey = getCacheKey(`idea-script:${userLocale}:${idea}`);
                    saveToCache(cacheKey, result);
                    console.log(`[GameRoute] 已将生成的项目保存到缓存: idea="${idea.slice(0, 30)}..."`);
                }
                
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
                    
                    // 跟踪流状态，避免在关闭后写入
                    let isStreamClosed = false;
                    
                    /**
                     * 安全发送 SSE 事件
                     * 返回 true 表示发送成功，false 表示流已关闭
                     */
                    const sendEvent = (event: string, data: any): boolean => {
                        if (isStreamClosed) {
                            console.log(`[GameRoute] SSE 流已关闭，跳过事件: ${event}`);
                            return false;
                        }
                        
                        try {
                            const payload = JSON.stringify({ event, ...data });
                            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                            return true;
                        } catch (err) {
                            const errMsg = err instanceof Error ? err.message : String(err);
                            // 检测流关闭错误
                            if (errMsg.includes('Controller is already closed') || 
                                errMsg.includes('closed') ||
                                errMsg.includes('CLOSED')) {
                                isStreamClosed = true;
                                console.log(`[GameRoute] SSE 流已被客户端关闭 (sessionId: ${sessionId})`);
                                return false;
                            }
                            // 其他错误重新抛出
                            throw err;
                        }
                    };
                    
                    /**
                     * 发送心跳（SSE 注释格式，不会触发前端事件处理）
                     */
                    const sendHeartbeat = (): boolean => {
                        if (isStreamClosed) return false;
                        try {
                            // SSE 规范：以冒号开头的是注释，客户端会忽略但连接保持活跃
                            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
                            return true;
                        } catch (err) {
                            isStreamClosed = true;
                            return false;
                        }
                    };
                    
                    /**
                     * 安全关闭流
                     */
                    const safeCloseStream = () => {
                        if (!isStreamClosed) {
                            try {
                                controller.close();
                            } catch (err) {
                                // 忽略关闭时的错误
                            }
                            isStreamClosed = true;
                        }
                    };
                    
                    // ========== 心跳机制：每 25 秒发送一次 ==========
                    // 保持连接活跃，防止代理/网关超时（通常 30-60 秒）
                    const heartbeatInterval = setInterval(() => {
                        if (!sendHeartbeat()) {
                            clearInterval(heartbeatInterval);
                        }
                    }, 25000);
                    
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
                        
                        // 检查流是否仍然打开
                        if (isStreamClosed) {
                            console.log(`[GameRoute] 生成完成但客户端已断开 (sessionId: ${sessionId})`);
                            // 仍然保存结果，即使客户端断开
                            saveProject(result);
                            if (idea && idea.trim()) {
                                const cacheKey = getCacheKey(`idea-script:${userLocale}:${idea}`);
                                saveToCache(cacheKey, result);
                            }
                            return;
                        }
                        
                        // 保存项目
                        saveProject(result);
                        
                        // 如果有 idea，将生成的项目保存到缓存
                        if (idea && idea.trim()) {
                            const cacheKey = getCacheKey(`idea-script:${userLocale}:${idea}`);
                            saveToCache(cacheKey, result);
                            console.log(`[GameRoute] 已将生成的项目保存到缓存 (Agent模式): idea="${idea.slice(0, 30)}..."`);
                        }
                        
                        // 发送最终结果
                        sendEvent('result', {
                            success: true,
                            mode: 'agent',
                            data: result,
                        });
                        
                    } catch (error) {
                        const message = error instanceof Error ? error.message : '未知错误';
                        
                        // 检查是否是流关闭导致的错误
                        if (message.includes('Controller is already closed') || isStreamClosed) {
                            console.log(`[GameRoute] Agent 模式：客户端已断开连接 (sessionId: ${sessionId})`);
                        } else {
                            console.error('[GameRoute] Agent 模式生成失败:', message);
                            
                            // 尝试发送错误给前端
                            sendEvent('error', {
                                success: false,
                                error: message,
                            });
                        }
                    } finally {
                        // 停止心跳
                        clearInterval(heartbeatInterval);
                        
                        // 清理进度发射器
                        removeProgressEmitter(sessionId);
                        
                        // 尝试发送结束事件（如果流仍然打开）
                        sendEvent('session', { 
                            sessionId, 
                            status: 'ended',
                            elapsedTime: progressEmitter.getElapsedTime(),
                        });
                        
                        // 安全关闭流
                        safeCloseStream();
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
        console.log(`[GameRoute] 项目不存在: ${projectId}`);
        return c.json({ success: false, error: 'Project not found' }, 404);
    }
    
    // 详细日志：原始数据
    console.log(`[GameRoute] GET原始数据 - projectId: ${projectId}`);
    console.log(`[GameRoute] characters类型:`, typeof (project as any).characters);
    console.log(`[GameRoute] characters[0]:`, JSON.stringify((project as any).characters?.[0]));
    console.log(`[GameRoute] backgrounds[0]:`, JSON.stringify((project as any).backgrounds?.[0]));
    
    console.log(`[GameRoute] 返回项目: ${projectId}`, {
        characters: (project as any).characters?.map((c: any) => ({
            id: c.id,
            name: c.displayName,
            avatarUrl: c.avatarUrl,
            spritesCount: c.sprites?.length || 0
        })),
        backgrounds: (project as any).backgrounds?.map((b: any) => ({
            id: b.id,
            name: b.name,
            imageUrl: b.imageUrl,
            hasImage: !!b.imageUrl
        }))
    });
    
    console.log(`[GameRoute] 完整项目数据:`, JSON.stringify(project, null, 2).substring(0, 500));
    
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
    
    console.log(`[GameRoute] PUT请求 - projectId: ${projectId}`);
    console.log(`[GameRoute] 接收到的数据:`, {
        characters: body.characters?.map((c: any) => ({
            id: c.id,
            name: c.displayName,
            avatarUrl: c.avatarUrl,
            spritesCount: c.sprites?.length || 0
        })),
        backgrounds: body.backgrounds?.map((b: any) => ({
            id: b.id,
            name: b.name,
            hasImage: !!b.imageUrl
        }))
    });
    
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
    
    console.log(`[GameRoute] 保存前的数据:`, {
        characters: result.characters?.map((c: any) => ({
            id: c.id,
            name: c.displayName,
            avatarUrl: c.avatarUrl,
            spritesCount: c.sprites?.length || 0
        })),
        backgrounds: result.backgrounds?.map((b: any) => ({
            id: b.id,
            name: b.name,
            imageUrl: b.imageUrl,
            hasImage: !!b.imageUrl
        }))
    });
    
    saveProject(result);
    
    // 验证保存后的数据
    const saved = getProject(projectId);
    console.log(`[GameRoute] 保存后的数据:`, {
        characters: (saved as any)?.characters?.map((c: any) => ({
            id: c.id,
            name: c.displayName,
            avatarUrl: c.avatarUrl,
            spritesCount: c.sprites?.length || 0
        })),
        backgrounds: (saved as any)?.backgrounds?.map((b: any) => ({
            id: b.id,
            name: b.name,
            imageUrl: b.imageUrl,
            hasImage: !!b.imageUrl
        }))
    });
    
    return c.json({
        success: true,
        data: result,
    });
});

// DELETE /api/game/projects/:id - 删除项目
gameRoutes.delete('/projects/:id', async (c) => {
    const projectId = c.req.param('id');
    
    if (!projectId) {
        return c.json({ success: false, error: 'Project ID is required' }, 400);
    }
    
    console.log(`[GameRoute] DELETE请求 - projectId: ${projectId}`);
    
    const success = deleteProject(projectId);
    
    if (success) {
        return c.json({
            success: true,
            message: `Project ${projectId} deleted successfully`,
        });
    } else {
        return c.json({
            success: false,
            error: 'Project not found or failed to delete',
        }, 404);
    }
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
            } 
            // 如果是sprite类型，尝试使用抠图流程生成透明背景
            else if (type === 'sprite') {
                try {
                    result = await imageGenerator.generateSpriteWithTransparency(prompt, size);
                } catch (transparencyError) {
                    // 抠图失败，回退到普通生成
                    console.warn('[GameRoute] 透明背景生成失败，回退到普通生成:', transparencyError);
                    result = await imageGenerator.generate(prompt, type as ImageType, size);
                }
            } 
            // 其他类型普通生成
            else {
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

// =====================================================
// 错误码定义（用于前端多语言显示）
// =====================================================
const IMAGE_GENERATION_ERROR_CODES = {
  TRANSPARENCY_FAILED_FALLBACK: 'IMAGE_TRANSPARENCY_FAILED_FALLBACK', // 透明背景生成失败，切换到普通模式
} as const;

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
                        } 
                        // 如果是sprite类型，尝试使用抠图流程生成透明背景
                        else if (type === 'sprite') {
                            try {
                                result = await imageGenerator.generateSpriteWithTransparency(
                                    prompt,
                                    size,
                                    onStatus
                                );
                            } catch (transparencyError) {
                                // 抠图失败，回退到普通生成
                                console.warn('[GameRoute] 透明背景生成失败，回退到普通生成:', transparencyError);
                                sendEvent({ 
                                    status: 'RUNNING', 
                                    messageCode: IMAGE_GENERATION_ERROR_CODES.TRANSPARENCY_FAILED_FALLBACK,
                                    progress: 10 
                                });
                                result = await imageGenerator.generate(
                                    prompt,
                                    type as ImageType,
                                    size,
                                    onStatus
                                );
                            }
                        }
                        else {
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

// =====================================================
// 编辑器 AI 对话 API
// =====================================================

import { 
    editorChatAgent, 
    createEditorChatAgent,
    extractActions, 
    type EditorAction 
} from '../agents/editorChat';
import { 
    getSession, 
    addMessage, 
    updateContext, 
    generateContextFromProject, 
    getMessagesForLLM 
} from '../services/chat-memory';
import { callIntelliVngMcpTool } from '../services/intellivng-mcp-client';

const editorChatSchema = z.object({
    projectId: z.string().min(1, 'projectId is required'),
    message: z.string().min(1, 'message is required'),
    currentScript: z.array(z.any()).optional(),
    characters: z.array(z.any()).optional(),
    backgrounds: z.array(z.any()).optional(),
    projectTitle: z.string().optional(),
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
});

// POST /api/game/editor-chat - 编辑器 AI 对话 (SSE)
gameRoutes.post(
    '/editor-chat',
    zValidator('json', editorChatSchema),
    async (c) => {
        const { projectId, message, currentScript, characters, backgrounds, projectTitle, locale } = c.req.valid('json');
        const userLocale = getLocaleFromRequest(locale);
        
        console.log(`[EditorChat] 收到对话请求: projectId=${projectId}, locale=${userLocale}, chars=${characters?.length || 0}, bgs=${backgrounds?.length || 0}, message="${message.slice(0, 50)}..."`);
        
        // 更新项目上下文
        if (currentScript || characters || projectTitle) {
            updateContext(projectId, {
                projectId,
                title: projectTitle,
                nodeCount: currentScript?.length || 0,
                characterCount: characters?.length || 0,
                endingCount: currentScript?.filter((n: any) => n.isEnding).length || 0,
                hasStartNode: currentScript?.some((n: any) => n.isStart) || false,
            });
        }
        
        // 添加用户消息到记忆
        addMessage(projectId, {
            role: 'user',
            content: message,
        });
        
        // 如果提供了当前剧本，添加到上下文
        let systemContext = '';
        if (currentScript && currentScript.length > 0) {
            const scriptSummary = currentScript.map((node: any) => ({
                id: node.id,
                title: node.title,
                type: node.type,
                isStart: node.isStart,
                isEnding: node.isEnding,
                dialogueCount: node.dialogues?.length || 0,
                choiceCount: node.choices?.length || 0,
                nextNodeId: node.nextNodeId,
            }));
            systemContext = `\n\n当前剧本结构:\n${JSON.stringify(scriptSummary, null, 2)}`;
        }
        
        if (characters && characters.length > 0) {
            const characterSummary = characters.map((char: any) => ({
                id: char.id,
                name: char.displayName || char.name,
                hasAvatar: !!char.avatarUrl,
                hasSpriteCount: char.sprites?.length || 0,
            }));
            systemContext += `\n\n角色列表:\n${JSON.stringify(characterSummary, null, 2)}`;
        }
        
        if (backgrounds && backgrounds.length > 0) {
            const bgSummary = backgrounds.map((bg: any) => ({
                id: bg.id,
                name: bg.name,
                hasImage: !!bg.imageUrl,
            }));
            systemContext += `\n\n背景列表:\n${JSON.stringify(bgSummary, null, 2)}`;
        }
        
        // 创建 SSE 流
        return new Response(
            new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    let isStreamClosed = false;
                    
                    const sendEvent = (event: string, data: any): boolean => {
                        if (isStreamClosed) return false;
                        try {
                            const payload = JSON.stringify({ event, ...data });
                            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                            return true;
                        } catch (err) {
                            isStreamClosed = true;
                            return false;
                        }
                    };
                    
                    const safeCloseStream = () => {
                        if (!isStreamClosed) {
                            try {
                                controller.close();
                            } catch (err) {
                                // ignore
                            }
                            isStreamClosed = true;
                        }
                    };
                    
                    try {
                        // 发送开始事件
                        sendEvent('start', { timestamp: Date.now() });
                        
                        // 构建完整的用户消息（包含上下文）
                        const fullMessage = systemContext 
                            ? `${message}\n\n[系统上下文]${systemContext}`
                            : message;
                        
                        // 调用 Agent
                        sendEvent('thinking', { message: '正在思考...' });
                        
                        // 创建特定 locale 的 agent 实例
                        const createAgent = (profile: 'primary' | 'backup') => createEditorChatAgent(profile, userLocale);
                        
                        let response;
                        try {
                            const primaryAgent = createAgent('primary');
                            response = await primaryAgent.generate(fullMessage, {
                                maxSteps: 5,
                                modelSettings: { temperature: 0.7 },
                            });
                        } catch (error) {
                            console.warn('[EditorChat] Primary agent failed, trying backup...', error);
                            // Fallback to backup profile
                            const backupAgent = createAgent('backup');
                            response = await backupAgent.generate(fullMessage, {
                                maxSteps: 5,
                                modelSettings: { temperature: 0.7 },
                            });
                        }
                        
                        // 提取工具调用结果
                        console.log('[EditorChat] Agent 响应:', {
                            textLength: response.text?.length,
                            toolCalls: response.toolCalls?.length || 0,
                            toolResults: response.toolResults?.length || 0,
                            steps: response.steps?.length || 0,
                            usage: response.usage ? JSON.stringify(response.usage) : 'N/A',
                        });
                        
                        // ✅ 追踪 Token 使用
                        tokenTracker.trackMastraAgent({
                            sessionId: projectId,
                            agentName: 'editor-chat',
                            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',  // 或从 agent 配置中获取
                            response,
                            operation: 'editor-chat',
                            metadata: { messageLength: fullMessage.length },
                        });
                        
                        // ✅ 如果有 thinking/reasoning 过程，输出到前端
                        if (response.steps && response.steps.length > 0) {
                            response.steps.forEach((step: any, index: number) => {
                                if (step.text) {
                                    sendEvent('thinking', { 
                                        stepIndex: index,
                                        content: step.text,
                                        timestamp: Date.now() 
                                    });
                                }
                            });
                        }
                        
                        // ✅ 输出 Token 使用信息到前端
                        const usageInfo = tokenTracker.extractFromMastraResponse(response);
                        if (usageInfo) {
                            sendEvent('usage', {
                                ...usageInfo,
                                timestamp: Date.now(),
                            });
                        }
                        
                        // 调试：打印详细的工具调用信息
                        // 先打印第一个 toolCall 的完整结构来了解格式
                        if (response.toolCalls && response.toolCalls.length > 0) {
                            console.log('[EditorChat] toolCalls[0] 结构:', JSON.stringify(response.toolCalls[0], null, 2).slice(0, 500));
                        }
                        // 从 steps 中提取工具调用信息（更可靠）
                        if (response.steps && response.steps.length > 0) {
                            response.steps.forEach((step: any, i: number) => {
                                if (step.toolCalls && step.toolCalls.length > 0) {
                                    step.toolCalls.forEach((tc: any) => {
                                        console.log(`[EditorChat] Step ${i + 1} 工具: ${tc.toolName}`, JSON.stringify(tc.args || {}).slice(0, 200));
                                    });
                                }
                            });
                        }
                        
                        const toolResults = response.toolResults || [];
                        // ✅ 调试：打印 toolResults 结构
                        if (toolResults.length > 0) {
                            console.log('[EditorChat] toolResults[0] 结构:', JSON.stringify(toolResults[0], null, 2).slice(0, 800));
                        }
                        const actions = extractActions(toolResults);
                        console.log('[EditorChat] 提取到的动作:', actions.length, actions.map(a => a.action));
                        
                        // 处理分析类动作（需要调用 MCP）
                        const processedActions: any[] = [];
                        for (const action of actions) {
                            if (action.action === 'analyze-story' && currentScript) {
                                sendEvent('tool_call', { 
                                    tool: 'analyze-story', 
                                    type: action.analysisType 
                                });
                                
                                try {
                                    const nodes = currentScript.map((node: any) => ({
                                        id: node.id,
                                        type: node.type,
                                        isStart: node.isStart,
                                        isEnding: node.isEnding,
                                        nextNodeId: node.nextNodeId,
                                        choices: node.choices?.map((c: any) => ({
                                            targetNodeId: c.targetNodeId,
                                        })),
                                        dialogues: node.dialogues,
                                        narration: node.narration,
                                    }));
                                    
                                    let analysisResult: any = {};
                                    
                                    if (action.analysisType === 'all' || action.analysisType === 'validate') {
                                        analysisResult.validate = await callIntelliVngMcpTool('validate_story_structure', { nodes });
                                    }
                                    if (action.analysisType === 'all' || action.analysisType === 'paths') {
                                        analysisResult.paths = await callIntelliVngMcpTool('analyze_story_paths', { nodes });
                                    }
                                    if (action.analysisType === 'all' || action.analysisType === 'dialogue') {
                                        analysisResult.dialogue = await callIntelliVngMcpTool('analyze_dialogue_quality', { nodes });
                                    }
                                    if (action.analysisType === 'all' || action.analysisType === 'branch') {
                                        analysisResult.branch = await callIntelliVngMcpTool('analyze_branch_distribution', { nodes });
                                    }
                                    if (action.analysisType === 'all' || action.analysisType === 'score') {
                                        analysisResult.score = await callIntelliVngMcpTool('score_nonlinearity', { nodes });
                                    }
                                    if (action.analysisType === 'constraints') {
                                        analysisResult.constraints = await callIntelliVngMcpTool('check_constraints_compliance', { 
                                            nodes, 
                                            constraints: action.constraints 
                                        });
                                    }
                                    
                                    console.log('[EditorChat] MCP 分析结果:', JSON.stringify(analysisResult).slice(0, 500));
                                    processedActions.push({
                                        type: 'analysis',
                                        payload: analysisResult,
                                    });
                                } catch (mcpError) {
                                    console.error('[EditorChat] MCP 调用失败:', mcpError);
                                    processedActions.push({
                                        type: 'error',
                                        payload: { message: '剧本分析失败' },
                                    });
                                }
                            } else if (action.action === 'query-nodes') {
                                // 查询节点直接返回数据
                                let queryResult: any[] = currentScript || [];
                                if (action.nodeId) {
                                    queryResult = queryResult.filter((n: any) => n.id === action.nodeId);
                                }
                                if (action.filter) {
                                    if (action.filter.type) {
                                        queryResult = queryResult.filter((n: any) => n.type === action.filter.type);
                                    }
                                    if (action.filter.isStart !== undefined) {
                                        queryResult = queryResult.filter((n: any) => n.isStart === action.filter.isStart);
                                    }
                                    if (action.filter.isEnding !== undefined) {
                                        queryResult = queryResult.filter((n: any) => n.isEnding === action.filter.isEnding);
                                    }
                                }
                                processedActions.push({
                                    type: 'query-result',
                                    payload: { nodes: queryResult },
                                });
                            } else if (action.action === 'generate-image') {
                                // 根据 targetName 匹配实际的角色/场景
                                const imageType = action.type;
                                const targetName = action.targetName;
                                let targetId: string | null = null;
                                let matchedName: string | null = null;
                                
                                if (imageType === 'sprite' || imageType === 'avatar') {
                                    // 从角色列表中查找（支持模糊匹配）
                                    const char = characters?.find((c: any) => {
                                        const name = c.displayName || c.name;
                                        return name === targetName || 
                                               name.includes(targetName) || 
                                               targetName.includes(name) ||
                                               c.name === targetName ||
                                               c.name.includes(targetName);
                                    });
                                    if (char) {
                                        targetId = char.id;
                                        matchedName = char.displayName || char.name;
                                    }
                                } else if (imageType === 'background') {
                                    // 从背景列表中查找
                                    const bg = backgrounds?.find((b: any) => {
                                        return b.name === targetName || 
                                               b.name.includes(targetName) || 
                                               targetName.includes(b.name);
                                    });
                                    if (bg) {
                                        targetId = bg.id;
                                        matchedName = bg.name;
                                    }
                                }
                                
                                if (targetId) {
                                    processedActions.push({
                                        type: 'generate-image',
                                        payload: {
                                            imageType,  // sprite | avatar | background
                                            targetId,
                                            targetName: matchedName,
                                            prompt: action.prompt,
                                        },
                                    });
                                    console.log(`[EditorChat] 匹配到生图目标: ${imageType} -> ${matchedName} (${targetId})`);
                                } else {
                                    // 找不到目标，返回错误信息给 AI
                                    console.warn(`[EditorChat] 找不到生图目标: ${imageType} "${targetName}"`);
                                    processedActions.push({
                                        type: 'error',
                                        payload: { 
                                            message: `找不到${imageType === 'background' ? '场景' : '角色'}"${targetName}"，请检查名称是否正确` 
                                        },
                                    });
                                }
                            } else {
                                // 其他动作直接传递给前端执行
                                processedActions.push({
                                    type: 'patch',
                                    payload: action,
                                });
                            }
                        }
                        
                        // 发送 AI 回复
                        sendEvent('message', { 
                            content: response.text,
                            timestamp: Date.now(),
                        });
                        
                        // 发送动作指令
                        if (processedActions.length > 0) {
                            for (const action of processedActions) {
                                sendEvent('action', action);
                            }
                        }
                        
                        // 保存 AI 回复到记忆
                        addMessage(projectId, {
                            role: 'assistant',
                            content: response.text,
                            toolCalls: toolResults,
                            actions: processedActions,
                        });
                        
                        // 发送完成事件
                        sendEvent('done', { 
                            timestamp: Date.now(),
                            actionCount: processedActions.length,
                        });
                        
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : '未知错误';
                        console.error('[EditorChat] 对话处理失败:', errorMessage);
                        
                        sendEvent('error', { 
                            message: errorMessage,
                            timestamp: Date.now(),
                        });
                    } finally {
                        safeCloseStream();
                    }
                },
            }),
            {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                },
            }
        );
    }
);

// GET /api/game/editor-chat/history/:projectId - 获取对话历史
gameRoutes.get('/editor-chat/history/:projectId', async (c) => {
    const projectId = c.req.param('projectId');
    
    if (!projectId) {
        return c.json({ success: false, error: 'projectId is required' }, 400);
    }
    
    const session = getSession(projectId);
    
    return c.json({
        success: true,
        data: {
            projectId: session.projectId,
            messages: session.messages,
            context: session.context,
        },
    });
});

// ============ Token 使用统计 API ============

// GET /api/game/token-stats - 获取全局 Token 统计（支持时间范围查询）
gameRoutes.get('/token-stats', async (c) => {
    const startTimeStr = c.req.query('startTime');
    const endTimeStr = c.req.query('endTime');
    
    let summary;
    let imageCostSummary;
    
    if (startTimeStr) {
        const startTime = parseInt(startTimeStr, 10);
        const endTime = endTimeStr ? parseInt(endTimeStr, 10) : Date.now();
        summary = tokenTracker.getSummaryByTimeRange(startTime, endTime);
        imageCostSummary = tokenTracker.getImageCostSummary(startTime, endTime);
    } else {
        summary = tokenTracker.getGlobalSummary();
        imageCostSummary = tokenTracker.getImageCostSummary();
    }
    
    return c.json({
        success: true,
        data: {
            totalPromptTokens: summary.totalPromptTokens,
            totalCompletionTokens: summary.totalCompletionTokens,
            totalTokens: summary.totalTokens,
            callCount: summary.callCount,
            bySource: summary.bySource,
            byModel: summary.byModel,
            byAgent: summary.byAgent,
            // 图像费用统计
            imageCost: imageCostSummary,
        },
    });
});

// GET /api/game/token-stats/:sessionId - 获取会话 Token 统计
gameRoutes.get('/token-stats/:sessionId', async (c) => {
    const sessionId = c.req.param('sessionId');
    const summary = tokenTracker.getSessionSummary(sessionId);
    
    return c.json({
        success: true,
        data: {
            sessionId,
            totalPromptTokens: summary.totalPromptTokens,
            totalCompletionTokens: summary.totalCompletionTokens,
            totalTokens: summary.totalTokens,
            callCount: summary.callCount,
            bySource: summary.bySource,
            byModel: summary.byModel,
            byAgent: summary.byAgent,
        },
    });
});

// GET /api/game/token-stats/report - 获取格式化报告
gameRoutes.get('/token-stats/report', async (c) => {
    const report = tokenTracker.getFormattedReport();
    
    return c.text(report, 200, {
        'Content-Type': 'text/plain; charset=utf-8',
    });
});

// DELETE /api/game/token-stats - 清除所有统计
gameRoutes.delete('/token-stats', async (c) => {
    tokenTracker.clearAll();
    
    return c.json({
        success: true,
        message: 'Token statistics cleared',
    });
});
