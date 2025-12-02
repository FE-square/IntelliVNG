import { NextRequest, NextResponse } from 'next/server';

/**
 * 快速生成API - 一句话生成完整游戏
 * 
 * 流程:
 * 1. 接收用户的故事描述
 * 2. AI分析并生成角色、世界观、场景、主题
 * 3. 基于生成的设定创建剧情
 * 4. 返回完整的GameProject
 */
export async function POST(request: NextRequest) {
    try {
        const { prompt } = await request.json();

        if (!prompt || typeof prompt !== 'string') {
            return NextResponse.json(
                { success: false, error: '请提供故事描述' },
                { status: 400 }
            );
        }

        console.log('[Quick Generate] 开始快速生成,提示词:', prompt);

        // Step 1: 让AI根据描述生成完整设定
        const settingsResponse = await fetch(`${process.env.INTELLI_SERVICES_URL || 'http://localhost:4000'}/api/game/quick-setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });

        if (!settingsResponse.ok) {
            throw new Error('设定生成失败');
        }

        const settingsResult = await settingsResponse.json();
        if (!settingsResult.success) {
            throw new Error(settingsResult.error || '设定生成失败');
        }
        
        const settings = settingsResult.data;
        console.log('[Quick Generate] 设定生成成功:', {
            characters: settings.characters?.length,
            scenes: settings.scenes?.length,
        });

        // Step 2: 基于生成的设定生成剧情
        const storyResponse = await fetch(`${process.env.INTELLI_SERVICES_URL || 'http://localhost:4000'}/api/game/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                characters: settings.characters,
                worldSetting: settings.worldSetting,
                scenes: settings.scenes,
                themeSetting: settings.themeSetting,
                locale: 'zh-CN',
            }),
        });

        if (!storyResponse.ok) {
            throw new Error('剧情生成失败');
        }

        const storyResult = await storyResponse.json();
        if (!storyResult.success) {
            throw new Error(storyResult.error || '剧情生成失败');
        }
        
        const result = storyResult.data;
        console.log('[Quick Generate] 剧情生成成功,节点数:', result.script?.length);

        // Step 3: 直接返回生成的完整项目
        console.log('[Quick Generate] 项目创建成功:', result.id);

        return NextResponse.json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error('[Quick Generate] 生成失败:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '生成失败,请重试',
            },
            { status: 500 }
        );
    }
}
