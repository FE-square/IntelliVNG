import React from 'react';
import { motion } from 'framer-motion';
import { Character } from '@vng/core';

interface DialogueBoxProps {
    character?: Character;
    text: string;
    onNext?: () => void;
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({ character, text, onNext }) => {
    return (
        <div
            className="absolute bottom-0 left-0 w-full p-6 pb-8 bg-gradient-to-t from-black/80 to-transparent"
            onClick={onNext}
        >
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="max-w-4xl mx-auto bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg border border-white/20 cursor-pointer"
            >
                {character && (
                    <div className="font-bold text-xl text-indigo-900 mb-2">
                        {character.displayName}
                    </div>
                )}

                <div className="text-lg text-slate-800 leading-relaxed font-medium">
                    {text}
                </div>

                <div className="absolute bottom-4 right-6 animate-bounce text-indigo-500">
                    ▼
                </div>
            </motion.div>
        </div>
    );
};
