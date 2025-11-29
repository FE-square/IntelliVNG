'use client';

import { useState, useEffect } from 'react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input } from '@vng/ui';

const STORAGE_KEY = 'intellivng_last_idea';

export default function Home() {
    const [idea, setIdea] = useState('eg.一个微型侦探故事');
    const [isLoading, setIsLoading] = useState(false);

    // 从 localStorage 恢复上次输入的内容
    useEffect(() => {
        const savedIdea = localStorage.getItem(STORAGE_KEY);
        if (savedIdea) {
            setIdea(savedIdea);
        }
    }, []);

    const handleGenerate = () => {
        if (!idea.trim()) return;
        
        // 保存到 localStorage
        localStorage.setItem(STORAGE_KEY, idea);
        
        setIsLoading(true);
        window.location.href = `/dashboard?idea=${encodeURIComponent(idea)}`;
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
            <Card className="w-[600px] shadow-2xl border-0 bg-white/90 backdrop-blur">
                <CardHeader className="text-center">
                    <CardTitle className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-pink-600">
                        IntelliVNG Studio
                    </CardTitle>
                    <CardDescription className="text-lg mt-2">
                        Turn your idea into a Visual Novel in seconds.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            What's your story about?
                        </label>
                        <Input
                            value={idea}
                            onChange={(e) => setIdea(e.target.value)}
                            placeholder="e.g. A detective story in a cyberpunk city..."
                            className="h-12 text-lg"
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                        />
                    </div>

                    <Button
                        className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 border-0"
                        onClick={handleGenerate}
                        disabled={!idea.trim() || isLoading}
                    >
                        {isLoading ? 'Loading...' : 'Generate Magic ✨'}
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}
