/**
 * 故事结构校验工具
 * 检查节点连通性，找出孤立节点和死胡同
 *
 * 这是视觉小说游戏脚本质量保证的核心工具
 */
import { z } from "zod";
export declare const ValidateStructureInputSchema: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        isStart: z.ZodOptional<z.ZodBoolean>;
        isEnding: z.ZodOptional<z.ZodBoolean>;
        nextNodeId: z.ZodOptional<z.ZodString>;
        choices: z.ZodOptional<z.ZodArray<z.ZodObject<{
            targetNodeId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            targetNodeId: string;
        }, {
            targetNodeId: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type?: string | undefined;
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
        }[] | undefined;
    }, {
        id: string;
        type?: string | undefined;
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
        }[] | undefined;
    }>, "many">;
    locale: z.ZodDefault<z.ZodOptional<z.ZodEnum<["zh-CN", "en-US"]>>>;
}, "strip", z.ZodTypeAny, {
    nodes: {
        id: string;
        type?: string | undefined;
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
        }[] | undefined;
    }[];
    locale: "zh-CN" | "en-US";
}, {
    nodes: {
        id: string;
        type?: string | undefined;
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
        }[] | undefined;
    }[];
    locale?: "zh-CN" | "en-US" | undefined;
}>;
export declare const ValidateStructureOutputSchema: z.ZodObject<{
    valid: z.ZodBoolean;
    orphans: z.ZodArray<z.ZodString, "many">;
    deadEnds: z.ZodArray<z.ZodString, "many">;
    invalidLinks: z.ZodArray<z.ZodString, "many">;
    reachableCount: z.ZodNumber;
    totalCount: z.ZodNumber;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    valid: boolean;
    orphans: string[];
    deadEnds: string[];
    invalidLinks: string[];
    reachableCount: number;
    totalCount: number;
    error?: string | undefined;
}, {
    valid: boolean;
    orphans: string[];
    deadEnds: string[];
    invalidLinks: string[];
    reachableCount: number;
    totalCount: number;
    error?: string | undefined;
}>;
export type ValidateStructureInput = z.infer<typeof ValidateStructureInputSchema>;
export type ValidateStructureOutput = z.infer<typeof ValidateStructureOutputSchema>;
/**
 * 执行结构校验
 */
export declare function validateStructure(input: ValidateStructureInput): ValidateStructureOutput;
//# sourceMappingURL=validate-structure.d.ts.map