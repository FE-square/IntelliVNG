"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@vng/ui';
import { Loader2, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

const STORAGE_KEY = 'intellivng_generated_project';

// Generation steps
const STEPS = [
    { id: 'story', label: 'Generating Story Outline...' },
    { id: 'characters', label: 'Designing Characters...' },
    { id: 'script', label: 'Writing Script...' },
    { id: 'assets', label: 'Creating Assets...' },
    { id: 'assembling', label: 'Assembling Game...' },
];

export default function DashboardPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const idea = searchParams.get('idea');

    const [currentStep, setCurrentStep] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    
    // 防止重复请求
    const isGeneratingRef = useRef(false);

    useEffect(() => {
        if (!idea) {
            setError('No idea provided. Please go back and enter your story idea.');
            return;
        }

        // 防止重复调用
        if (isGeneratingRef.current) {
            return;
        }

        const generateGame = async () => {
            try {
                addLog(`Starting generation for: "${idea}"`);
                
                // 模拟步骤进度
                const stepInterval = setInterval(() => {
                    setCurrentStep(prev => {
                        if (prev < STEPS.length - 1) return prev + 1;
                        clearInterval(stepInterval);
                        return prev;
                    });
                }, 3000);

                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idea }),
                });

                clearInterval(stepInterval);
                
                isGeneratingRef.current = true;


                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }

                const data = await response.json();
                
                addLog(`Generation complete! Created: "${data.title}"`);
                addLog(`- ${data.characters?.length || 0} characters`);
                addLog(`- ${data.backgrounds?.length || 0} backgrounds`);
                addLog(`- ${data.script?.length || 0} dialogue nodes`);
                
                // 保存生成的项目到 localStorage
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                
                setCurrentStep(STEPS.length);
                setIsComplete(true);
                
                addLog('Redirecting to editor...');
                
                // 延迟跳转，让用户看到完成信息
                setTimeout(() => {
                    router.push(`/editor?project=${data.id}`);
                }, 2000);

            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                console.error('Generation error:', err);
                addLog(`Error: ${message}`);
                setError(message);
            }
        };

        generateGame();
        
        // Cleanup
        return () => {
            isGeneratingRef.current = false;
        };
    }, [idea, router]);

    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900">
                        {error ? 'Generation Failed' : isComplete ? 'Generation Complete!' : 'Creating Your Visual Novel'}
                    </h1>
                    <p className="text-slate-500">"{idea}"</p>
                </div>

                {error && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-6 flex items-center gap-4">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                            <div>
                                <p className="font-medium text-red-800">Error occurred</p>
                                <p className="text-red-600">{error}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Progress Column */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Progress</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {STEPS.map((step, index) => (
                                <div key={step.id} className="flex items-center gap-3">
                                    {index < currentStep ? (
                                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                                    ) : index === currentStep && !error ? (
                                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                    ) : error ? (
                                        <AlertCircle className="w-6 h-6 text-red-400" />
                                    ) : (
                                        <Circle className="w-6 h-6 text-slate-200" />
                                    )}
                                    <span className={`font-medium ${
                                        index === currentStep && !error ? 'text-blue-600' :
                                        index < currentStep ? 'text-green-600' : 
                                        error ? 'text-red-400' : 'text-slate-400'
                                    }`}>
                                        {step.label}
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Logs Column */}
                    <Card className="h-[400px] flex flex-col">
                        <CardHeader>
                            <CardTitle>System Logs</CardTitle>
                            <CardDescription>Real-time generation details</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto font-mono text-sm bg-slate-950 text-green-400 p-4 rounded-b-lg mx-6 mb-6">
                            <div className="space-y-2">
                                {logs.map((log, i) => (
                                    <div key={i} className={log.includes('Error') ? 'text-red-400' : ''}>{log}</div>
                                ))}
                                {!isComplete && !error && (
                                    <div className="animate-pulse">_</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Actions */}
                {error && (
                    <div className="flex justify-center gap-4">
                        <button 
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Retry
                        </button>
                        <button 
                            onClick={() => router.push('/')}
                            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                        >
                            Back to Home
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
