/**
 * 通用表单 AI 自动填充 Hook
 * 
 * 支持所有表单类型的智能补全：
 * - character: 角色设定
 * - world: 世界观设定
 * - scene: 场景设定
 * - theme: 主题风格
 * - background: 背景设定
 */

import { useState, useCallback } from 'react';
import { useToast } from '@vng/ui';

// 表单类型
export type FormType = 'character' | 'world' | 'scene' | 'theme' | 'background';

// 上下文信息
export interface AutocompleteContext {
    projectTitle?: string;
    genre?: string;
    worldSetting?: string;
    existingItems?: string[];
}

// Hook 返回类型
export interface UseFormAutocompleteReturn<T> {
    isLoading: boolean;
    autocomplete: (partialData: Partial<T>, context?: AutocompleteContext) => Promise<T | null>;
}

/**
 * 通用表单自动填充 Hook
 * 
 * @param formType 表单类型
 * @returns { isLoading, autocomplete }
 * 
 * @example
 * ```tsx
 * const { isLoading, autocomplete } = useFormAutocomplete<Character>('character');
 * 
 * const handleAutocomplete = async () => {
 *     const result = await autocomplete(formData, {
 *         genre: '校园恋爱',
 *         existingItems: characters.map(c => c.name),
 *     });
 *     if (result) {
 *         setFormData(result);
 *     }
 * };
 * ```
 */
export function useFormAutocomplete<T = Record<string, any>>(
    formType: FormType
): UseFormAutocompleteReturn<T> {
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();

    const autocomplete = useCallback(async (
        partialData: Partial<T>,
        context?: AutocompleteContext
    ): Promise<T | null> => {
        setIsLoading(true);

        try {
            const response = await fetch('/api/autocomplete-form', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formType,
                    partialData,
                    context,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || error.error || '自动补全失败');
            }

            const result = await response.json();
            
            if (result.success && result.data) {
                toast.success('AI 补全成功', '请检查并调整后保存 ✨');
                return result.data as T;
            }
            
            throw new Error(result.error || '自动补全失败');
        } catch (error) {
            console.error(`[useFormAutocomplete] ${formType} 补全失败:`, error);
            toast.error('自动补全失败', error instanceof Error ? error.message : '请重试');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [formType, toast]);

    return { isLoading, autocomplete };
}

/**
 * 表单类型的中文名称映射
 */
export const FORM_TYPE_LABELS: Record<FormType, string> = {
    character: '角色',
    world: '世界观',
    scene: '场景',
    theme: '主题风格',
    background: '背景',
};

/**
 * 获取表单类型的中文标签
 */
export function getFormTypeLabel(formType: FormType): string {
    return FORM_TYPE_LABELS[formType] || formType;
}




