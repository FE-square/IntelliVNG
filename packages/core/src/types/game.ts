export interface GameProject {
    id: string;
    title: string;
    description: string;
    coverImage?: string;
    createdAt: string;
    updatedAt: string;

    // Metadata
    meta: {
        author: string;
        version: string;
        genre: GameGenre;
        artStyle: ArtStyle;
    };

    // Content
    characters: Character[];
    backgrounds: Background[];
    script: StoryNode[];  // 使用 StoryNode（场景导向）而非 ScriptNode（线性脚本）

    // Settings
    settings: GameSettings;
}

export type GameGenre =
    | 'romance'
    | 'mystery'
    | 'fantasy'
    | 'horror'
    | 'slice-of-life'
    | 'sci-fi';

export type ArtStyle =
    | 'anime'
    | 'realistic'
    | 'pixel'
    | 'watercolor'
    | 'comic';

export interface GameSettings {
    textSpeed: number;
    autoPlayDelay: number;
    defaultTransition: TransitionType;
}

export type TransitionType = 'fade' | 'slide' | 'dissolve' | 'none';

// Forward references to other types to avoid circular dependency issues if imported directly
import { Character } from './character';
import { Background } from './background';
import { StoryNode } from './story';
