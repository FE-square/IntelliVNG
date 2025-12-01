/**
 * 项目导出/导入工具
 */

import { GameProject } from '@vng/core';

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

