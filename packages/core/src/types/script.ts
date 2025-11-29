import { TransitionType } from './game';

// Base Node Type
export type ScriptNode =
    | DialogueNode
    | ChoiceNode
    | SceneChangeNode
    | NarrationNode
    | ConditionNode
    | SetVariableNode;

// Node Base Interface
interface BaseNode {
    id: string;
    type: string;
    // For React Flow positioning
    position: { x: number; y: number };
}

// Dialogue Node
export interface DialogueNode extends BaseNode {
    type: 'dialogue';
    characterId: string;
    spriteId?: string;              // Which expression to use
    text: string;
    // Dialogue effects
    effect?: DialogueEffect;
    // Next node
    nextNodeId: string | null;
}

export interface DialogueEffect {
    textAnimation?: 'typewriter' | 'fade' | 'none';
    screenEffect?: 'shake' | 'flash' | 'none';
}

// Narration Node
export interface NarrationNode extends BaseNode {
    type: 'narration';
    text: string;
    nextNodeId: string | null;
}

// Choice Node
export interface ChoiceNode extends BaseNode {
    type: 'choice';
    prompt?: string;                // Prompt text before choices
    choices: Choice[];
}

export interface Choice {
    id: string;
    text: string;
    nextNodeId: string;
    // Optional: Choice condition
    condition?: Condition;
    // Optional: Set variables after choice
    setVariables?: VariableAssignment[];
}

// Scene Change Node
export interface SceneChangeNode extends BaseNode {
    type: 'scene-change';
    backgroundId: string;
    variantId?: string;
    transition: TransitionType;
    // Reset character positions
    characterPositions?: CharacterPosition[];
    nextNodeId: string | null;
}

export interface CharacterPosition {
    characterId: string;
    spriteId?: string;
    position: 'left' | 'center' | 'right' | 'off';
}

// Condition Node (Advanced)
export interface ConditionNode extends BaseNode {
    type: 'condition';
    condition: Condition;
    trueNodeId: string;
    falseNodeId: string;
}

export interface Condition {
    variable: string;
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
    value: string | number | boolean;
}

// Set Variable Node
export interface SetVariableNode extends BaseNode {
    type: 'set-variable';
    assignments: VariableAssignment[];
    nextNodeId: string | null;
}

export interface VariableAssignment {
    variable: string;
    operation: 'set' | 'add' | 'subtract';
    value: string | number | boolean;
}
