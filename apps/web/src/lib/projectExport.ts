
import { GameProject } from '@vng/core';

/**
 * 将图片 URL 转换为 Base64 Data URL
 */
async function imageUrlToBase64(url: string): Promise<string> {
    try {
        // 支持跨域和本地图片
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) {
            console.warn(`无法加载图片: ${url}`);
            return url; // 失败时保留原 URL
        }
        
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn(`转换图片失败: ${url}`, error);
        return url; // 失败时保留原 URL
    }
}

/**
 * 收集项目中所有图片 URL
 */
function collectImageUrls(project: GameProject): Set<string> {
    const urls = new Set<string>();
    
    // 1. 角色立绘和头像
    project.characters.forEach(char => {
        if (char.avatarUrl) urls.add(char.avatarUrl);
        char.sprites?.forEach(sprite => {
            if (sprite.imageUrl) urls.add(sprite.imageUrl);
        });
    });
    
    // 2. 背景图片
    project.backgrounds.forEach(bg => {
        if (bg.imageUrl) urls.add(bg.imageUrl);
    });
    
    // 3. 节点中的视觉资源
    project.script.forEach(node => {
        if (node.visualAssets?.backgroundImageUrl) {
            urls.add(node.visualAssets.backgroundImageUrl);
        }
        node.visualAssets?.characters?.forEach(charAsset => {
            if (charAsset.spriteUrl) urls.add(charAsset.spriteUrl);
        });
    });
    
    // 4. 封面图
    if (project.coverImage) urls.add(project.coverImage);
    
    return urls;
}

/**
 * 将项目中的所有图片 URL 替换为 Base64
 */
async function embedImagesAsBase64(
    project: GameProject, 
    onProgress?: (current: number, total: number, url: string) => void
): Promise<GameProject> {
    const projectData = JSON.parse(JSON.stringify(project)) as GameProject;
    
    // 收集所有图片 URL
    const imageUrls = Array.from(collectImageUrls(project));
    const total = imageUrls.length;
    
    if (total === 0) {
        return projectData; // 没有图片，直接返回
    }
    
    // 创建 URL -> Base64 映射
    const urlToBase64Map = new Map<string, string>();
    
    // 批量转换图片
    for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        onProgress?.(i + 1, total, url);
        const base64 = await imageUrlToBase64(url);
        urlToBase64Map.set(url, base64);
    }
    
    // 替换项目中的所有 URL
    const replaceUrl = (url?: string) => {
        if (!url) return url;
        return urlToBase64Map.get(url) || url;
    };
    
    // 1. 替换角色图片
    projectData.characters.forEach(char => {
        char.avatarUrl = replaceUrl(char.avatarUrl);
        char.sprites?.forEach(sprite => {
            sprite.imageUrl = replaceUrl(sprite.imageUrl) || sprite.imageUrl;
        });
    });
    
    // 2. 替换背景图片
    projectData.backgrounds.forEach(bg => {
        bg.imageUrl = replaceUrl(bg.imageUrl) || bg.imageUrl;
    });
    
    // 3. 替换节点中的图片
    projectData.script.forEach(node => {
        if (node.visualAssets?.backgroundImageUrl) {
            node.visualAssets.backgroundImageUrl = replaceUrl(node.visualAssets.backgroundImageUrl);
        }
        node.visualAssets?.characters?.forEach(charAsset => {
            charAsset.spriteUrl = replaceUrl(charAsset.spriteUrl);
        });
    });
    
    // 4. 替换封面图
    projectData.coverImage = replaceUrl(projectData.coverImage);
    
    return projectData;
}

/**
 * 注入数据到 HTML 模板并隐藏上传界面
 */
function injectDataAndHideUpload(template: string, projectData: GameProject): string {
    // 1. 注入数据
    const startTag = '<script id="game-data" type="application/json">';
    const endTag = '</script>';
    
    const startIndex = template.indexOf(startTag);
    if (startIndex !== -1) {
        const endIndex = template.indexOf(endTag, startIndex);
        if (endIndex !== -1) {
            const before = template.substring(0, startIndex);
            const after = template.substring(endIndex + endTag.length);
            const scriptBlock = `${startTag}${JSON.stringify(projectData)}${endTag}`;
            template = before + scriptBlock + after;
        }
    }
    
    // 2. 隐藏上传界面
    // 简单地给 div 添加 hidden 类
    template = template.replace(
        '<div id="upload-screen">', 
        '<div id="upload-screen" class="hidden">'
    );
    
    return template;
}

/**
 * 导出项目为独立的可玩 HTML 文件（不含图片资源）
 */
export async function exportProjectAsPlayableHtml(project: GameProject): Promise<void> {
    try {
        // 1. 获取播放器模板
        const response = await fetch('/standalone-player.html');
        if (!response.ok) {
            throw new Error('无法加载播放器模板');
        }
        let template = await response.text();

        // 2. 深度克隆项目数据
        const projectData = JSON.parse(JSON.stringify(project));

        // 3. 注入数据并处理 HTML
        template = injectDataAndHideUpload(template, projectData);

        // 4. 下载文件
        const blob = new Blob([template], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${project.title || 'game'}_playable.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('导出失败:', error);
        throw error;
    }
}

/**
 * 导出项目为独立的可玩 HTML 文件（含 Base64 内嵌图片资源）
 */
export async function exportProjectAsPlayableHtmlWithImages(
    project: GameProject,
    onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
    try {
        onProgress?.(0, 100, '正在加载播放器模板...');
        
        // 1. 获取播放器模板
        const response = await fetch('/standalone-player.html');
        if (!response.ok) {
            throw new Error('无法加载播放器模板');
        }
        let template = await response.text();
        
        onProgress?.(10, 100, '正在收集图片资源...');
        
        // 2. 将所有图片转换为 Base64
        const projectData = await embedImagesAsBase64(project, (current, total, url) => {
            const progress = 10 + Math.floor((current / total) * 70); // 10-80%
            const fileName = url.split('/').pop()?.substring(0, 30) || 'unknown';
            onProgress?.(progress, 100, `正在转换图片 ${current}/${total}: ${fileName}...`);
        });
        
        onProgress?.(85, 100, '正在打包数据...');

        // 3. 注入数据并处理 HTML
        template = injectDataAndHideUpload(template, projectData);
        
        onProgress?.(95, 100, '正在生成文件...');

        // 4. 下载文件
        const blob = new Blob([template], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${project.title || 'game'}_standalone.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        onProgress?.(100, 100, '导出完成！');

    } catch (error) {
        console.error('导出失败:', error);
        throw error;
    }
}

/**
 * 导出项目为 JSON 文件
 */
export function exportProjectAsJson(project: GameProject): void {
    const dataStr = JSON.stringify(project, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title || 'project'}_${project.id}.vng.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * 从 JSON 文件导入项目
 */
export function importProjectFromJson(file: File): Promise<GameProject> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const project = JSON.parse(content) as GameProject;
                
                // 基本验证
                if (!project.id || !project.title || !project.script) {
                    throw new Error('无效的项目文件格式');
                }
                
                resolve(project);
            } catch (error) {
                reject(new Error(`解析项目文件失败: ${error instanceof Error ? error.message : '未知错误'}`));
            }
        };
        
        reader.onerror = () => {
            reject(new Error('读取文件失败'));
        };
        
        reader.readAsText(file);
    });
}

/**
 * 触发文件选择对话框
 */
export function openFileDialog(accept: string = '.json'): Promise<File> {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                resolve(file);
            } else {
                reject(new Error('未选择文件'));
            }
        };
        
        input.click();
    });
}
