'use client';

import { ToastProvider } from '@vng/ui';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            {children}
        </ToastProvider>
    );
}

