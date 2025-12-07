/**
 * AI图片生成服务
 * 使用通义万相(Wanx)生成角色立绘、头像、场景背景图
 * 
 * 特性：
 * - 支持异步轮询模式，返回任务状态
 * - 支持参考图生成（ref_img），用于保持角色形象一致性
 * - 支持自动抠图生成透明背景（sprite类型）
 */

import sharp from 'sharp';

export type ImageType = 'sprite' | 'avatar' | 'background';

// 生成状态
export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

// 基础生图模型
const IMAGE_BASE_MODEL = 'wan2.2-t2i-flash'; // 'wanx-v1';
// 图生图模型
const IMAGE_EDIT_MODEL = 'qwen-image-edit-plus'; // 'wanx2.1-imageedit';

// 根据类型设置默认尺寸 wan2.2-t2i-flash 支持 [512, 1440] 像素范围内的任意宽高组合。
const DEFAULT_SIZES: Record<ImageType, string> = {
    sprite: '512*768',// '768*1152',     // 角色立绘 2:3比例 (竖屏)
    avatar: '512*512',// '1024*1024',    // 头像 1:1方形
    background: '1024*576',// '1280*720', // 场景背景 16:9横屏
};

interface GenerateImageResult {
    imageUrl: string;
    prompt: string;
    type: ImageType;
    taskId?: string;
}

// 状态回调类型
export type StatusCallback = (status: TaskStatus, message: string, progress?: number) => void;



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
                model: IMAGE_BASE_MODEL,
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

            // 轮询获取结果（最多等待180秒）
            for (let i = 0; i < 180; i++) {
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
                    const imageUrl = resultData.output.results?.[0]?.url;
                    console.log(`[ImageGenerator] 生成成功: ${imageUrl}`);
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
                model: IMAGE_BASE_MODEL,
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

            // 轮询获取结果（最多等待180秒）
            for (let i = 0; i < 180; i++) {
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
                    const imageUrl = resultData.output.results?.[0]?.url;
                    console.log(`[ImageGenerator] 参考图生成成功: ${imageUrl}`);
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

    /**
     * 使用通义千问图像编辑模型生成二值mask图
     * @param imageUrl 原始图片URL（公网可访问）
     * @param onStatus 状态回调
     * @returns mask图片URL
     */
    async generateMask(
        imageUrl: string,
        onStatus?: StatusCallback
    ): Promise<string> {
        console.log(`[ImageGenerator] 生成mask: imageUrl=${imageUrl.substring(0, 50)}...`);
        onStatus?.('RUNNING', '正在生成抠图遮罩...', 0);

        if (!this.apiKey) {
            throw new Error('未配置TONGYI_API_KEY');
        }

        // 调用通义千问图像编辑API
        const apiResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: IMAGE_EDIT_MODEL,
                input: {
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    image: imageUrl,
                                },
                                {
                                    text: '生成主体角色的二值图mask，主体必须纯白色，其余必须纯黑色',
                                },
                            ],
                        },
                    ],
                },
                parameters: {
                    n: 1,
                    negative_prompt: ' ',
                    prompt_extend: false,
                    watermark: false,
                },
            }),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('[ImageGenerator] 生成mask API错误:', errorText);
            onStatus?.('FAILED', `生成mask失败: ${apiResponse.status}`, 0);
            throw new Error(`生成mask API请求失败: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();
        console.log('[ImageGenerator] Mask API响应:', JSON.stringify(data, null, 2));

        // 从响应中提取mask图片URL
        // 根据API返回格式，图片URL可能在不同位置
        const maskUrl = data.output?.choices?.[0]?.message?.content?.[0]?.image ||
                        data.output?.results?.[0]?.url ||
                        data.output?.image;

        if (!maskUrl) {
            console.error('[ImageGenerator] 无法从响应中获取mask URL:', data);
            onStatus?.('FAILED', '生成mask失败: 无法获取mask图片', 0);
            throw new Error('生成mask失败: 无法获取mask图片URL');
        }

        console.log(`[ImageGenerator] Mask生成成功: ${maskUrl}`);
        onStatus?.('RUNNING', 'Mask生成完成，准备抠图...', 50);
        return maskUrl;
    }

    /**
     * 根据mask二值图对原图进行抠图，生成透明背景PNG
     * @param originalImageUrl 原始图片URL
     * @param maskUrl mask图片URL（主体白色，背景黑色）
     * @param onStatus 状态回调
     * @returns base64编码的透明背景PNG图片 (data:image/png;base64,...)
     */
    async applyMaskToImage(
        originalImageUrl: string,
        maskUrl: string,
        onStatus?: StatusCallback
    ): Promise<string> {
        console.log(`[ImageGenerator] 应用mask抠图...`);
        onStatus?.('RUNNING', '正在下载图片...', 60);

        // 并行下载原图和mask
        const [originalResponse, maskResponse] = await Promise.all([
            fetch(originalImageUrl),
            fetch(maskUrl),
        ]);

        if (!originalResponse.ok || !maskResponse.ok) {
            throw new Error('下载图片失败');
        }

        onStatus?.('RUNNING', '正在处理图片...', 70);

        const originalBuffer = Buffer.from(await originalResponse.arrayBuffer());
        const maskBuffer = Buffer.from(await maskResponse.arrayBuffer());

        // 获取原图信息
        const originalImage = sharp(originalBuffer);
        const originalMetadata = await originalImage.metadata();
        const { width, height } = originalMetadata;

        if (!width || !height) {
            throw new Error('无法获取图片尺寸');
        }

        onStatus?.('RUNNING', '正在生成透明背景...', 80);

        // 将mask调整为与原图相同尺寸，并转为灰度图
        const resizedMask = await sharp(maskBuffer)
            .resize(width, height)
            .grayscale()
            .raw()
            .toBuffer();

        // 获取原图的RGBA数据
        const originalRgba = await sharp(originalBuffer)
            .ensureAlpha()
            .raw()
            .toBuffer();

        // 创建新的RGBA buffer，使用mask作为alpha通道
        const outputBuffer = Buffer.alloc(width * height * 4);

        for (let i = 0; i < width * height; i++) {
            const rgbaIndex = i * 4;
            const maskValue = resizedMask[i]; // mask灰度值 (0-255)

            // 复制RGB值
            outputBuffer[rgbaIndex] = originalRgba[rgbaIndex];     // R
            outputBuffer[rgbaIndex + 1] = originalRgba[rgbaIndex + 1]; // G
            outputBuffer[rgbaIndex + 2] = originalRgba[rgbaIndex + 2]; // B
            // 使用mask值作为alpha（白色=255=不透明，黑色=0=透明）
            outputBuffer[rgbaIndex + 3] = maskValue;
        }

        onStatus?.('RUNNING', '正在编码PNG...', 90);

        // 生成PNG图片
        const pngBuffer = await sharp(outputBuffer, {
            raw: {
                width,
                height,
                channels: 4,
            },
        })
            .png()
            .toBuffer();

        // 转为base64 data URL
        const base64 = pngBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;

        console.log(`[ImageGenerator] 抠图完成，生成透明背景PNG (${Math.round(pngBuffer.length / 1024)}KB)`);
        onStatus?.('SUCCEEDED', '透明背景图片生成完成！', 100);

        return dataUrl;
    }

    /**
     * 生成带透明背景的角色立绘（sprite专用）
     * 流程：1. 生成原始图片 -> 2. 生成mask -> 3. 抠图
     * 
     * @param prompt 提示词
     * @param size 尺寸
     * @param onStatus 状态回调
     */
    async generateSpriteWithTransparency(
        prompt: string,
        size?: string,
        onStatus?: StatusCallback
    ): Promise<GenerateImageResult> {
        const imageSize = size || DEFAULT_SIZES.sprite;

        console.log(`[ImageGenerator] 生成透明背景立绘: size=${imageSize}, prompt=${prompt.substring(0, 50)}...`);
        onStatus?.('PENDING', '准备生成透明背景立绘...', 0);

        if (!this.apiKey) {
            console.warn('[ImageGenerator] 未配置TONGYI_API_KEY,返回placeholder图片');
            onStatus?.('SUCCEEDED', '使用占位图片（未配置API Key）', 100);
            return {
                imageUrl: `https://via.placeholder.com/${imageSize.replace('*', 'x')}?text=${encodeURIComponent(prompt.substring(0, 20))}`,
                prompt,
                type: 'sprite',
            };
        }

        // Step 1: 生成原始图片
        onStatus?.('RUNNING', '第1步: 正在生成角色立绘...', 5);
        
        const originalResult = await this.generateRawImage(prompt, imageSize, (status, message, progress) => {
            // 映射进度到 5-40%
            const mappedProgress = progress ? 5 + Math.floor(progress * 0.35) : undefined;
            onStatus?.(status, `第1步: ${message}`, mappedProgress);
        });

        const originalImageUrl = originalResult.imageUrl;
        console.log(`[ImageGenerator] 原始立绘生成完成: ${originalImageUrl}`);

        // Step 2: 生成mask
        onStatus?.('RUNNING', '第2步: 正在生成抠图遮罩...', 45);
        
        const maskUrl = await this.generateMask(originalImageUrl, (status, message, progress) => {
            // 映射进度到 45-70%
            const mappedProgress = progress ? 45 + Math.floor(progress * 0.25) : undefined;
            onStatus?.(status, `第2步: ${message}`, mappedProgress);
        });

        // Step 3: 应用mask抠图
        onStatus?.('RUNNING', '第3步: 正在应用遮罩生成透明背景...', 75);
        
        const transparentImageUrl = await this.applyMaskToImage(originalImageUrl, maskUrl, (status, message, progress) => {
            // 映射进度到 75-100%
            const mappedProgress = progress ? 75 + Math.floor((progress - 60) * 0.625) : undefined;
            onStatus?.(status, `第3步: ${message}`, mappedProgress);
        });

        onStatus?.('SUCCEEDED', '透明背景立绘生成完成！', 100);

        return {
            imageUrl: transparentImageUrl,
            prompt,
            type: 'sprite',
            taskId: originalResult.taskId,
        };
    }

    /**
     * 内部方法：生成原始图片（不带抠图处理）
     */
    private async generateRawImage(
        prompt: string,
        size: string,
        onStatus?: StatusCallback
    ): Promise<{ imageUrl: string; taskId?: string }> {
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
                model: IMAGE_BASE_MODEL,
                input: {
                    prompt: prompt,
                    negative_prompt: 'complex background, detailed background, scenery, landscape, outdoor, indoor scene, room, furniture, props, objects, 复杂背景, 场景, 风景, 室内, 室外, 家具, 道具',
                },
                parameters: {
                    size: size,
                    n: 1,
                    seed: Math.floor(Math.random() * 1000000),
                    style: '<anime>',
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

            // 轮询获取结果（最多等待180秒）
            for (let i = 0; i < 180; i++) {
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

                if (taskStatus === 'SUCCEEDED') {
                    const imageUrl = resultData.output.results?.[0]?.url;
                    onStatus?.('SUCCEEDED', '图片生成完成！', 100);
                    return { imageUrl, taskId };
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
        return { imageUrl };
    }
}
