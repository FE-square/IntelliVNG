/**
 * 简单的国际化辅助模块
 * 支持 zh-CN (默认) 和 en-US
 */
export type Locale = "zh-CN" | "en-US";
declare const MESSAGES: {
    "zh-CN": {
        "structure.valid": string;
        "structure.error.noStart": string;
        "structure.error.invalidLink": string;
        "dist.pseudo": string;
        "dist.noStartBranch": string;
        "dist.noRoute": string;
        "dist.allEnding": string;
        "dist.good": string;
        "score.pseudo": string;
        "score.singlePath": string;
        "score.noRoute": string;
        "score.good": string;
        "score.cognitive.high": string;
        "score.cognitive.good": string;
        "constraint.missingStart": string;
        "constraint.nodeCount": string;
        "constraint.endingCount": string;
        "constraint.maxDepth": string;
        "constraint.maxBranching": string;
    };
    "en-US": {
        "structure.valid": string;
        "structure.error.noStart": string;
        "structure.error.invalidLink": string;
        "dist.pseudo": string;
        "dist.noStartBranch": string;
        "dist.noRoute": string;
        "dist.allEnding": string;
        "dist.good": string;
        "score.pseudo": string;
        "score.singlePath": string;
        "score.noRoute": string;
        "score.good": string;
        "score.cognitive.high": string;
        "score.cognitive.good": string;
        "constraint.missingStart": string;
        "constraint.nodeCount": string;
        "constraint.endingCount": string;
        "constraint.maxDepth": string;
        "constraint.maxBranching": string;
    };
};
export declare function t(key: keyof typeof MESSAGES["zh-CN"], locale?: string, params?: Record<string, string | number>): string;
export {};
//# sourceMappingURL=i18n.d.ts.map