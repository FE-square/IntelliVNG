/**
 * 非线性综合评分工具
 * 复用路径分析与分支分布分析，给出单一可视化评分
 */
import { z } from "zod";
export declare const ScoreNonLinearityInputSchema: z.ZodObject<{
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
export declare const ScoreNonLinearityOutputSchema: z.ZodObject<{
    overallScore: z.ZodNumber;
    components: z.ZodObject<{
        pathNonLinearity: z.ZodNumber;
        distributionScore: z.ZodNumber;
        diversityScore: z.ZodNumber;
        cognitiveFriendlyScore: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        diversityScore: number;
        distributionScore: number;
        pathNonLinearity: number;
        cognitiveFriendlyScore: number;
    }, {
        diversityScore: number;
        distributionScore: number;
        pathNonLinearity: number;
        cognitiveFriendlyScore: number;
    }>;
    endingCount: z.ZodNumber;
    branchPointCount: z.ZodNumber;
    earlyBranchRatio: z.ZodNumber;
    notes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    endingCount: number;
    branchPointCount: number;
    earlyBranchRatio: number;
    overallScore: number;
    components: {
        diversityScore: number;
        distributionScore: number;
        pathNonLinearity: number;
        cognitiveFriendlyScore: number;
    };
    notes: string[];
}, {
    endingCount: number;
    branchPointCount: number;
    earlyBranchRatio: number;
    overallScore: number;
    components: {
        diversityScore: number;
        distributionScore: number;
        pathNonLinearity: number;
        cognitiveFriendlyScore: number;
    };
    notes: string[];
}>;
export type ScoreNonLinearityInput = z.infer<typeof ScoreNonLinearityInputSchema>;
export type ScoreNonLinearityOutput = z.infer<typeof ScoreNonLinearityOutputSchema>;
export declare function scoreNonLinearity(input: ScoreNonLinearityInput): ScoreNonLinearityOutput;
//# sourceMappingURL=score-nonlinearity.d.ts.map