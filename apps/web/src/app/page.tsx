import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input } from '@vng/ui';

export default function Home() {
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
                            placeholder="e.g. A detective story in a cyberpunk city..."
                            className="h-12 text-lg"
                        />
                    </div>

                    <Button
                        className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 border-0"
                        onClick={() => {
                            const input = document.querySelector('input') as HTMLInputElement;
                            if (input?.value) {
                                window.location.href = `/dashboard?idea=${encodeURIComponent(input.value)}`;
                            }
                        }}
                    >
                        Generate Magic ✨
                    </Button>
                </CardContent>
            </Card>
        </main>
    )
}

```
