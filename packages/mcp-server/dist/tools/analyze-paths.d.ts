/**
 * 路径多样性分析工具
 * 枚举所有可能的故事路径，评估分支的多样性
 *
 * 这是评估非线性叙事质量的关键工具
 */
import { z } from "zod";
export declare const AnalyzePathsInputSchema: z.ZodObject<{
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
}>;
export declare const AnalyzePathsOutputSchema: z.ZodObject<{
    totalPaths: z.ZodNumber;
    diversityScore: z.ZodNumber;
    pathDescriptions: z.ZodArray<z.ZodString, "many">;
    avgPathLength: z.ZodNumber;
    lengthVariance: z.ZodNumber;
    endingCount: z.ZodNumber;
    branchPointCount: z.ZodNumber;
    nonLinearityScore: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    totalPaths: number;
    diversityScore: number;
    pathDescriptions: string[];
    avgPathLength: number;
    lengthVariance: number;
    endingCount: number;
    branchPointCount: number;
    nonLinearityScore: number;
}, {
    totalPaths: number;
    diversityScore: number;
    pathDescriptions: string[];
    avgPathLength: number;
    lengthVariance: number;
    endingCount: number;
    branchPointCount: number;
    nonLinearityScore: number;
}>;
export type AnalyzePathsInput = z.infer<typeof AnalyzePathsInputSchema>;
export type AnalyzePathsOutput = z.infer<typeof AnalyzePathsOutputSchema>;
/**
 * 执行路径分析
 */
export declare function analyzePaths(input: AnalyzePathsInput): AnalyzePathsOutput;
//# sourceMappingURL=analyze-paths.d.ts.map