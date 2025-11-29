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
    script: ScriptNode[];

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
// In a real scenario, we might import them, but for now we define interfaces here or rely on the fact that they are used in the GameProject interface
import { Character } from './character';
import { Background } from './background';
import { ScriptNode } from './script';
