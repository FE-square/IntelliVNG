/**
 * 约束合规检查工具
 * 校验故事图是否满足规模/分支/深度等约束
 */
import { z } from "zod";
export declare const CheckConstraintsInputSchema: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
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
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
        }[] | undefined;
    }, {
        id: string;
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
        }[] | undefined;
    }>, "many">;
    constraints: z.ZodOptional<z.ZodObject<{
        targetNodeCount: z.ZodOptional<z.ZodNumber>;
        targetEndingCount: z.ZodOptional<z.ZodNumber>;
        maxDepth: z.ZodOptional<z.ZodNumber>;
        maxBranching: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        targetNodeCount?: number | undefined;
        targetEndingCount?: number | undefined;
        maxDepth?: number | undefined;
        maxBranching?: number | undefined;
    }, {
        targetNodeCount?: number | undefined;
        targetEndingCount?: number | undefined;
        maxDepth?: number | undefined;
        maxBranching?: number | undefined;
    }>>;
    locale: z.ZodDefault<z.ZodOptional<z.ZodEnum<["zh-CN", "en-US"]>>>;
}, "strip", z.ZodTypeAny, {
    nodes: {
        id: string;
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
        }[] | undefined;
    }[];
    locale: "zh-CN" | "en-US";
    constraints?: {
        targetNodeCount?: number | undefined;
        targetEndingCount?: number | undefined;
        maxDepth?: number | undefined;
        maxBranching?: number | undefined;
    } | undefined;
}, {
    nodes: {
        id: string;
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
        }[] | undefined;
    }[];
    locale?: "zh-CN" | "en-US" | undefined;
    constraints?: {
        targetNodeCount?: number | undefined;
        targetEndingCount?: number | undefined;
        maxDepth?: number | undefined;
        maxBranching?: number | undefined;
    } | undefined;
}>;
export declare const CheckConstraintsOutputSchema: z.ZodObject<{
    nodeCount: z.ZodNumber;
    endingCount: z.ZodNumber;
    branchPointCount: z.ZodNumber;
    maxDepthFound: z.ZodNumber;
    maxBranchingFound: z.ZodNumber;
    hasStart: z.ZodBoolean;
    violations: z.ZodArray<z.ZodString, "many">;
    complianceScore: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    endingCount: number;
    branchPointCount: number;
    nodeCount: number;
    maxDepthFound: number;
    maxBranchingFound: number;
    hasStart: boolean;
    violations: string[];
    complianceScore: number;
}, {
    endingCount: number;
    branchPointCount: number;
    nodeCount: number;
    maxDepthFound: number;
    maxBranchingFound: number;
    hasStart: boolean;
    violations: string[];
    complianceScore: number;
}>;
export type CheckConstraintsInput = z.infer<typeof CheckConstraintsInputSchema>;
export type CheckConstraintsOutput = z.infer<typeof CheckConstraintsOutputSchema>;
export declare function checkConstraints(input: CheckConstraintsInput): CheckConstraintsOutput;
//# sourceMappingURL=check-constraints.d.ts.map