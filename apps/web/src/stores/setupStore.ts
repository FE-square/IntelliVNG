import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Character, WorldSetting, Scene, ThemeSetting, Background } from '@vng/core';

interface SetupState {
    characters: Character[];
    worldSetting: WorldSetting | null;
    scenes: Scene[];
    backgrounds: Background[];
    themeSetting: ThemeSetting | null;
    
    addCharacter: (character: Character) => void;
    updateCharacter: (id: string, character: Partial<Character>) => void;
    removeCharacter: (id: string) => void;
    
    setWorldSetting: (worldSetting: WorldSetting) => void;
    
    setThemeSetting: (themeSetting: ThemeSetting) => void;
    
    addScene: (scene: Scene) => void;
    updateScene: (id: string, scene: Partial<Scene>) => void;
    removeScene: (id: string) => void;
    
    addBackground: (background: Background) => void;
    updateBackground: (id: string, background: Partial<Background>) => void;
    deleteBackground: (id: string) => void;
    
    reset: () => void;
}

export const useSetupStore = create<SetupState>()(
    persist(
        (set) => ({
            characters: [],
            worldSetting: null,
            scenes: [],
            backgrounds: [],
            themeSetting: null,
            
            addCharacter: (character) =>
                set((state) => ({ characters: [...state.characters, character] })),
            
            updateCharacter: (id, updates) =>
                set((state) => ({
                    characters: state.characters.map((c) =>
                        c.id === id ? { ...c, ...updates } : c
                    ),
                })),
            
            removeCharacter: (id) =>
                set((state) => ({
                    characters: state.characters.filter((c) => c.id !== id),
                })),
            
            setWorldSetting: (worldSetting) =>
                set({ worldSetting }),
            
            setThemeSetting: (themeSetting) =>
                set({ themeSetting }),
            
            addScene: (scene) =>
                set((state) => ({ scenes: [...state.scenes, scene] })),
            
            updateScene: (id, updates) =>
                set((state) => ({
                    scenes: state.scenes.map((s) =>
                        s.id === id ? { ...s, ...updates } : s
                    ),
                })),
            
            removeScene: (id) =>
                set((state) => ({
                    scenes: state.scenes.filter((s) => s.id !== id),
                })),
            
            addBackground: (background) =>
                set((state) => ({ backgrounds: [...state.backgrounds, background] })),
            
            updateBackground: (id, updates) =>
                set((state) => ({
                    backgrounds: state.backgrounds.map((b) =>
                        b.id === id ? { ...b, ...updates } : b
                    ),
                })),
            
            deleteBackground: (id) =>
                set((state) => ({
                    backgrounds: state.backgrounds.filter((b) => b.id !== id),
                })),
            
            reset: () =>
                set({ characters: [], worldSetting: null, scenes: [], backgrounds: [], themeSetting: null }),
        }),
        {
            name: 'vng-setup-storage',
        }
    )
);
