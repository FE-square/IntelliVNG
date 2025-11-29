export const NODE_TYPES = {
    DIALOGUE: 'dialogue',
    NARRATION: 'narration',
    CHOICE: 'choice',
    SCENE_CHANGE: 'scene-change',
    CONDITION: 'condition',
    SET_VARIABLE: 'set-variable',
} as const;

export const EMOTIONS = [
    'neutral',
    'happy',
    'sad',
    'angry',
    'surprised',
    'embarrassed',
    'thinking',
] as const;

export const ART_STYLES = [
    { id: 'anime', label: '日系动漫', prompt: 'anime style, cel shading' },
    { id: 'realistic', label: '写实风格', prompt: 'realistic, detailed' },
    { id: 'pixel', label: '像素风', prompt: 'pixel art, 16-bit style' },
    { id: 'watercolor', label: '水彩风', prompt: 'watercolor painting style' },
] as const;

export const GENRES = [
    { id: 'romance', label: '恋爱', icon: '💕' },
    { id: 'mystery', label: '悬疑', icon: '🔍' },
    { id: 'fantasy', label: '奇幻', icon: '✨' },
    { id: 'horror', label: '恐怖', icon: '👻' },
    { id: 'slice-of-life', label: '日常', icon: '☀️' },
    { id: 'sci-fi', label: '科幻', icon: '🚀' },
] as const;
