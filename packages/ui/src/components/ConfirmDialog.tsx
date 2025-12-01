import * as React from 'react';
import { cn } from '../lib/utils';

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'danger';
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    open,
    title,
    message,
    confirmText = '确定',
    cancelText = '取消',
    variant = 'default',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    // 处理键盘事件
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === 'Escape') {
                onCancel();
            } else if (e.key === 'Enter') {
                onConfirm();
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onConfirm, onCancel]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 背景遮罩 */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onCancel}
            />
            
            {/* 对话框 */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {title}
                    </h3>
                    <p className="text-gray-600">
                        {message}
                    </p>
                </div>
                
                <div className="flex justify-end gap-3 px-6 pb-6">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={cn(
                            "px-4 py-2 text-sm font-medium text-white rounded-md transition-colors",
                            variant === 'danger' 
                                ? 'bg-red-600 hover:bg-red-700' 
                                : 'bg-indigo-600 hover:bg-indigo-700'
                        )}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Hook 版本，方便在函数组件中使用
export interface UseConfirmDialogOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'danger';
}

export function useConfirmDialog() {
    const [state, setState] = React.useState<{
        open: boolean;
        options: UseConfirmDialogOptions | null;
        resolve: ((value: boolean) => void) | null;
    }>({
        open: false,
        options: null,
        resolve: null,
    });

    const confirm = React.useCallback((options: UseConfirmDialogOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setState({
                open: true,
                options,
                resolve,
            });
        });
    }, []);

    const handleConfirm = React.useCallback(() => {
        state.resolve?.(true);
        setState({ open: false, options: null, resolve: null });
    }, [state.resolve]);

    const handleCancel = React.useCallback(() => {
        state.resolve?.(false);
        setState({ open: false, options: null, resolve: null });
    }, [state.resolve]);

    const DialogComponent = state.options ? (
        <ConfirmDialog
            open={state.open}
            title={state.options.title}
            message={state.options.message}
            confirmText={state.options.confirmText}
            cancelText={state.options.cancelText}
            variant={state.options.variant}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    ) : null;

    return { confirm, DialogComponent };
}

