/**
 * AI图片生成服务
 * 使用通义万相(Wanx)生成角色立绘、头像、场景背景图
 */

export type ImageType = 'sprite' | 'avatar' | 'background';

interface GenerateImageResult {
    imageUrl: string;
    prompt: string;
    type: ImageType;
    taskId?: string;
}

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

    async generate(prompt: string, type: ImageType, size?: string): Promise<GenerateImageResult> {
        const imageSize = size || DEFAULT_SIZES[type] || '1024*1024';

        console.log(`[ImageGenerator] 生成图片: type=${type}, size=${imageSize}, prompt=${prompt.substring(0, 50)}...`);

        if (!this.apiKey) {
            console.warn('[ImageGenerator] 未配置TONGYI_API_KEY,返回placeholder图片');
            return {
                imageUrl: `https://via.placeholder.com/${imageSize.replace('*', 'x')}?text=${encodeURIComponent(prompt.substring(0, 20))}`,
                prompt,
                type,
            };
        }

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
            throw new Error(`API请求失败: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();

        // 异步模式：轮询获取结果
        if (data.output?.task_id) {
            const taskId = data.output.task_id;
            console.log(`[ImageGenerator] 异步任务创建成功, task_id: ${taskId}`);

            // 轮询获取结果（最多等待30秒）
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const resultResponse = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                    },
                });

                if (!resultResponse.ok) {
                    continue;
                }

                const resultData = await resultResponse.json();
                console.log(`[ImageGenerator] 任务状态: ${resultData.output?.task_status}`);

                if (resultData.output?.task_status === 'SUCCEEDED') {
                    const imageUrl = resultData.output.results?.[0]?.url;
                    console.log(`[ImageGenerator] 生成成功: ${imageUrl}`);
                    return {
                        imageUrl,
                        prompt,
                        type,
                        taskId,
                    };
                } else if (resultData.output?.task_status === 'FAILED') {
                    throw new Error(resultData.output?.message || '图片生成失败');
                }
            }

            throw new Error('生成超时,请稍后重试');
        }

        // 同步模式直接返回
        const imageUrl = data.output?.results?.[0]?.url;
        return {
            imageUrl,
            prompt,
            type,
        };
    }
}

