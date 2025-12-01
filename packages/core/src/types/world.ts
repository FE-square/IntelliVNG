/**
 * 世界观设定 - 整个游戏的宏观背景
 */
export interface WorldSetting {
    id: string;
    name: string;                    // 世界观名称
    era: string;                     // 时代：古风/赛博朋克/现代/未来等
    location: string;                // 地域：架空城邦/校园/荒野等
    rules?: string;                  // 核心规则：魔法体系/科技限制/社会规则等
    socialStructure?: string;        // 社会结构：阶级划分/权力体系等
    history?: string;                // 历史背景：关键事件/王朝更迭等
    description?: string;            // 详细描述或补充说明
}

/**
 * 故事主题风格设定
 */
export interface ThemeSetting {
    id: string;
    themes: string[];                // 主题标签：如 ['亲情羁绊', '善恶拉择', '反抗压迫']
    styles: string[];                // 风格标签：如 ['悬疑推理', '浪漫言情', '热血战斗']
    tone?: string;                   // 整体基调描述
    description?: string;            // 自定义补充说明
}
/**
 * 场景定义 - 具体的游戏场景
 */
export interface Scene {
    id: string;
    name: string;                    // 场景名称
    type: string;                    // 场景类型：卧室/会议室/战场/街道等
    atmosphere: string;              // 氛围：压抑/轻松/紧张/神秘等
    details?: string;                // 关键环境细节（如“墙上挂着褪色的锦旗”）
    function?: string;               // 场景功能：触发线索/冲突爆发/情感升温等
    imageUrl?: string;               // 场景参考图或背景图
    description?: string;            // 场景描述
}
