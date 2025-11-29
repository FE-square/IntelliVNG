import React, { useState, useEffect, useMemo } from 'react';
import { GameProject, ScriptNode } from '@vng/core';
import { GameEngine } from '../engine/GameEngine';
import { DialogueBox } from './DialogueBox';
import { motion, AnimatePresence } from 'framer-motion';

interface GamePlayerProps {
    project: GameProject;
}

export const GamePlayer: React.FC<GamePlayerProps> = ({ project }) => {
    const engine = useMemo(() => new GameEngine(project), [project]);
    const [currentNode, setCurrentNode] = useState<ScriptNode | undefined>(
        engine.getCurrentNode()
    );

    // Simple state for current background and characters
    // In a real implementation, this would be derived from the node history or state manager
    const [currentBackground, setCurrentBackground] = useState<string | undefined>();

    useEffect(() => {
        if (currentNode?.type === 'scene-change') {
            const bg = engine.getBackground(currentNode.backgroundId);
            if (bg) setCurrentBackground(bg.imageUrl);
        }
    }, [currentNode, engine]);

    const handleNext = () => {
        if (currentNode?.type === 'choice') return; // Wait for choice
        const next = engine.next();
        setCurrentNode(next);
    };

    const handleChoice = (choiceId: string) => {
        if (currentNode?.type !== 'choice') return;
        const choice = currentNode.choices.find(c => c.id === choiceId);
        if (choice) {
            engine.makeChoice(choice);
            setCurrentNode(engine.getCurrentNode());
        }
    };

    if (!currentNode) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black text-white">
                <div className="text-2xl">End of Demo</div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full overflow-hidden bg-black">
            {/* Background Layer */}
            <AnimatePresence mode='wait'>
                {currentBackground && (
                    <motion.img
                        key={currentBackground}
                        src={currentBackground}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}
            </AnimatePresence>

            {/* Character Layer */}
            {currentNode.type === 'dialogue' && (
                <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-0">
                    {/* Placeholder for character sprite */}
                    {/* We would look up the character sprite here */}
                </div>
            )}

            {/* UI Layer */}
            {currentNode.type === 'dialogue' && (
                <DialogueBox
                    character={engine.getCharacter(currentNode.characterId)}
                    text={currentNode.text}
                    onNext={handleNext}
                />
            )}

            {currentNode.type === 'choice' && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-4 z-50">
                    {currentNode.prompt && (
                        <div className="text-white text-xl mb-4 font-bold drop-shadow-md">{currentNode.prompt}</div>
                    )}
                    {currentNode.choices.map(choice => (
                        <button
                            key={choice.id}
                            onClick={() => handleChoice(choice.id)}
                            className="px-8 py-3 bg-white/90 hover:bg-white text-indigo-900 rounded-lg font-bold text-lg shadow-lg transform hover:scale-105 transition-all min-w-[300px]"
                        >
                            {choice.text}
                        </button>
                    ))}
                </div>
            )}

            {currentNode.type === 'scene-change' && (
                // Auto advance scene change for now if it has no text
                <div className="absolute inset-0" onClick={handleNext} />
            )}
        </div>
    );
};
