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
    private checkPromise: Promise<void>;

    constructor() {
        this.pythonScript = join(__dirname, '../scripts/remove_bg.py');
        // 启动检查，但不阻塞构造函数
        this.checkPromise = this.checkAvailability();
    }

    /**
     * 检查Python环境和rembg是否可用
     */
    private async checkAvailability(): Promise<void> {
        try {
            console.log('[BackgroundRemover] 正在检测rembg环境...');
            const testInput = JSON.stringify({ url: 'test' });
            await this.executePython(testInput);
            // 测试成功（虽然URL无效，但脚本能运行）
            this.isAvailable = true;
            console.log('[BackgroundRemover] ✅ rembg环境可用');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.includes('rembg not installed') || errorMsg.includes('No module named')) {
                console.warn('[BackgroundRemover] ❌ rembg未安装，去背景功能已禁用');
                console.warn('[BackgroundRemover] 安装方法: pip3 install -r apps/intelli-services/scripts/requirements.txt');
                this.isAvailable = false;
            } else {
                // 其他错误（如测试URL失败、SSL错误）说明脚本能运行，环境可用
                console.log('[BackgroundRemover] ✅ rembg环境可用（测试URL失败是正常的）');
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
        // 等待检查完成
        await this.checkPromise;
        
        if (!this.isAvailable) {
            console.warn('[BackgroundRemover] 服务不可用，返回原始URL');
            return imageUrl;
        }

        try {
            console.log('[BackgroundRemover] 正在处理:', imageUrl.substring(0, 80) + '...');
            
            const input = JSON.stringify({ url: imageUrl });
            const output = await this.executePython(input);
            
            const result = JSON.parse(output);
            
            if (!result.success) {
                throw new Error(result.error || 'Unknown error');
            }

            // 将base64数据转换为临时文件或返回data URL
            const dataUrl = `data:image/png;base64,${result.data}`;
            
            console.log('[BackgroundRemover] ✅ 背景已成功去除，返回透明PNG');
            return dataUrl;

        } catch (error) {
            console.error('[BackgroundRemover] 去除背景失败:', error);
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
