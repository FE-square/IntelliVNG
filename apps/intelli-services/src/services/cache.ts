import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), '.cache');

// 确保缓存目录存在
if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * 生成缓存 key（基于输入内容的 hash）
 */
export function getCacheKey(input: string): string {
    return createHash('md5').update(input.trim().toLowerCase()).digest('hex');
}

/**
 * 获取缓存文件路径
 */
function getCacheFilePath(key: string): string {
    return join(CACHE_DIR, `${key}.json`);
}

/**
 * 从缓存中读取
 */
export function getFromCache<T>(key: string): T | null {
    const filePath = getCacheFilePath(key);
    
    if (!existsSync(filePath)) {
        return null;
    }
    
    try {
        const data = readFileSync(filePath, 'utf-8');
        const cached = JSON.parse(data);
        
        console.log(`[Cache] Hit for key: ${key.slice(0, 8)}...`);
        return cached.data as T;
    } catch (error) {
        console.error('[Cache] Failed to read cache:', error);
        return null;
    }
}

/**
 * 写入缓存
 */
export function saveToCache<T>(key: string, data: T): void {
    const filePath = getCacheFilePath(key);
    
    try {
        const cacheData = {
            key,
            timestamp: new Date().toISOString(),
            data,
        };
        
        writeFileSync(filePath, JSON.stringify(cacheData, null, 2), 'utf-8');
        console.log(`[Cache] Saved for key: ${key.slice(0, 8)}...`);
    } catch (error) {
        console.error('[Cache] Failed to save cache:', error);
    }
}

/**
 * 清除所有缓存
 */
export function clearCache(): void {
    const fs = require('fs');
    const files = fs.readdirSync(CACHE_DIR);
    
    for (const file of files) {
        if (file.endsWith('.json')) {
            fs.unlinkSync(join(CACHE_DIR, file));
        }
    }
    
    console.log('[Cache] Cleared all cache');
}

