export interface Character {
    id: string;
    name: string;
    displayName: string;           // Display name (can include colors, etc.)
    description: string;           // Description for AI generation

    // Sprites
    sprites: CharacterSprite[];
    defaultSpriteId: string;

    // Attributes (optional, for advanced plot)
    attributes?: Record<string, number>;

    // Dialogue box style
    dialogueStyle?: {
        nameColor: string;
        boxStyle?: 'default' | 'thought' | 'shout';
    };
}

export interface CharacterSprite {
    id: string;
    emotion: EmotionType;
    imageUrl: string;
    // Prompt used for image generation (for regeneration)
    generationPrompt?: string;
}

export type EmotionType =
    | 'neutral'
    | 'happy'
    | 'sad'
    | 'angry'
    | 'surprised'
    | 'embarrassed'
    | 'thinking';
