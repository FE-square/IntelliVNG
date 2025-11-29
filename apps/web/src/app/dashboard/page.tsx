"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@vng/ui';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';

// Mock generation steps
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

    useEffect(() => {
        if (!idea) return;

        const generateGame = async () => {
            try {
                setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Starting generation for: "${idea}"...`]);

                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idea }),
                });

                if (!response.ok) throw new Error('Generation failed');

                const data = await response.json();
                setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Generation complete!`]);

                // In a real app, we would save the project to a DB and redirect to the editor with the project ID
                // For now, we'll just log the result and redirect
                console.log('Generated Game:', data);

                // Simulate "processing" steps for visual feedback since the API might be fast or slow
                setCurrentStep(STEPS.length);
                setTimeout(() => router.push('/editor'), 1000);

            } catch (error) {
                console.error(error);
                setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Error: ${error}`]);
            }
        };

        generateGame();
    }, [idea, router]);

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900">Creating Your Visual Novel</h1>
                    <p className="text-slate-500">"{idea}"</p>
                </div>

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
                                    ) : index === currentStep ? (
                                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                    ) : (
                                        <Circle className="w-6 h-6 text-slate-200" />
                                    )}
                                    <span className={`font-medium ${index === currentStep ? 'text-blue-600' :
                                        index < currentStep ? 'text-green-600' : 'text-slate-400'
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
                                    <div key={i}>{log}</div>
                                ))}
                                {currentStep < STEPS.length && (
                                    <div className="animate-pulse">_</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
