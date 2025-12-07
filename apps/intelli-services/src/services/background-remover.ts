import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 图片去背景服务
 * 调用Python rembg脚本去除图片背景
 */
export class BackgroundRemover {
    private pythonScript: string;
    private isAvailable: boolean = false;

    constructor() {
        this.pythonScript = join(__dirname, '../scripts/remove_bg.py');
        this.checkAvailability();
    }

    /**
     * 检查Python环境和rembg是否可用
     */
    private async checkAvailability(): Promise<void> {
        try {
            const result = await this.executePython('{"url": "test"}');
            // 如果没有抛出错误，说明环境可用
            this.isAvailable = false; // 测试会失败，但能确认脚本可运行
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.includes('rembg not installed')) {
                console.warn('[BackgroundRemover] rembg not installed. Background removal disabled.');
                console.warn('[BackgroundRemover] To enable: pip install -r apps/intelli-services/scripts/requirements.txt');
                this.isAvailable = false;
            } else {
                // 其他错误（如测试URL失败）说明环境可用
                this.isAvailable = true;
            }
        }
    }

    /**
     * 执行Python脚本
     */
    private executePython(input: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const python = spawn('python3', [this.pythonScript]);
            
            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script failed: ${stderr || stdout}`));
                } else {
                    resolve(stdout);
                }
            });

            python.on('error', (error) => {
                reject(new Error(`Failed to spawn Python: ${error.message}`));
            });

            // 写入输入数据
            python.stdin.write(input);
            python.stdin.end();
        });
    }

    /**
     * 从URL去除背景
     */
    async removeBackgroundFromUrl(imageUrl: string): Promise<string> {
        if (!this.isAvailable) {
            console.warn('[BackgroundRemover] Service not available, returning original URL');
            return imageUrl;
        }

        try {
            console.log('[BackgroundRemover] Processing:', imageUrl);
            
            const input = JSON.stringify({ url: imageUrl });
            const output = await this.executePython(input);
            
            const result = JSON.parse(output);
            
            if (!result.success) {
                throw new Error(result.error || 'Unknown error');
            }

            // 将base64数据转换为临时文件或返回data URL
            const dataUrl = `data:image/png;base64,${result.data}`;
            
            console.log('[BackgroundRemover] Background removed successfully');
            return dataUrl;

        } catch (error) {
            console.error('[BackgroundRemover] Failed to remove background:', error);
            // 失败时返回原始URL
            return imageUrl;
        }
    }

    /**
     * 批量处理多个图片
     */
    async removeBackgroundBatch(imageUrls: string[]): Promise<string[]> {
        const results = await Promise.all(
            imageUrls.map(url => this.removeBackgroundFromUrl(url))
        );
        return results;
    }

    /**
     * 保存base64图片到文件
     */
    saveBase64ToFile(base64Data: string, outputPath: string): void {
        const buffer = Buffer.from(base64Data, 'base64');
        writeFileSync(outputPath, buffer);
    }

    /**
     * 检查服务是否可用
     */
    isServiceAvailable(): boolean {
        return this.isAvailable;
    }
}

// 单例
export const backgroundRemover = new BackgroundRemover();
