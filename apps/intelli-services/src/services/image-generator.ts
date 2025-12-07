/**
 * AI图片生成服务
 * 使用通义万相(Wanx)生成角色立绘、头像、场景背景图
 * 
 * 特性：
 * - 支持异步轮询模式，返回任务状态
 * - 支持参考图生成（ref_img），用于保持角色形象一致性
 * - 集成rembg自动去除立绘背景
 */

import { backgroundRemover } from './background-remover';

export type ImageType = 'sprite' | 'avatar' | 'background';

// 生成状态
export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

interface GenerateImageResult {
    imageUrl: string;
    prompt: string;
    type: ImageType;
    taskId?: string;
}

// 状态回调类型
export type StatusCallback = (status: TaskStatus, message: string, progress?: number) => void;

// 根据类型设置默认尺寸
const DEFAULT_SIZES: Record<ImageType, string> = {
    sprite: '768*1152',     // 角色立绘 2:3比例 (竖屏)
    avatar: '1024*1024',    // 头像 1:1方形
    background: '1280*720', // 场景背景 16:9横屏
};

export class ImageGenerator {
    private apiKey: string | undefined;

    constructor() {
        this.apiKey = process.env.TONGYI_API_KEY;
    }

    /**
     * 生成图片（文生图）
     * @param prompt 提示词
     * @param type 图片类型
     * @param size 尺寸
     * @param onStatus 状态回调（可选）
     */
    async generate(
        prompt: string, 
        type: ImageType, 
        size?: string,
        onStatus?: StatusCallback
    ): Promise<GenerateImageResult> {
        const imageSize = size || DEFAULT_SIZES[type] || '1024*1024';

        console.log(`[ImageGenerator] 生成图片: type=${type}, size=${imageSize}, prompt=${prompt.substring(0, 50)}...`);
        onStatus?.('PENDING', '准备生成图片...', 0);

        if (!this.apiKey) {
            console.warn('[ImageGenerator] 未配置TONGYI_API_KEY,返回placeholder图片');
            onStatus?.('SUCCEEDED', '使用占位图片（未配置API Key）', 100);
            return {
                imageUrl: `https://via.placeholder.com/${imageSize.replace('*', 'x')}?text=${encodeURIComponent(prompt.substring(0, 20))}`,
                prompt,
                type,
            };
        }

        onStatus?.('RUNNING', '正在调用AI生成服务...', 10);

        // 调用通义万相API
        const apiResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable',
            },
            body: JSON.stringify({
                model: 'wanx-v1',
                input: {
                    prompt: prompt,
                    ...(type === 'sprite' || type === 'avatar' ? {
                        negative_prompt: 'complex background, detailed background, scenery, landscape, outdoor, indoor scene, room, furniture, props, objects, 复杂背景, 场景, 风景, 室内, 室外, 家具, 道具',
                    } : {}),
                },
                parameters: {
                    size: imageSize,
                    n: 1,
                    seed: Math.floor(Math.random() * 1000000),
                    ...(type === 'sprite' || type === 'avatar' ? {
                        style: '<anime>',
                    } : {}),
                },
            }),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('[ImageGenerator] API错误:', errorText);
            onStatus?.('FAILED', `API请求失败: ${apiResponse.status}`, 0);
            throw new Error(`API请求失败: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();

        // 异步模式：轮询获取结果
        if (data.output?.task_id) {
            const taskId = data.output.task_id;
            console.log(`[ImageGenerator] 异步任务创建成功, task_id: ${taskId}`);
            onStatus?.('RUNNING', `任务已创建，正在生成中... (ID: ${taskId.substring(0, 8)}...)`, 20);

            // 轮询获取结果（最多等待60秒）
            for (let i = 0; i < 60; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const progress = Math.min(20 + Math.floor((i / 60) * 70), 90);
                onStatus?.('RUNNING', `AI正在绘制图片... (${i + 1}s)`, progress);

                const resultResponse = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                    },
                });

                if (!resultResponse.ok) {
                    continue;
                }

                const resultData = await resultResponse.json();
                const taskStatus = resultData.output?.task_status;
                console.log(`[ImageGenerator] 任务状态: ${taskStatus}`);

                if (taskStatus === 'SUCCEEDED') {
                    let imageUrl = resultData.output.results?.[0]?.url;
                    console.log(`[ImageGenerator] 生成成功: ${imageUrl}`);
                    
                    // ✅ 如果是立绘，尝试去除背景
                    if (type === 'sprite' && backgroundRemover.isServiceAvailable()) {
                        onStatus?.('RUNNING', '正在去除背景...', 95);
                        try {
                            imageUrl = await backgroundRemover.removeBackgroundFromUrl(imageUrl);
                            console.log('[ImageGenerator] 背景已去除');
                        } catch (error) {
                            console.warn('[ImageGenerator] 去除背景失败，使用原始图片:', error);
                        }
                    }
                    
                    onStatus?.('SUCCEEDED', '图片生成完成！', 100);
                    return {
                        imageUrl,
                        prompt,
                        type,
                        taskId,
                    };
                } else if (taskStatus === 'FAILED') {
                    const errorMsg = resultData.output?.message || '图片生成失败';
                    onStatus?.('FAILED', errorMsg, 0);
                    throw new Error(errorMsg);
                }
            }

            onStatus?.('FAILED', '生成超时,请稍后重试', 0);
            throw new Error('生成超时,请稍后重试');
        }

        // 同步模式直接返回
        const imageUrl = data.output?.results?.[0]?.url;
        onStatus?.('SUCCEEDED', '图片生成完成！', 100);
        return {
            imageUrl,
            prompt,
            type,
        };
    }

    /**
     * 基于参考图生成图片（图生图）
     * 用于根据立绘生成保持一致性的头像
     * 
     * @param prompt 提示词
     * @param refImageUrl 参考图URL（公网可访问）
     * @param type 图片类型
     * @param size 尺寸
     * @param refStrength 参考强度 0-1
     * @param onStatus 状态回调
     */
    async generateWithReference(
        prompt: string,
        refImageUrl: string,
        type: ImageType = 'avatar',
        size?: string,
        refStrength: number = 0.7,
        onStatus?: StatusCallback
    ): Promise<GenerateImageResult> {
        const imageSize = size || DEFAULT_SIZES[type] || '1024*1024';

        console.log(`[ImageGenerator] 基于参考图生成: type=${type}, refUrl=${refImageUrl.substring(0, 50)}...`);
        onStatus?.('PENDING', '准备基于参考图生成...', 0);

        if (!this.apiKey) {
            console.warn('[ImageGenerator] 未配置TONGYI_API_KEY,返回placeholder图片');
            onStatus?.('SUCCEEDED', '使用占位图片（未配置API Key）', 100);
            return {
                imageUrl: `https://via.placeholder.com/${imageSize.replace('*', 'x')}?text=Avatar`,
                prompt,
                type,
            };
        }

        onStatus?.('RUNNING', '正在基于立绘生成头像...', 10);

        // 调用通义万相API（带参考图）
        const apiResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable',
            },
            body: JSON.stringify({
                model: 'wanx-v1',
                input: {
                    prompt: prompt,
                    ref_img: refImageUrl,  // 参考图URL
                    negative_prompt: 'complex background, detailed background, scenery, 复杂背景, 场景',
                },
                parameters: {
                    size: imageSize,
                    n: 1,
                    seed: Math.floor(Math.random() * 1000000),
                    style: '<anime>',
                    ref_mode: 'refonly',  // 仅参考风格/形象
                    ref_strength: refStrength,  // 参考强度
                },
            }),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('[ImageGenerator] API错误:', errorText);
            onStatus?.('FAILED', `API请求失败: ${apiResponse.status}`, 0);
            throw new Error(`API请求失败: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();

        // 异步模式：轮询获取结果
        if (data.output?.task_id) {
            const taskId = data.output.task_id;
            console.log(`[ImageGenerator] 异步任务创建成功, task_id: ${taskId}`);
            onStatus?.('RUNNING', `基于参考图生成中... (ID: ${taskId.substring(0, 8)}...)`, 20);

            // 轮询获取结果（最多等待60秒）
            for (let i = 0; i < 60; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const progress = Math.min(20 + Math.floor((i / 60) * 70), 90);
                onStatus?.('RUNNING', `AI正在基于立绘生成头像... (${i + 1}s)`, progress);

                const resultResponse = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                    },
                });

                if (!resultResponse.ok) {
                    continue;
                }

                const resultData = await resultResponse.json();
                const taskStatus = resultData.output?.task_status;
                console.log(`[ImageGenerator] 任务状态: ${taskStatus}`);

                if (taskStatus === 'SUCCEEDED') {
                    let imageUrl = resultData.output.results?.[0]?.url;
                    console.log(`[ImageGenerator] 参考图生成成功: ${imageUrl}`);
                    
                    // ✅ 如果是立绘，尝试去除背景
                    if (type === 'sprite' && backgroundRemover.isServiceAvailable()) {
                        onStatus?.('RUNNING', '正在去除背景...', 95);
                        try {
                            imageUrl = await backgroundRemover.removeBackgroundFromUrl(imageUrl);
                            console.log('[ImageGenerator] 背景已去除');
                        } catch (error) {
                            console.warn('[ImageGenerator] 去除背景失败，使用原始图片:', error);
                        }
                    }
                    
                    onStatus?.('SUCCEEDED', '头像生成完成！', 100);
                    return {
                        imageUrl,
                        prompt,
                        type,
                        taskId,
                    };
                } else if (taskStatus === 'FAILED') {
                    const errorMsg = resultData.output?.message || '图片生成失败';
                    onStatus?.('FAILED', errorMsg, 0);
                    throw new Error(errorMsg);
                }
            }

            onStatus?.('FAILED', '生成超时,请稍后重试', 0);
            throw new Error('生成超时,请稍后重试');
        }

        // 同步模式直接返回
        const imageUrl = data.output?.results?.[0]?.url;
        onStatus?.('SUCCEEDED', '头像生成完成！', 100);
        return {
            imageUrl,
            prompt,
            type,
        };
    }
}
