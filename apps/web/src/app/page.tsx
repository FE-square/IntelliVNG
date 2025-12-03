"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, useToast } from '@vng/ui';
import { Sparkles, FolderOpen, Zap, Settings, Users, Map, BookOpen, Globe2, Loader2, BrainCircuit } from 'lucide-react';
import type { Character, Scene, ThemeSetting, WorldSetting } from '@vng/core';

type ProgressStage =
    | 'init'
    | 'planning'
    | 'planning_round1'
    | 'planning_round2'
    | 'planning_round3'
    | 'plan_validate'
    | 'writing'
    | 'reviewing'
    | 'rewriting'
    | 'finalizing'
    | 'fallback'
    | 'completed'
    | 'failed';

interface DraftData {
    projectTitle: string;
    summary?: string;
    hook?: string;
    creativeDirection?: string;
    worldSetting: WorldSetting;
    themeSetting: ThemeSetting;
    characters: Character[];
    scenes: Scene[];
}

interface AgentProgressEvent {
    stage: ProgressStage;
    action: string;
    status: 'started' | 'in_progress' | 'completed' | 'failed';
    progress?: number;
    message?: string;
    details?: Record<string, any>;
    timestamp: number;
}

type AgentEventPayload =
    | ({ event: 'progress' } & AgentProgressEvent)
    | { event: 'session'; sessionId: string; status: 'started' | 'ended'; message?: string; elapsedTime?: number }
    | { event: 'result'; success: boolean; mode: string; data: { id: string; title: string } }
    | { event: 'error'; success: false; error: string };

const stageLabels: Record<ProgressStage, string> = {
    init: '初始化',
    planning: '故事规划',
    planning_round1: '故事规划 · Round 1',
    planning_round2: '故事规划 · Round 2',
    planning_round3: '故事规划 · Round 3',
    plan_validate: '结构验证',
    writing: '节点写作',
    reviewing: '故事审阅',
    rewriting: '节点重写',
    finalizing: '最终整理',
    fallback: '备用模型',
    completed: '完成',
    failed: '失败',
};

export default function Home() {
    const router = useRouter();
    const toast = useToast();
    const [quickPrompt, setQuickPrompt] = useState('');
    const [isQuickGenerating, setIsQuickGenerating] = useState(false);
    const [isAgentGenerating, setIsAgentGenerating] = useState(false);
    const [isDraftGenerating, setIsDraftGenerating] = useState(false);
    const [draftData, setDraftData] = useState<DraftData | null>(null);
    const [draftCached, setDraftCached] = useState(false);
    const [progressEvents, setProgressEvents] = useState<AgentProgressEvent[]>([]);
    const [sessionStatus, setSessionStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [sessionInfo, setSessionInfo] = useState<{ sessionId?: string; message?: string }>({});
    const [finalProject, setFinalProject] = useState<{ id: string; title: string } | null>(null);
    const finalProjectRef = useRef<{ id: string; title: string } | null>(null);
    const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
    const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const controllerRef = useRef<AbortController | null>(null);
    const draftSectionRef = useRef<HTMLDivElement | null>(null);
    const agentsSectionRef = useRef<HTMLDivElement | null>(null);
    const progressListRef = useRef<HTMLDivElement | null>(null);
    const agentsSectionVisibleRef = useRef(false);
    const [lastLocale, setLastLocale] = useState('zh-CN');

    useEffect(() => {
        return () => {
            controllerRef.current?.abort();
            if (redirectTimerRef.current) {
                clearInterval(redirectTimerRef.current);
            }
        };
    }, []);

    const getUserLocale = () => {
        if (typeof window === 'undefined') return 'zh-CN';
        return new URLSearchParams(window.location.search).get('locale') || 'zh-CN';
    };

    const clearRedirectCountdown = () => {
        if (redirectTimerRef.current) {
            clearInterval(redirectTimerRef.current);
            redirectTimerRef.current = null;
        }
        setRedirectCountdown(null);
    };

    const updateFinalProject = (project: { id: string; title: string } | null) => {
        finalProjectRef.current = project;
        setFinalProject(project);
    };

    const startRedirectCountdown = () => {
        if (!finalProjectRef.current) return;
        clearRedirectCountdown();
        setRedirectCountdown(5);
        redirectTimerRef.current = setInterval(() => {
            setRedirectCountdown((prev) => {
                if (prev === null) return null;
                if (prev <= 1) {
                    clearRedirectCountdown();
                    const project = finalProjectRef.current;
                    if (project) {
                        router.push(`/editor?projectId=${project.id}`);
                    }
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleViewProject = () => {
        if (!finalProjectRef.current) return;
        clearRedirectCountdown();
        router.push(`/editor?projectId=${finalProjectRef.current.id}`);
    };

    const resetAgentFlow = (options?: { keepDraft?: boolean }) => {
        controllerRef.current?.abort();
        controllerRef.current = null;
        if (!options?.keepDraft) {
            setDraftData(null);
        }
        setDraftCached(false);
        setProgressEvents([]);
        setSessionStatus('idle');
        setSessionInfo({});
        updateFinalProject(null);
        clearRedirectCountdown();
    };
    const agentStatusMeta = {
        idle: { label: '等待启动', className: 'bg-slate-100 text-slate-600' },
        running: { label: '智能体协作中', className: 'bg-indigo-100 text-indigo-700' },
        success: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
        error: { label: '已中断', className: 'bg-rose-100 text-rose-700' },
    }[sessionStatus];
    const recentProgressEvents = progressEvents.slice(-20);
    const showDraftSection = Boolean(draftData) || isDraftGenerating;
    const showDraftLoading = isDraftGenerating && !draftData;
    const [showFastScriptLoading, setShowFastScriptLoading] = useState(false);
    const shouldShowAgentsProgress =
        Boolean(draftData) && (recentProgressEvents.length > 0 || sessionStatus === 'error' || sessionStatus === 'success' || Boolean(finalProject));

    useEffect(() => {
        if (draftData && draftSectionRef.current) {
            draftSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [draftData]);

    useEffect(() => {
        if (shouldShowAgentsProgress && !agentsSectionVisibleRef.current) {
            agentsSectionVisibleRef.current = true;
            agentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (!shouldShowAgentsProgress) {
            agentsSectionVisibleRef.current = false;
        }
    }, [shouldShowAgentsProgress]);

    useEffect(() => {
        if (progressListRef.current) {
            progressListRef.current.scrollTop = progressListRef.current.scrollHeight;
        }
    }, [recentProgressEvents]);

    const handleAgentEvent = (payload: AgentEventPayload) => {
        if (payload.event === 'progress') {
            setProgressEvents((prev) => [...prev, payload]);
            setSessionStatus((prev) => (prev === 'error' ? prev : 'running'));
            return false;
        }

        if (payload.event === 'session') {
            setSessionInfo({ sessionId: payload.sessionId, message: payload.message });
            if (payload.status === 'ended' && sessionStatus !== 'error') {
                setSessionStatus('success');
            }
            return false;
        }

        if (payload.event === 'result') {
            if (payload.data?.id) {
                const projectData = { id: payload.data.id, title: payload.data.title };
                updateFinalProject(projectData);
                setSessionStatus('success');
                toast.success('生成成功', '5 秒后自动跳转到编辑器...');
                startRedirectCountdown();
            }
            return true;
        }

        if (payload.event === 'error') {
            setSessionStatus('error');
            toast.error('智能体生成失败', payload.error || '请重试');
            return true;
        }

        return false;
    };

    const streamAgentResponse = async (response: Response) => {
        if (!response.body) {
            throw new Error('无法建立智能体 SSE 连接');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let shouldStop = false;

        while (!shouldStop) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
                const chunk = buffer.slice(0, boundary).trim();
                buffer = buffer.slice(boundary + 2);

                if (chunk.startsWith('data:')) {
                    const dataStr = chunk.replace(/^data:\s*/, '');
                    if (dataStr) {
                        try {
                            const payload = JSON.parse(dataStr) as AgentEventPayload;
                            const shouldTerminate = handleAgentEvent(payload);
                            if (shouldTerminate) {
                                shouldStop = true;
                                break;
                            }
                        } catch (error) {
                            console.warn('解析 SSE 事件失败:', error);
                        }
                    }
                }
                boundary = buffer.indexOf('\n\n');
            }
        }

        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
            try {
                const payload = JSON.parse(trimmed.replace(/^data:\s*/, '')) as AgentEventPayload;
                handleAgentEvent(payload);
            } catch (error) {
                console.warn('解析剩余 SSE 数据失败:', error);
            }
        }

        await reader.cancel().catch(() => { });
    };

    const requestScriptsGeneration = async (draft: DraftData, locale: string, mode = 'fast') => {
        setSessionStatus('running');
        const controller = new AbortController();
        controllerRef.current = controller;
        toast.info('连接智能创作服务', `模式: ${mode}`);
        if (mode === 'fast') {
            setShowFastScriptLoading(true);
        }
        const response = await fetch('/api/game/generate-by-agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                characters: draft.characters,
                worldSetting: draft.worldSetting,
                scenes: draft.scenes,
                themeSetting: draft.themeSetting,
                locale,
                mode,
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload.error || '智能体服务异常');
        }
        if (mode === 'fast') {
            const result = await response.json();
            setIsQuickGenerating(false)
            setShowFastScriptLoading(false);
            if (result.success) {
                toast.success('剧本生成成功', '即将跳转到编辑器...');
                setTimeout(() => {
                    router.push(`/editor?projectId=${result.data.id}`);
                }, 5000);
            } else {
                setIsQuickGenerating(false)
                setShowFastScriptLoading(false);
                toast.error('生成失败', result.error || '请重试');
            }
        } else {
            await streamAgentResponse(response);
        }
    };

    // 先 /idea-to-draft 生成草稿 然后交给 /generate-by-agents 接口生成脚本
    const handleDraftAndScripts = async (mode = 'fast') => {
        if (!quickPrompt.trim()) {
            toast.warning('请输入故事描述');
            return;
        }
        setIsDraftGenerating(true);
        if (mode === 'fast') {
            setIsQuickGenerating(true);
        } else {
            setIsAgentGenerating(true);
        }
        resetAgentFlow();

        try {
            const locale = getUserLocale();
            setLastLocale(locale);
            toast.info('AI创作中', '正在分析创意并生成设定草稿...');

            setTimeout(() => {
                draftSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 500);

            const draftResponse = await fetch('/api/game/idea-to-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idea: quickPrompt,
                    locale,
                }),
            });
            setIsDraftGenerating(false);

            const draftResult = await draftResponse.json().catch(() => ({}));
            if (!draftResponse.ok || !draftResult.success) {
                throw new Error(draftResult.error || '设定草稿生成失败');
            }

            setDraftData(draftResult.data);
            setDraftCached(Boolean(draftResult.cached));
            if (draftResult.cached) {
                toast.info('命中草稿缓存', '使用历史草稿加速生成流程');
            }
            toast.info('设定草稿完成', '智能体系统即将写作剧本...');

            await requestScriptsGeneration(draftResult.data, locale, mode);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                toast.info('已取消生成');
            } else {
                console.error('Agents generate error:', error);
                toast.error('生成失败', error instanceof Error ? error.message : '请检查网络连接');
                setSessionStatus('error');
            }
        } finally {
            controllerRef.current = null;
            setIsAgentGenerating(false);
        }
    };

    const handleRetryAgents = async (mode = 'fast') => {
        if (!draftData) return;
        resetAgentFlow({ keepDraft: true });
        setIsAgentGenerating(true);
        try {
            toast.info('正在重试', '使用现有设定重新驱动智能体系统...');
            await requestScriptsGeneration(draftData, lastLocale || getUserLocale(), mode);
        } catch (error) {
            console.error('Agents retry error:', error);
            toast.error('重试失败', error instanceof Error ? error.message : '请检查网络连接');
            setSessionStatus('error');
        } finally {
            controllerRef.current = null;
            setIsAgentGenerating(false);
        }
    };

    const handleProgressRetry = (mode: 'fast' | 'agent') => {
        if (!draftData || isAgentGenerating) return;
        setProgressEvents([]);
        handleRetryAgents(mode);
    };

    return (
        <>
            <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
                <Card className="w-full max-w-3xl shadow-2xl border-2 border-slate-200 bg-white">
                    <CardHeader className="text-center pb-4">
                        <div className="flex justify-center mb-4">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 to-pink-600 flex items-center justify-center shadow-lg">
                                <Sparkles className="w-10 h-10 text-white" />
                            </div>
                        </div>
                        <CardTitle className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-pink-600">
                            IntelliVNG Studio
                        </CardTitle>
                        <CardDescription className="text-xl mt-3 text-slate-600">
                            用 AI 讲述你的故事
                        </CardDescription>
                        <p className="text-sm mt-2 text-slate-500">
                            一句话创作完整视觉小说，从灵感到成品只需几分钟
                        </p>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-6">
                        {/* 开始按钮 */}
                        <div className="space-y-3">
                            <>
                                {/* 自动模式 - 主推荐 */}
                                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Zap className="w-5 h-5 text-amber-600" />
                                            <h3 className="font-semibold text-amber-900">自动创作模式</h3>
                                            <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">推荐</span>
                                        </div>
                                        <p className="text-sm text-amber-700 mb-3">描述你的故事创意，AI 自动生成完整的多分支剧情游戏</p>
                                        <div className="space-y-2">
                                            <textarea
                                                className="w-full px-4 py-3 border-2 border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                                                rows={3}
                                                value={quickPrompt}
                                                onChange={(e) => setQuickPrompt(e.target.value)}
                                                placeholder="例如：关于失忆少女在未来城市寻找记忆的悬疑故事"
                                                disabled={isDraftGenerating}
                                            />
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg"
                                                    onClick={() => handleDraftAndScripts('fast')}
                                                    disabled={isDraftGenerating || !quickPrompt.trim()}
                                                >
                                                    {isQuickGenerating ? (
                                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                    ) : (
                                                        <Zap className="w-5 h-5 mr-2" />
                                                    )}
                                                    {isQuickGenerating ? 'LLM 正在创作...' : '快速创作 (大模型)'}
                                                </Button>
                                                <Button
                                                    className="w-full h-12 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 shadow-lg"
                                                    onClick={() => handleDraftAndScripts('agent')}
                                                    disabled={isDraftGenerating || !quickPrompt.trim()}
                                                >
                                                    {isAgentGenerating ? (
                                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                    ) : (
                                                        <BrainCircuit className="w-5 h-5 mr-2" />
                                                    )}
                                                    {isAgentGenerating ? 'Agents 正在创作...' : '高级创作 (智能体系统)'}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* 专业模式 */}
                                <Button
                                    variant="outline"
                                    className="w-full h-12 text-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                                    onClick={() => router.push('/setup')}
                                >
                                    <Settings className="w-5 h-5 mr-2" />
                                    专业模式
                                </Button>
                            </>

                            <Button
                                variant="outline"
                                className="w-full h-12 text-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                                onClick={() => router.push('/dashboard')}
                            >
                                <FolderOpen className="w-5 h-5 mr-2" />
                                查看我的项目
                            </Button>
                        </div>

                        {/* 额外说明 */}
                        <div className="text-center text-sm text-slate-500 pt-2">
                            <p>💡 AI 自动生成角色、场景、对话和分支剧情 | 🎨 支持自定义立绘和背景</p>
                        </div>
                    </CardContent>
                </Card>

                {showDraftSection && (
                    <div ref={draftSectionRef} className="w-full max-w-4xl mt-8">
                        <Card className="border border-slate-200 bg-white/90 shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                                    <BookOpen className="w-6 h-6 text-indigo-500" />
                                    设定草稿
                                    {draftCached && draftData && (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                                            缓存命中
                                        </span>
                                    )}
                                </CardTitle>
                                <CardDescription className="text-slate-600">
                                    {draftData
                                        ? `${draftData.projectTitle} · ${draftData.summary || draftData.hook || 'AI 已完成世界观、角色与场景规划'}`
                                        : '正在生成草稿（世界观 / 角色阵容 / 关键场景 / 主题 & 风格）...'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <section>
                                    <div className="flex items-center gap-2 text-slate-800 font-semibold">
                                        <Globe2 className="w-4 h-4 text-indigo-500" />
                                        世界观
                                    </div>
                                    {draftData ? (
                                        <>
                                            <p className="text-sm text-slate-600 mt-1">
                                                {draftData.worldSetting.name} · {draftData.worldSetting.era} · {draftData.worldSetting.location}
                                            </p>
                                            {draftData.worldSetting.rules && (
                                                <p className="text-sm text-slate-600 mt-1">{draftData.worldSetting.rules}</p>
                                            )}
                                        </>
                                    ) : (
                                        <div className="mt-2 space-y-2 text-sm text-slate-500">
                                            <p>AI 正在梳理世界观设定...</p>
                                            <div className="h-3 rounded bg-slate-100 animate-pulse" />
                                            <div className="h-3 rounded bg-slate-100 animate-pulse w-3/4" />
                                        </div>
                                    )}
                                </section>
                                <section>
                                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                                        <Users className="w-4 h-4 text-indigo-500" />
                                        角色阵容
                                    </div>
                                    {draftData ? (
                                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                                            {draftData.characters.map((character) => (
                                                <div key={character.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-semibold text-slate-900">{character.displayName || character.name}</p>
                                                        {character.identity && <span className="text-xs text-slate-500">{character.identity}</span>}
                                                    </div>
                                                    <p className="text-sm text-slate-600 mt-1">{character.description}</p>
                                                    {character.personality?.traits && character.personality?.traits.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {character.personality.traits.slice(0, 3).map((trait) => (
                                                                <span key={trait} className="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-600">
                                                                    {trait}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                                            {[0, 1, 2, 3].map((index) => (
                                                <div key={index} className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3 animate-pulse h-24" />
                                            ))}
                                        </div>
                                    )}
                                </section>
                                <section>
                                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                                        <Map className="w-4 h-4 text-indigo-500" />
                                        关键场景
                                    </div>
                                    {draftData ? (
                                        <div className="mt-2 space-y-2">
                                            {draftData.scenes.map((scene, index) => (
                                                <div key={scene.id} className="border-l-4 border-indigo-200 pl-3">
                                                    <p className="text-sm font-semibold text-slate-800">
                                                        S{index + 1} · {scene.name} ({scene.atmosphere})
                                                    </p>
                                                    <p className="text-sm text-slate-600">{scene.description || scene.details || '暂无详细描述'}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="mt-2 space-y-2">
                                            {[0, 1, 2].map((index) => (
                                                <div key={index} className="border-l-4 border-indigo-100 pl-3 space-y-2">
                                                    <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                                                    <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                                <section>
                                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                                        <Sparkles className="w-4 h-4 text-indigo-500" />
                                        主题 & 风格
                                    </div>
                                    {draftData ? (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {draftData.themeSetting.themes?.map((theme) => (
                                                <span key={theme} className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-600">
                                                    #{theme}
                                                </span>
                                            ))}
                                            {draftData.themeSetting.styles?.map((style) => (
                                                <span key={style} className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-600">
                                                    {style}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {[0, 1, 2].map((index) => (
                                                <span key={index} className="px-6 py-2 text-xs font-semibold rounded-full bg-slate-100 text-slate-400 animate-pulse">
                                                    正在构思...
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {shouldShowAgentsProgress && (
                    <div ref={agentsSectionRef} className="w-full max-w-4xl mt-6">
                        <Card className="border border-slate-200 bg-white/90 shadow-xl">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                                        <Sparkles className="w-6 h-6 text-indigo-500" />
                                        Agents 实时进度
                                    </CardTitle>
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${agentStatusMeta.className}`}>
                                        {agentStatusMeta.label}
                                    </span>
                                </div>
                                {sessionInfo.message && <CardDescription className="text-slate-600">{sessionInfo.message}</CardDescription>}
                            </CardHeader>
                            <CardContent>
                                {recentProgressEvents.length === 0 ? (
                                    <p className="text-sm text-slate-500">等待智能体协作启动...</p>
                                ) : (
                                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1" ref={progressListRef}>
                                        {recentProgressEvents.map((event) => (
                                            <div key={`${event.stage}-${event.timestamp}`} className="rounded-lg border border-slate-200 bg-white/70 p-3 shadow-sm">
                                                <div className="flex items-center text-sm font-semibold text-slate-800">
                                                    <span>{stageLabels[event.stage] || event.stage}</span>
                                                    <div className="ml-auto flex items-center gap-2">
                                                        {typeof event.progress === 'number' && (
                                                            <span className="text-xs text-slate-500">{event.progress}%</span>
                                                        )}
                                                        {event.status === 'failed' && draftData && (
                                                            <Button
                                                                variant="outline"
                                                                className="h-7 px-2 text-xs"
                                                                disabled={isAgentGenerating}
                                                                onClick={() => handleProgressRetry('agent')}
                                                            >
                                                                重试
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-1">{event.message || event.action}</p>
                                                {event.details && (
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        {event.details.nodeCount ? `节点数：${event.details.nodeCount}` : null}
                                                        {event.details.layer ? ` · 第 ${event.details.layer}/${event.details.totalLayers} 层` : null}
                                                    </p>
                                                )}
                                                {Array.isArray((event.details as any)?.candidates) && (event.details as any).candidates.length > 0 && (
                                                    <ul className="mt-2 space-y-1 text-xs text-slate-500 list-disc pl-4">
                                                        {(event.details as any).candidates.map((candidate: any, idx: number) => (
                                                            <li key={`${event.timestamp}-candidate-${idx}`}>
                                                                <span className="font-medium text-slate-600">{candidate.name || candidate.id}</span>
                                                                {candidate.description ? `：${candidate.description}` : null}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {Array.isArray((event.details as any)?.nodes) && (event.details as any).nodes.length > 0 && (
                                                    <ul className="mt-2 space-y-1 text-xs text-slate-500 list-disc pl-4">
                                                        {(event.details as any).nodes.map((node: any, idx: number) => (
                                                            <li key={`${event.timestamp}-node-${idx}`}>
                                                                <span className="font-medium text-slate-600">
                                                                    {node.title || node.id} {node.isEnding ? '(结局)' : ''}
                                                                </span>
                                                                {node.brief ? `：${node.brief}` : null}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {finalProject && (
                                    <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        {redirectCountdown !== null && (
                                            <p className="text-xs text-slate-500">
                                                {`将在 ${redirectCountdown}s 后自动跳转，如需立即进入可点击下方按钮。`}
                                            </p>
                                        )}
                                        <div className="flex justify-end">
                                            <Button variant="outline" onClick={handleViewProject}>
                                                查看 {finalProject.title}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                {sessionStatus === 'error' && draftData && (
                                    <div className="mt-4 flex flex-col gap-2 md:flex-row md:justify-end">
                                        <Button variant="outline" onClick={() => resetAgentFlow()} disabled={isAgentGenerating}>
                                            重新输入创意
                                        </Button>
                                        <Button onClick={() => handleRetryAgents('agent')} disabled={isAgentGenerating}>
                                            {isAgentGenerating ? '正在重试...' : '使用当前草稿重试生成'}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* 页脚 */}
                <p className="text-slate-600 mt-8 text-sm">
                    Made with ❤️ by IntelliVNG Team
                </p>
            </main>
            {showDraftLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 ">
                    <div className="w-80 rounded-2xl border border-white/30 bg-white/90 p-6 shadow-2xl">
                        <div className="flex flex-col items-center text-center space-y-4" aria-live="polite">
                            <div className="relative">
                                <div className="h-16 w-16 rounded-full border-4 border-indigo-100" />
                                <Loader2 className="absolute inset-0 m-auto h-10 w-10 text-indigo-500 animate-spin" />
                            </div>
                            <div>
                                <p className="text-lg font-semibold text-slate-900">设定草稿生成中（约 30s）</p>
                                <p className="text-sm text-slate-500 mt-1">世界观 / 角色阵容 / 关键场景 / 主题 & 风格</p>
                            </div>
                            <div className="w-full space-y-2 text-left text-sm text-slate-500">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                    智能体正在分析故事提案
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse delay-200" />
                                    生成世界观与关键要素
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse delay-500" />
                                    整合角色与场景草稿
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showFastScriptLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 ">
                    <div className="w-80 rounded-2xl border border-white/30 bg-white/90 p-6 shadow-2xl">
                        <div className="flex flex-col items-center text-center space-y-4" aria-live="polite">
                            <div className="relative">
                                <div className="h-16 w-16 rounded-full border-4 border-indigo-100" />
                                <Loader2 className="absolute inset-0 m-auto h-10 w-10 text-indigo-500 animate-spin" />
                            </div>
                            <div>
                                <p className="text-lg font-semibold text-slate-900">故事线生成中</p>
                                <p className="text-sm text-slate-500 mt-1">大约 30s 内即可完成
                                </p>
                            </div>
                            <div className="w-full space-y-2 text-left text-sm text-slate-500">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                    丰富场景与情节
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse delay-200" />
                                    编写人物对话与旁白
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse delay-500" />
                                    设计分支剧情与结局
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
