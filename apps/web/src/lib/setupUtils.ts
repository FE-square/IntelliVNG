/**
 * 设定页面工具函数
 * 
 * 用于构建完整的 GameProject 对象，以便在各个子页面直接保存到后端
 */

import { GameProject, Character, WorldSetting, Scene, ThemeSetting, Background } from '@vng/core';
import { createId } from '@vng/core';

/**
 * 从 sessionStorage 中获取正在编辑的项目基础数据
 */
export function getEditingProjectBase(): GameProject | null {
    if (typeof window === 'undefined') return null;
    
    const projectData = sessionStorage.getItem('editing_project');
    if (!projectData) return null;
    
    try {
        return JSON.parse(projectData);
    } catch (error) {
        console.error('[SetupUtils] 解析编辑项目数据失败:', error);
        return null;
    }
}

/**
 * 构建完整的 GameProject 对象
 * 
 * @param baseProject 基础项目数据（从 sessionStorage 获取）
 * @param characters 角色数据（从 setupStore 获取）
 * @param worldSetting 世界观数据（从 setupStore 获取）
 * @param scenes 场景数据（从 setupStore 获取）
 * @param themeSetting 主题风格数据（从 setupStore 获取）
 */
export function buildFullProject(
    baseProject: GameProject,
    characters: Character[],
    worldSetting: WorldSetting | null,
    scenes: Scene[],
    themeSetting: ThemeSetting | null
): GameProject {
    // 构建背景数据（从场景转换而来）
    let backgrounds: Background[] = scenes.map((scene, index) => {
        // 第一个背景包含世界观信息
        if (index === 0 && worldSetting) {
            // 将WorldSetting的era和location映射到Background的枚举类型
            let era: '古代' | '现代' | '未来' | '科幻' | '奇幻' | '其他' | undefined;
            let location: '城市' | '乡村' | '异世界' | '宇宙' | '海洋' | '其他' | undefined;
            
            // 简单映射规则
            if (worldSetting.era.includes('古代')) era = '古代';
            else if (worldSetting.era.includes('现代')) era = '现代';
            else if (worldSetting.era.includes('未来')) era = '未来';
            else if (worldSetting.era.includes('科幻')) era = '科幻';
            else if (worldSetting.era.includes('奇幻')) era = '奇幻';
            else era = '其他';
            
            if (worldSetting.location.includes('城市')) location = '城市';
            else if (worldSetting.location.includes('乡村')) location = '乡村';
            else if (worldSetting.location.includes('异世界')) location = '异世界';
            else if (worldSetting.location.includes('宇宙')) location = '宇宙';
            else if (worldSetting.location.includes('海洋')) location = '海洋';
            else location = '其他';
            
            return {
                id: scene.id,
                name: scene.name || worldSetting.name || '未命名世界',
                description: scene.description || '',
                imageUrl: scene.imageUrl || '',
                worldSetting: {
                    era,
                    location,
                    rules: worldSetting.rules,
                    specialElements: [],
                },
            };
        }
        
        return {
            id: scene.id,
            name: scene.name,
            description: scene.description || '',
            imageUrl: scene.imageUrl || '',
        };
    });
    
    // 如果没有场景但有世界观设定，创建一个包含世界观信息的默认背景
    if (backgrounds.length === 0 && worldSetting) {
        // 将WorldSetting的era和location映射到Background的枚举类型
        let era: '古代' | '现代' | '未来' | '科幻' | '奇幻' | '其他' | undefined;
        let location: '城市' | '乡村' | '异世界' | '宇宙' | '海洋' | '其他' | undefined;
        
        // 简单映射规则
        if (worldSetting.era.includes('古代')) era = '古代';
        else if (worldSetting.era.includes('现代')) era = '现代';
        else if (worldSetting.era.includes('未来')) era = '未来';
        else if (worldSetting.era.includes('科幻')) era = '科幻';
        else if (worldSetting.era.includes('奇幻')) era = '奇幻';
        else era = '其他';
        
        if (worldSetting.location.includes('城市')) location = '城市';
        else if (worldSetting.location.includes('乡村')) location = '乡村';
        else if (worldSetting.location.includes('异世界')) location = '异世界';
        else if (worldSetting.location.includes('宇宙')) location = '宇宙';
        else if (worldSetting.location.includes('海洋')) location = '海洋';
        else location = '其他';
        
        backgrounds = [{
            id: createId(),
            name: worldSetting.name || '未命名世界',
            description: '',
            imageUrl: '',
            worldSetting: {
                era,
                location,
                rules: worldSetting.rules,
                specialElements: [],
            },
        }];
    }

    // 构建元数据
    const meta = {
        author: baseProject.meta?.author || 'User',
        version: baseProject.meta?.version || '1.0.0',
        genre: (themeSetting?.styles?.[0] as any) || baseProject.meta?.genre || 'mystery',
        artStyle: baseProject.meta?.artStyle || 'anime',
        // 添加主题和风格信息到meta中
        themes: themeSetting?.themes || [],
        styles: themeSetting?.styles || [],
        tone: themeSetting?.tone || '',
    };

    // 构建完整的项目对象
    const fullProject = {
        ...baseProject,
        characters,
        backgrounds,
        meta,
        updatedAt: new Date().toISOString(),
    };

    // 同时保存scenes数据到sessionStorage中，以便在汇总页面加载时使用
    // 我们将scenes数据作为一个单独的字段附加到项目对象上，但只在sessionStorage中使用
    (fullProject as any).scenes = scenes;

    return fullProject;
}