import React, { useState, useEffect, useMemo } from 'react';
import { GameProject, StoryNode, StoryDialogue } from '@vng/core';
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

    // ✅ 每次节点变化时打印节点信息
    useEffect(() => {
        if (currentNode) {
            console.log('[GamePlayer] 当前节点信息:', {
                id: currentNode.id,
                title: currentNode.title,
                type: currentNode.type,
                hasDialogues: !!currentNode.dialogues,
                dialoguesCount: currentNode.dialogues?.length || 0,
                hasChoices: !!currentNode.choices,
                choicesCount: currentNode.choices?.length || 0,
                rawNode: currentNode,
            });
        }
    }, [currentNode]);

    // 获取当前场景背景和立绘
    // ✅ 优先从 visualAssets 获取,如果没有则通过 sceneId 从 backgrounds 查找
    const getSceneBackground = () => {
        // 方式1: visualAssets 中直接配置的背景图
        if (currentNode?.visualAssets?.backgroundImageUrl) {
            return currentNode.visualAssets.backgroundImageUrl;
        }
        
        // 方式2: 通过 sceneId 从 project.backgrounds 查找场景背景图
        const sceneId = (currentNode as any)?.sceneId;
        if (sceneId) {
            const scene = project.backgrounds?.find(bg => bg.id === sceneId);
            if (scene?.imageUrl) {
                return scene.imageUrl;
            }
        }
        
        // 方式3: 兜底背景图
        return 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1280&h=720&fit=crop';
    };
    
    const currentBackground = getSceneBackground();
    const currentCharacters = currentNode?.visualAssets?.characters || [];

    // 获取当前对话
    const currentDialogue: StoryDialogue | undefined = currentNode?.dialogues?.[engine.getCurrentDialogueIndex()];
    const currentCharacter = currentDialogue ? project.characters.find(c => c.id === currentDialogue.characterId) : undefined;
    
    // ✅ 调试: 打印对话信息
    console.log('[GamePlayer] 当前对话状态:', {
        hasDialogue: !!currentDialogue,
        dialogueText: currentDialogue?.text,
        characterId: currentDialogue?.characterId,
        character: currentCharacter?.displayName,
        dialogueIndex: engine.getCurrentDialogueIndex(),
        totalDialogues: currentNode?.dialogues?.length,
    });
    
    // ✅ 调试日志: 检查分支节点状态
    const nodeType = (currentNode as any)?.type;
    const isBranchNode = nodeType === 'branch' || nodeType === 'choice';
    
    if (isBranchNode && currentNode) {
        console.log('[GamePlayer] 分支节点状态:', {
            nodeId: currentNode.id,
            nodeTitle: currentNode.title,
            nodeType: nodeType,
            hasChoices: !!currentNode.choices,
            choicesLength: currentNode.choices?.length || 0,
            choices: currentNode.choices,  // ✅ 打印完整的choices
            currentDialogue: currentDialogue ? {
                id: currentDialogue.id,
                text: currentDialogue.text?.substring(0, 50),
                characterId: currentDialogue.characterId,
            } : null,
            dialogueIndex: engine.getCurrentDialogueIndex(),
            totalDialogues: currentNode.dialogues?.length || 0,
            shouldShowChoices: !currentDialogue,
            allDialogues: currentNode.dialogues,  // ✅ 打印所有对话
        });
    }
    
    // 判断是否是旁白(没有角色或角色是narrator)
    const isNarration = !currentDialogue || !currentDialogue.characterId || currentDialogue.characterId === 'narrator';
    
    // 获取当前对话角色的立绘
    const currentCharacterSprite = currentCharacter?.sprites?.[0]?.imageUrl || currentCharacter?.avatarUrl;

    const handleNext = () => {
        console.log('[GamePlayer] handleNext 被调用');
        
        // ✅ 兼容 'branch' 和 'choice' 两种类型
        const nodeType = (currentNode as any)?.type;
        const isBranchNode = nodeType === 'branch' || nodeType === 'choice';
        
        // 分支节点等待选择 - 但如果还有对话,先播放对话
        if (isBranchNode && currentNode?.choices && !currentDialogue) {
            console.log('[GamePlayer] 分支节点已无对话,等待选择');
            return; // 对话已播放完,等待用户选择
        }
        
        console.log('[GamePlayer] 调用 engine.next()');
        const prevNodeId = currentNode?.id;  // ✅ 记录当前节点ID
        const next = engine.next();
        console.log('[GamePlayer] engine.next() 返回:', next?.id, next?.title);
        
        // ✅ 只在真正切换节点时才显示过渡效果
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
            
            // ✅ 如果下一个节点有旁白,显示过渡效果
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
            {/* ✅ 调试信息层 - 在屏幕左上角显示 */}
            <div className="absolute top-4 left-4 z-[200] bg-black/80 text-white p-3 rounded text-xs font-mono max-w-xs">
                <div>节点: {currentNode?.title}</div>
                <div>类型: {(currentNode as any)?.type}</div>
                <div>对话: {currentDialogue ? `${engine.getCurrentDialogueIndex() + 1}/${currentNode?.dialogues?.length}` : '无'}</div>
                <div>选项: {currentNode?.choices?.length || 0}</div>
                <div className="mt-1 text-yellow-400">
                    {isBranchNode && currentNode?.choices && !currentDialogue ? '✅ 应该显示选项框' : ''}
                    {isBranchNode && currentDialogue ? '⏳ 请点击对话继续' : ''}
                </div>
            </div>

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
                        <motion.img
                            key={currentDialogue?.characterId}
                            src={currentCharacterSprite}
                            initial={{ opacity: 0, x: -100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            transition={{ duration: 0.5 }}
                            className="absolute bottom-0 left-[10%] h-[75%] object-contain drop-shadow-2xl"
                            style={{
                                filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))'
                            }}
                            alt="立绘"
                        />
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
            {/* ✅ 修改: 即使没有找到角色也显示对话(作为旁白) */}
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

            {/* 分支选择层 - 只在对话播放完后显示 */}
            {(() => {
                // ✅ 兼容 'branch' 和 'choice' 两种类型
                const nodeType = (currentNode as any)?.type;
                const isBranchNode = nodeType === 'branch' || nodeType === 'choice';
                const shouldShow = isBranchNode && currentNode.choices && currentNode.choices.length > 0 && !currentDialogue;
                
                // ✅ 调试日志: 检查显示条件
                if (isBranchNode) {
                    console.log('[GamePlayer] 选项框显示条件:', {
                        nodeType,
                        is_branch_or_choice: isBranchNode,
                        has_choices: !!currentNode.choices,
                        choices_not_empty: currentNode.choices && currentNode.choices.length > 0,
                        no_dialogue: !currentDialogue,
                        shouldShow,
                    });
                    
                    // ✅ 如果应该显示但没显示,打印详细信息
                    if (shouldShow) {
                        console.log('[GamePlayer] ✅✅✅ 选项框应该显示!', {
                            choicesCount: currentNode.choices?.length,
                            choicesDetail: currentNode.choices,
                        });
                    } else {
                        console.log('[GamePlayer] ❌ 选项框不显示,原因:', {
                            has_choices: !!currentNode.choices,
                            choices_length: currentNode.choices?.length,
                            has_dialogue: !!currentDialogue,
                            dialogue_text: currentDialogue?.text,
                        });
                    }
                }
                
                if (!shouldShow) return null;
                
                return (
                    <div className="absolute inset-0 flex items-center justify-center z-50 px-6">
                        {/* 对话框背景 */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-indigo-200 overflow-hidden max-w-2xl w-full"
                        >
                            {/* 标题栏 */}
                            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                                <div className="text-white text-xl font-bold text-center">
                                    {currentNode.title || '请选择'}
                                </div>
                            </div>
                            
                            {/* 选项列表 */}
                            <div className="p-6 space-y-3">
                                {currentNode.choices!.map((choice, index) => {
                                    // ✅ 调试日志: 检查choice的结构
                                    if (index === 0) {
                                        console.log('[GamePlayer] 分支选项:', currentNode.choices!.map(c => ({
                                            id: c.id,
                                            text: c.text,
                                            targetNodeId: (c as any).targetNodeId,
                                            nextNodeId: (c as any).nextNodeId,
                                        })));
                                    }
                                    
                                    return (
                                        <motion.button
                                            key={choice.id}
                                            onClick={() => handleChoice(choice.id)}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            whileHover={{ scale: 1.02, x: 4 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="w-full px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-900 rounded-xl font-semibold text-left shadow-md hover:shadow-lg transition-all border-2 border-indigo-200 hover:border-indigo-400 flex items-center gap-3"
                                        >
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 text-base">
                                                {choice.text}
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                );
            })()}
        </div>
    );
};
