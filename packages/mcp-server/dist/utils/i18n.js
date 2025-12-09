const MESSAGES = {
    "zh-CN": {
        "structure.valid": "结构有效",
        "structure.error.noStart": "没有找到开始节点 (isStart: true)",
        "structure.error.invalidLink": "节点不存在",
        "dist.pseudo": "⚠️ 检测到伪非线性结构：大部分分支集中在故事末尾。建议在故事早期（setup/rising阶段）添加分支点。",
        "dist.noStartBranch": "💡 故事开端缺少分支，玩家在前期可能感到缺乏参与感。考虑在 setup 或 rising 阶段添加选择。",
        "dist.noRoute": "💡 缺少路线分支(route)，故事可能缺乏真正的路线分歧。考虑添加导向不同故事线的分支。",
        "dist.allEnding": "⚠️ 所有分支都是结局分支，这会让故事显得线性。建议增加影响剧情发展的中途分支。",
        "dist.good": "✅ 分支分布良好！故事具有较好的非线性叙事结构。",
        "score.pseudo": "检测到伪非线性：分支集中在后期。",
        "score.singlePath": "仅发现 1 条路径，缺乏分支。",
        "score.noRoute": "缺少 route 类型分支，故事路线分歧不足。",
        "score.good": "非线性结构良好，可直接呈现。",
        "score.cognitive.high": "⚠️ 认知负载过高：存在单节点超过5个选项的情况，建议拆分。",
        "score.cognitive.good": "✅ 认知友好：分支设计符合米勒定律 (7±2)，易于玩家决策。",
        "constraint.missingStart": "缺少起始节点 (isStart)",
        "constraint.nodeCount": "节点数量不符合：实际 {actual} / 目标 {target}",
        "constraint.endingCount": "结局数量不符合：实际 {actual} / 目标 {target}",
        "constraint.maxDepth": "路径深度超限：实际 {actual} / 最大 {target}",
        "constraint.maxBranching": "单节点分支数超限：实际 {actual} / 最大 {target}",
    },
    "en-US": {
        "structure.valid": "Structure valid",
        "structure.error.noStart": "No start node found (isStart: true)",
        "structure.error.invalidLink": "Node does not exist",
        "dist.pseudo": "⚠️ Pseudo-non-linearity detected: Branches concentrated at the end. Suggest adding branches in early phases (setup/rising).",
        "dist.noStartBranch": "💡 Missing branches in the beginning. Players may feel lack of agency. Consider adding choices in setup/rising phases.",
        "dist.noRoute": "💡 Missing 'route' branches. Story may lack true divergence. Consider adding branches that lead to different story lines.",
        "dist.allEnding": "⚠️ All branches are ending branches. Story feels linear. Suggest adding mid-game branches.",
        "dist.good": "✅ Good branch distribution! Story has a healthy non-linear structure.",
        "score.pseudo": "Pseudo-non-linearity detected: Branches concentrated at the end.",
        "score.singlePath": "Only 1 path found, lacking branches.",
        "score.noRoute": "Missing 'route' branches, insufficient divergence.",
        "score.good": "Good non-linear structure, ready for presentation.",
        "score.cognitive.high": "⚠️ High Cognitive Load: Single node has >5 choices. Suggest splitting.",
        "score.cognitive.good": "✅ Cognitive Friendly: Design fits Miller's Law (7±2), easy for decision making.",
        "constraint.missingStart": "Missing start node (isStart)",
        "constraint.nodeCount": "Node count mismatch: Actual {actual} / Target {target}",
        "constraint.endingCount": "Ending count mismatch: Actual {actual} / Target {target}",
        "constraint.maxDepth": "Max depth exceeded: Actual {actual} / Max {target}",
        "constraint.maxBranching": "Max branching exceeded: Actual {actual} / Max {target}",
    },
};
export function t(key, locale = "zh-CN", params) {
    const effectiveLocale = locale === "en-US" ? "en-US" : "zh-CN";
    let template = MESSAGES[effectiveLocale][key] || key;
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            template = template.replace(`{${k}}`, String(v));
        });
    }
    return template;
}
//# sourceMappingURL=i18n.js.map