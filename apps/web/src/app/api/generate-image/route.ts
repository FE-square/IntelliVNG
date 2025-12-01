import { NextRequest, NextResponse } from 'next/server';

/**
 * AI图片生成API路由
 * 使用通义万相(Wanx)生成角色立绘、头像、场景背景图
 */

interface GenerateImageRequest {
    prompt: string;
    type: 'sprite' | 'avatar' | 'background';
    size?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as GenerateImageRequest;
        const { prompt, type, size } = body;

        console.log('[generate-image] 收到请求:', { prompt: prompt?.substring(0, 50), type, size });

        if (!prompt) {
            return NextResponse.json(
                { error: '缺少prompt参数' },
                { status: 400 }
            );
        }

        // 根据类型设置默认尺寸 (通义万相支持的尺寸)
        const defaultSize = {
            sprite: '768*1152',    // 角色立绘 2:3比例 (竖屏)
            avatar: '1024*1024',   // 头像 1:1方形
            background: '1280*720' // 场景背景 16:9横屏 (通义万相支持)
        };

        const imageSize = size || defaultSize[type] || '1024*1024';

        // 调用通义万相API
        const apiKey = process.env.TONGYI_API_KEY;
        
        console.log('[generate-image] API Key 状态:', apiKey ? `存在 (${apiKey.substring(0, 8)}...)` : '不存在');
        
        if (!apiKey) {
            console.warn('[generate-image] 未配置TONGYI_API_KEY,使用placeholder图片');
            // 开发模式:返回placeholder
            return NextResponse.json({
                imageUrl: `https://via.placeholder.com/${imageSize.replace('*', 'x')}?text=${encodeURIComponent(prompt.substring(0, 20))}`,
                prompt,
                type,
            });
        }

        // 真实API调用
        console.log('[generate-image] 调用通义万相API, size:', imageSize);
        
        const apiResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable', // 异步模式
            },
            body: JSON.stringify({
                model: 'wanx-v1',
                input: {
                    prompt: prompt,
                    // ✅ 如果是立绘或头像，强化排除复杂背景
                    ...(type === 'sprite' || type === 'avatar' ? {
                        negative_prompt: 'complex background, detailed background, scenery, landscape, outdoor, indoor scene, room, furniture, props, objects, 复杂背景, 场景, 风景, 室内, 室外, 家具, 道具',
                    } : {}),
                },
                parameters: {
                    size: imageSize,
                    n: 1,
                    seed: Math.floor(Math.random() * 1000000),
                    // ✅ 尝试设置refiner来提高质量
                    ...(type === 'sprite' || type === 'avatar' ? {
                        style: '<anime>',  // 动漫风格
                    } : {}),
                },
            }),
        });

        console.log('[generate-image] API响应状态:', apiResponse.status);

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('[generate-image] 通义万相API错误:', errorText);
            throw new Error(`API请求失败: ${apiResponse.status} - ${errorText}`);
        }

        const data = await apiResponse.json();
        console.log('[generate-image] API响应数据:', JSON.stringify(data).substring(0, 200));

        // 异步模式:需要轮询获取结果
        if (data.output?.task_id) {
            const taskId = data.output.task_id;
            console.log('[generate-image] 异步任务创建成功, task_id:', taskId);
            
            // 轮询获取结果(最多等待30秒)
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
                
                console.log(`[generate-image] 轮询第 ${i + 1} 次...`);
                
                const resultResponse = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                    },
                });

                if (!resultResponse.ok) {
                    console.error('[generate-image] 轮询请求失败:', resultResponse.status);
                    continue;
                }

                const resultData = await resultResponse.json();
                console.log('[generate-image] 任务状态:', resultData.output?.task_status);

                if (resultData.output?.task_status === 'SUCCEEDED') {
                    const imageUrl = resultData.output.results?.[0]?.url;
                    console.log('[generate-image] 生成成功, imageUrl:', imageUrl);
                    return NextResponse.json({
                        imageUrl,
                        prompt,
                        type,
                        taskId,
                    });
                } else if (resultData.output?.task_status === 'FAILED') {
                    const errorMsg = resultData.output?.message || '图片生成失败';
                    console.error('[generate-image] 任务失败:', errorMsg);
                    throw new Error(errorMsg);
                }
            }

            console.error('[generate-image] 生成超时');
            throw new Error('生成超时,请稍后重试');
        }

        // 同步模式直接返回
        const imageUrl = data.output?.results?.[0]?.url;
        
        return NextResponse.json({
            imageUrl,
            prompt,
            type,
        });

    } catch (error) {
        console.error('图片生成错误:', error);
        return NextResponse.json(
            { 
                error: '图片生成失败',
                details: error instanceof Error ? error.message : '未知错误'
            },
            { status: 500 }
        );
    }
}
