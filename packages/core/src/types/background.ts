export interface Background {
    id: string;
    name: string;
    description: string;           // Description for AI generation
    imageUrl: string;

    // Scene variants (e.g., day/night)
    variants?: BackgroundVariant[];

    generationPrompt?: string;
}

export interface BackgroundVariant {
    id: string;
    name: string;                  // e.g., "night", "sunset"
    imageUrl: string;
}
