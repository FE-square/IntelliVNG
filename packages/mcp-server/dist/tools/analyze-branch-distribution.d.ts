/**
 * 分支分布分析工具
 * 检测"伪非线性"问题 - 即分支是否过于集中在故事末尾
 *
 * 真正的非线性叙事应该在故事早期就开始分支
 */
import { z } from "zod";
export declare const AnalyzeBranchDistributionInputSchema: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodOptional<z.ZodEnum<["scene", "branch", "ending"]>>;
        isStart: z.ZodOptional<z.ZodBoolean>;
        isEnding: z.ZodOptional<z.ZodBoolean>;
        functionTag: z.ZodOptional<z.ZodEnum<["setup", "rising", "conflict", "twist", "climax", "falling", "resolution"]>>;
        nextNodeId: z.ZodOptional<z.ZodString>;
        choices: z.ZodOptional<z.ZodArray<z.ZodObject<{
            targetNodeId: z.ZodString;
            branchType: z.ZodOptional<z.ZodEnum<["route", "relationship", "information", "ending"]>>;
        }, "strip", z.ZodTypeAny, {
            targetNodeId: string;
            branchType?: "ending" | "route" | "relationship" | "information" | undefined;
        }, {
            targetNodeId: string;
            branchType?: "ending" | "route" | "relationship" | "information" | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type?: "scene" | "branch" | "ending" | undefined;
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
            branchType?: "ending" | "route" | "relationship" | "information" | undefined;
        }[] | undefined;
        functionTag?: "setup" | "rising" | "conflict" | "twist" | "climax" | "falling" | "resolution" | undefined;
    }, {
        id: string;
        type?: "scene" | "branch" | "ending" | undefined;
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
            branchType?: "ending" | "route" | "relationship" | "information" | undefined;
        }[] | undefined;
        functionTag?: "setup" | "rising" | "conflict" | "twist" | "climax" | "falling" | "resolution" | undefined;
    }>, "many">;
    locale: z.ZodDefault<z.ZodOptional<z.ZodEnum<["zh-CN", "en-US"]>>>;
}, "strip", z.ZodTypeAny, {
    nodes: {
        id: string;
        type?: "scene" | "branch" | "ending" | undefined;
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
            branchType?: "ending" | "route" | "relationship" | "information" | undefined;
        }[] | undefined;
        functionTag?: "setup" | "rising" | "conflict" | "twist" | "climax" | "falling" | "resolution" | undefined;
    }[];
    locale: "zh-CN" | "en-US";
}, {
    nodes: {
        id: string;
        type?: "scene" | "branch" | "ending" | undefined;
        isStart?: boolean | undefined;
        isEnding?: boolean | undefined;
        nextNodeId?: string | undefined;
        choices?: {
            targetNodeId: string;
            branchType?: "ending" | "route" | "relationship" | "information" | undefined;
        }[] | undefined;
        functionTag?: "setup" | "rising" | "conflict" | "twist" | "climax" | "falling" | "resolution" | undefined;
    }[];
    locale?: "zh-CN" | "en-US" | undefined;
}>;
export declare const AnalyzeBranchDistributionOutputSchema: z.ZodObject<{
    isPseudoNonLinear: z.ZodBoolean;
    distributionScore: z.ZodNumber;
    branchByPhase: z.ZodObject<{
        setup: z.ZodNumber;
        rising: z.ZodNumber;
        conflict: z.ZodNumber;
        climax: z.ZodNumber;
        resolution: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        setup: number;
        rising: number;
        conflict: number;
        climax: number;
        resolution: number;
    }, {
        setup: number;
        rising: number;
        conflict: number;
        climax: number;
        resolution: number;
    }>;
    branchTypeStats: z.ZodObject<{
        route: z.ZodNumber;
        relationship: z.ZodNumber;
        information: z.ZodNumber;
        ending: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        ending: number;
        route: number;
        relationship: number;
        information: number;
    }, {
        ending: number;
        route: number;
        relationship: number;
        information: number;
    }>;
    suggestions: z.ZodArray<z.ZodString, "many">;
    earlyBranchRatio: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    isPseudoNonLinear: boolean;
    distributionScore: number;
    branchByPhase: {
        setup: number;
        rising: number;
        conflict: number;
        climax: number;
        resolution: number;
    };
    branchTypeStats: {
        ending: number;
        route: number;
        relationship: number;
        information: number;
    };
    suggestions: string[];
    earlyBranchRatio: number;
}, {
    isPseudoNonLinear: boolean;
    distributionScore: number;
    branchByPhase: {
        setup: number;
        rising: number;
        conflict: number;
        climax: number;
        resolution: number;
    };
    branchTypeStats: {
        ending: number;
        route: number;
        relationship: number;
        information: number;
    };
    suggestions: string[];
    earlyBranchRatio: number;
}>;
export type AnalyzeBranchDistributionInput = z.infer<typeof AnalyzeBranchDistributionInputSchema>;
export type AnalyzeBranchDistributionOutput = z.infer<typeof AnalyzeBranchDistributionOutputSchema>;
/**
 * 执行分支分布分析
 */
export declare function analyzeBranchDistribution(input: AnalyzeBranchDistributionInput): AnalyzeBranchDistributionOutput;
//# sourceMappingURL=analyze-branch-distribution.d.ts.map