import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Character, WorldSetting, Scene, ThemeSetting } from '@vng/core';

interface SetupState {
    characters: Character[];
    worldSetting: WorldSetting | null;
    scenes: Scene[];
    themeSetting: ThemeSetting | null;
    
    addCharacter: (character: Character) => void;
    updateCharacter: (id: string, character: Partial<Character>) => void;
    removeCharacter: (id: string) => void;
    
    setWorldSetting: (worldSetting: WorldSetting) => void;
    
    setThemeSetting: (themeSetting: ThemeSetting) => void;
    
    addScene: (scene: Scene) => void;
    updateScene: (id: string, scene: Partial<Scene>) => void;
    removeScene: (id: string) => void;
    
    reset: () => void;
}

export const useSetupStore = create<SetupState>()(
    persist(
        (set) => ({
            characters: [],
            worldSetting: null,
            scenes: [],
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
            
            reset: () =>
                set({ characters: [], worldSetting: null, scenes: [], themeSetting: null }),
        }),
        {
            name: 'vng-setup-storage',
        }
    )
);
