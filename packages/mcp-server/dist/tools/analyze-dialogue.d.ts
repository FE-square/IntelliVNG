/**
 * 对话质量分析工具
 * 分析每个节点的对话数量和质量
 *
 * 帮助识别对话过少或过多的节点，确保叙事节奏
 */
import { z } from "zod";
export declare const AnalyzeDialogueInputSchema: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        dialogues: z.ZodOptional<z.ZodArray<z.ZodObject<{
            characterId: z.ZodOptional<z.ZodString>;
            characterName: z.ZodOptional<z.ZodString>;
            text: z.ZodString;
            emotion: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            characterId?: string | undefined;
            characterName?: string | undefined;
            emotion?: string | undefined;
        }, {
            text: string;
            characterId?: string | undefined;
            characterName?: string | undefined;
            emotion?: string | undefined;
        }>, "many">>;
        narration: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type?: string | undefined;
        dialogues?: {
            text: string;
            characterId?: string | undefined;
            characterName?: string | undefined;
            emotion?: string | undefined;
        }[] | undefined;
        narration?: string | undefined;
    }, {
        id: string;
        type?: string | undefined;
        dialogues?: {
            text: string;
            characterId?: string | undefined;
            characterName?: string | undefined;
            emotion?: string | undefined;
        }[] | undefined;
        narration?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    nodes: {
        id: string;
        type?: string | undefined;
        dialogues?: {
            text: string;
            characterId?: string | undefined;
            characterName?: string | undefined;
            emotion?: string | undefined;
        }[] | undefined;
        narration?: string | undefined;
    }[];
}, {
    nodes: {
        id: string;
        type?: string | undefined;
        dialogues?: {
            text: string;
            characterId?: string | undefined;
            characterName?: string | undefined;
            emotion?: string | undefined;
        }[] | undefined;
        narration?: string | undefined;
    }[];
}>;
export declare const AnalyzeDialogueOutputSchema: z.ZodObject<{
    avgDialoguesPerNode: z.ZodNumber;
    shortNodes: z.ZodArray<z.ZodString, "many">;
    longNodes: z.ZodArray<z.ZodString, "many">;
    noNarrationNodes: z.ZodArray<z.ZodString, "many">;
    characterStats: z.ZodArray<z.ZodObject<{
        characterName: z.ZodString;
        dialogueCount: z.ZodNumber;
        avgLength: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        characterName: string;
        dialogueCount: number;
        avgLength: number;
    }, {
        characterName: string;
        dialogueCount: number;
        avgLength: number;
    }>, "many">;
    emotionDistribution: z.ZodRecord<z.ZodString, z.ZodNumber>;
    qualityScore: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    avgDialoguesPerNode: number;
    shortNodes: string[];
    longNodes: string[];
    noNarrationNodes: string[];
    characterStats: {
        characterName: string;
        dialogueCount: number;
        avgLength: number;
    }[];
    emotionDistribution: Record<string, number>;
    qualityScore: number;
}, {
    avgDialoguesPerNode: number;
    shortNodes: string[];
    longNodes: string[];
    noNarrationNodes: string[];
    characterStats: {
        characterName: string;
        dialogueCount: number;
        avgLength: number;
    }[];
    emotionDistribution: Record<string, number>;
    qualityScore: number;
}>;
export type AnalyzeDialogueInput = z.infer<typeof AnalyzeDialogueInputSchema>;
export type AnalyzeDialogueOutput = z.infer<typeof AnalyzeDialogueOutputSchema>;
/**
 * 执行对话质量分析
 */
export declare function analyzeDialogue(input: AnalyzeDialogueInput): AnalyzeDialogueOutput;
//# sourceMappingURL=analyze-dialogue.d.ts.map