import * as React from 'react';
import { cn } from '../lib/utils';

// Toast 类型
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextValue {
    toasts: ToastData[];
    addToast: (toast: Omit<ToastData, 'id'>) => void;
    removeToast: (id: string) => void;
    // 便捷方法
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

// Toast Provider
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<ToastData[]>([]);

    const addToast = React.useCallback((toast: Omit<ToastData, 'id'>) => {
        const id = Math.random().toString(36).slice(2, 9);
        const newToast: ToastData = { ...toast, id };
        setToasts((prev) => [...prev, newToast]);

        // 自动移除
        const duration = toast.duration ?? 4000;
        if (duration > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
        }
    }, []);

    const removeToast = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    // 便捷方法
    const success = React.useCallback((title: string, message?: string) => {
        addToast({ type: 'success', title, message });
    }, [addToast]);

    const error = React.useCallback((title: string, message?: string) => {
        addToast({ type: 'error', title, message, duration: 6000 });
    }, [addToast]);

    const warning = React.useCallback((title: string, message?: string) => {
        addToast({ type: 'warning', title, message });
    }, [addToast]);

    const info = React.useCallback((title: string, message?: string) => {
        addToast({ type: 'info', title, message });
    }, [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

// useToast hook
export function useToast() {
    const context = React.useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

// Toast 容器
function ToastContainer({ toasts, onRemove }: { toasts: ToastData[]; onRemove: (id: string) => void }) {
    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}

// 单个 Toast 项
function ToastItem({ toast, onRemove }: { toast: ToastData; onRemove: (id: string) => void }) {
    const typeStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
        success: {
            bg: 'bg-green-50',
            border: 'border-green-200',
            icon: '✅',
        },
        error: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            icon: '❌',
        },
        warning: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            icon: '⚠️',
        },
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            icon: 'ℹ️',
        },
    };

    const style = typeStyles[toast.type];

    return (
        <div
            className={cn(
                'pointer-events-auto rounded-lg border p-4 shadow-lg backdrop-blur-sm',
                'animate-in slide-in-from-right-full duration-300',
                style.bg,
                style.border
            )}
        >
            <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{style.icon}</span>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{toast.title}</p>
                    {toast.message && (
                        <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{toast.message}</p>
                    )}
                </div>
                <button
                    onClick={() => onRemove(toast.id)}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export { ToastContext };

