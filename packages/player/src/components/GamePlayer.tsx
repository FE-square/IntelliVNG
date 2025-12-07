import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GameProject, StoryNode, Dialogue } from '@vng/core';
import { GameEngine } from '../engine/GameEngine';
import { motion, AnimatePresence } from 'framer-motion';

interface GamePlayerProps {
    project: GameProject;
    startNodeId?: string;  // ✅ 可选: 指定从哪个节点开始
}

export const GamePlayer: React.FC<GamePlayerProps> = ({ project, startNodeId }) => {
    const engine = useMemo(() => new GameEngine(project, startNodeId), [project, startNodeId]);  // ✅ 传递 startNodeId
    const [currentNode, setCurrentNode] = useState<StoryNode | undefined>(
        engine.getCurrentNode()
    );
    const [dialogueIndex, setDialogueIndex] = useState(0);
    const [showTransition, setShowTransition] = useState(false);  // ✅ 节点过渡状态
    const [transitionText, setTransitionText] = useState('');  // ✅ 过渡文本
    
    // ✅ 音频播放器引用
    const bgmRef = useRef<HTMLAudioElement | null>(null);

    
    // 节点切换时自动播放背景音乐
    useEffect(() => {
        if (!currentNode?.audioAssets?.bgmUrl) {
            if (bgmRef.current && !bgmRef.current.paused) {
                bgmRef.current.pause();
            }
            return;
        }
        
        const bgmUrl = currentNode.audioAssets.bgmUrl;
        const bgmVolume = currentNode.audioAssets.bgmVolume ?? 0.5;
        const bgmLoop = currentNode.audioAssets.bgmLoop ?? true;
        
        const normalizeUrl = (url: string) => {
            try {
                return new URL(url, window.location.href).href;
            } catch {
                return url;
            }
        };
        
        const normalizedNewUrl = normalizeUrl(bgmUrl);
        const normalizedCurrentUrl = bgmRef.current?.src ? normalizeUrl(bgmRef.current.src) : '';
        
        if (!bgmRef.current || normalizedCurrentUrl !== normalizedNewUrl) {
            if (bgmRef.current) {
                bgmRef.current.pause();
                bgmRef.current.currentTime = 0;
            }
            
            const audio = new Audio(bgmUrl);
            audio.loop = bgmLoop;
            audio.volume = bgmVolume;
            bgmRef.current = audio;
            
            audio.play().catch(err => {
                console.error('[GamePlayer] BGM播放失败:', err.message);
            });
        } else {
            bgmRef.current.volume = bgmVolume;
            bgmRef.current.loop = bgmLoop;
        }
        
        return () => {
            if (bgmRef.current) {
                bgmRef.current.pause();
                bgmRef.current = null;
            }
        };
    }, [currentNode]);

    // 获取当前场景背景和立绘
    // ✅ 优先从 visualAssets 获取,如果没有则通过 backgroundId/sceneName 从 backgrounds 查找
    const getSceneBackground = () => {
        // 🐛 调试信息
        console.log('[GamePlayer] 查找场景背景:', {
            nodeId: currentNode?.id,
            nodeTitle: currentNode?.title,
            hasVisualAssets: !!currentNode?.visualAssets?.backgroundImageUrl,
            backgroundId: currentNode?.backgroundId,
            sceneName: currentNode?.sceneName,
            projectBackgrounds: project.backgrounds?.length || 0,
            backgroundsPreview: project.backgrounds?.map(bg => ({ id: bg.id, name: bg.name, hasImage: !!bg.imageUrl })),
        });
        
        // 方式1: visualAssets 中直接配置的背景图
        if (currentNode?.visualAssets?.backgroundImageUrl) {
            console.log('[GamePlayer] ✅ 使用visualAssets背景图');
            return currentNode.visualAssets.backgroundImageUrl;
        }
        
        // 方式2: 通过 backgroundId 从 project.backgrounds 查找场景背景图
        if (currentNode?.backgroundId) {
            const scene = project.backgrounds?.find(bg => bg.id === currentNode.backgroundId);
            if (scene?.imageUrl) {
                console.log('[GamePlayer] ✅ 通过backgroundId找到背景图:', scene.name);
                return scene.imageUrl;
            } else {
                console.warn('[GamePlayer] ⚠️ backgroundId存在但未找到匹配的场景:', currentNode.backgroundId);
            }
        }
        
        // 方式3: 通过 sceneName 从 project.backgrounds 查找场景背景图
        if (currentNode?.sceneName) {
            const scene = project.backgrounds?.find(bg => bg.name === currentNode.sceneName);
            if (scene?.imageUrl) {
                console.log('[GamePlayer] ✅ 通过sceneName找到背景图:', scene.name);
                return scene.imageUrl;
            } else {
                console.warn('[GamePlayer] ⚠️ sceneName存在但未找到匹配的场景:', currentNode.sceneName);
            }
        }
        
        // 方式4: 兜底背景图
        console.warn('[GamePlayer] ⚠️ 未找到任何场景背景,使用兜底图片');
        return 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1280&h=720&fit=crop';
    };
    
    const currentBackground = getSceneBackground();
    const currentCharacters = currentNode?.visualAssets?.characters || [];

    // 获取当前对话
    const currentDialogue: Dialogue | undefined = currentNode?.dialogues?.[engine.getCurrentDialogueIndex()];
    const currentCharacter = currentDialogue ? project.characters.find(c => c.id === currentDialogue.characterId) : undefined;
    
    // 判断是否是旁白(没有角色或角色是narrator)
    const isNarration = !currentDialogue || !currentDialogue.characterId || currentDialogue.characterId === 'narrator';
    
    // 获取当前对话角色的立绘
    const currentCharacterSprite = currentCharacter?.sprites?.[0]?.imageUrl || currentCharacter?.avatarUrl;

    const handleNext = () => {
        const nodeType = (currentNode as any)?.type;
        const isBranchNode = nodeType === 'branch' || nodeType === 'choice';
        
        // 分支节点等待选择 - 但如果还有对话,先播放对话
        if (isBranchNode && currentNode?.choices && !currentDialogue) {
            return; // 对话已播放完,等待用户选择
        }
        
        const prevNodeId = currentNode?.id;  // 记录当前节点ID
        const next = engine.next();
        
        // 只在真正切换节点时才显示过渡效果
        const isNodeChanged = next && next.id !== prevNodeId;
        
        if (isNodeChanged && next.narration) {
            setTransitionText(next.narration);
            setShowTransition(true);
            setTimeout(() => {
                setShowTransition(false);
                setCurrentNode(next);
                setDialogueIndex(engine.getCurrentDialogueIndex());
            }, 2000);  // 2秒后关闭过渡
        } else {
            setCurrentNode(next);
            setDialogueIndex(engine.getCurrentDialogueIndex());
        }
    };

    const handleChoice = (choiceId: string) => {
        if (!currentNode?.choices) return;
        const choice = currentNode.choices.find(c => c.id === choiceId);
        if (choice) {
            engine.makeChoice(choice);
            const nextNode = engine.getCurrentNode();
            
            // 如果下一个节点有旁白,显示过渡效果
            if (nextNode && nextNode.narration) {
                setTransitionText(nextNode.narration);
                setShowTransition(true);
                setTimeout(() => {
                    setShowTransition(false);
                    setCurrentNode(nextNode);
                    setDialogueIndex(0);
                }, 2000);
            } else {
                setCurrentNode(nextNode);
                setDialogueIndex(0);
            }
        }
    };

    if (!currentNode) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black text-white">
                <div className="text-center">
                    <div className="text-2xl font-bold mb-4">故事结束</div>
                    <div className="text-gray-400">Thank you for playing!</div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full overflow-hidden bg-black">
            {/* 过渡层 - 黑底白字居中 */}
            <AnimatePresence>
                {showTransition && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black z-[100] flex items-center justify-center"
                    >
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-white text-2xl md:text-3xl text-center px-8 max-w-4xl leading-relaxed"
                        >
                            {transitionText}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 背景层 */}
            <AnimatePresence mode='wait'>
                <motion.img
                    key={currentBackground}
                    src={currentBackground}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0 w-full h-full object-cover"
                    alt="背景"
                />
            </AnimatePresence>

            {/* 角色立绘层 - 对话时显示当前角色的立绘 */}
            <div className="absolute inset-0 pointer-events-none flex items-end justify-center">
                <AnimatePresence mode="wait">
                    {/* 如果是对话，显示当前角色的立绘 */}
                    {!isNarration && currentCharacterSprite && (
                        <motion.div
                            key={currentDialogue?.characterId}
                            initial={{ opacity: 0, x: -100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            transition={{ duration: 0.5 }}
                            className="absolute bottom-0 left-[10%] h-[75%]"
                        >
                            <img
                                src={currentCharacterSprite}
                                className="h-full object-contain"
                                style={{
                                    filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))',
                                    // ✅ 多层去除白色背景方案
                                    // 方案1: 使用multiply混合模式,白色会变透明
                                    mixBlendMode: 'darken' as const,
                                    // 方案2: 增强对比度和亮度，让白色更接近纯白
                                    // filter: 'contrast(1.1) brightness(1.05) drop-shadow(0 10px 20px rgba(0,0,0,0.5))',
                                }}
                                alt="立绘"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 旁白层 - 显示在背景图上方 */}
            {isNarration && currentDialogue && (
                <div
                    className="absolute top-0 left-0 w-full p-6 pt-8"
                    onClick={handleNext}
                >
                    <motion.div
                        key={`narration-${currentDialogue.id}`}
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="max-w-4xl mx-auto bg-black/70 backdrop-blur-md rounded-xl p-6 shadow-lg border border-white/30 cursor-pointer"
                    >
                        <div className="text-lg text-white leading-relaxed text-center italic">
                            {currentDialogue.text}
                        </div>
                        <div className="absolute bottom-4 right-6 animate-bounce text-white/70">
                            ▼
                        </div>
                    </motion.div>
                </div>
            )}

            {/* 对话层 - 显示在底部右侧 */}
            {!isNarration && currentDialogue && (
                <div
                    className="absolute bottom-0 right-0 w-[55%] p-6 pb-8"
                    onClick={handleNext}
                >
                    <motion.div
                        key={`dialogue-${currentDialogue.id}`}
                        initial={{ x: 100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 cursor-pointer overflow-hidden"
                    >
                        {/* 角色信息条 */}
                        {currentCharacter && (
                            <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3">
                                {/* 头像 */}
                                {currentCharacter.avatarUrl ? (
                                    <img
                                        src={currentCharacter.avatarUrl}
                                        alt={currentCharacter.displayName}
                                        className="w-12 h-12 rounded-full border-2 border-white object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-white font-bold text-xl">
                                        {currentCharacter.displayName.charAt(0)}
                                    </div>
                                )}
                                {/* 名称 */}
                                <div className="font-bold text-xl text-white drop-shadow-md">
                                    {currentCharacter.displayName}
                                </div>
                            </div>
                        )}

                        {/* 对话内容 */}
                        <div className="px-6 py-5">
                            <div className="text-lg text-slate-800 leading-relaxed">
                                {currentDialogue.text}
                            </div>
                        </div>

                        <div className="absolute bottom-4 right-6 animate-bounce text-indigo-500">
                            ▼
                        </div>
                    </motion.div>
                </div>
            )}

            {/* 分支选择层 - 优化设计 */}
            {(() => {
                const nodeType = (currentNode as any)?.type;
                const isBranchNode = nodeType === 'branch' || nodeType === 'choice';
                const shouldShow = isBranchNode && currentNode.choices && currentNode.choices.length > 0 && !currentDialogue;
                
                if (!shouldShow) return null;
                
                return (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-6 animate-in fade-in duration-300">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ type: "spring", duration: 0.5 }}
                            className="bg-gradient-to-br from-white via-white to-indigo-50 rounded-3xl shadow-2xl border-2 border-indigo-300/50 overflow-hidden max-w-2xl w-full"
                        >
                            {/* 标题栏 - 渐变背景 */}
                            <div className="relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600" />
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30" />
                                <div className="relative px-8 py-6 text-center">
                                    <div className="inline-block px-4 py-1 bg-white/20 rounded-full text-white/90 text-xs font-medium mb-2">
                                        分支选择
                                    </div>
                                    <h2 className="text-white text-2xl font-bold drop-shadow-lg">
                                        {currentNode.title || '做出你的选择'}
                                    </h2>
                                </div>
                            </div>
                            
                            {/* 选项列表 */}
                            <div className="p-8 space-y-4">
                                {currentNode.choices!.map((choice, index) => {
                                    return (
                                        <motion.button
                                            key={choice.id}
                                            onClick={() => handleChoice(choice.id)}
                                            initial={{ opacity: 0, x: -30 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.1 + index * 0.08, type: "spring" }}
                                            whileHover={{ scale: 1.02, x: 8 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="group relative w-full overflow-hidden"
                                        >
                                            <div className="relative px-6 py-5 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 hover:from-indigo-100 hover:via-purple-100 hover:to-pink-100 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border-2 border-indigo-200/50 hover:border-indigo-400/80">
                                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/0 via-purple-600/0 to-pink-600/0 group-hover:from-indigo-600/5 group-hover:via-purple-600/5 group-hover:to-pink-600/5 transition-all duration-300" />
                                                
                                                <div className="relative flex items-center gap-4">
                                                    {/* 序号 */}
                                                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                                                        {index + 1}
                                                    </div>
                                                    
                                                    {/* 选项文本 */}
                                                    <div className="flex-1 text-left">
                                                        <p className="text-gray-900 font-semibold text-lg leading-relaxed">
                                                            {choice.text}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* 箭头指示 */}
                                                    <div className="flex-shrink-0 text-indigo-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>
                            
                            {/* 底部提示 */}
                            <div className="px-8 pb-6 text-center">
                                <p className="text-sm text-gray-500">
                                    选择一个选项继续故事
                                </p>
                            </div>
                        </motion.div>
                    </div>
                );
            })()}
        </div>
    );
};
