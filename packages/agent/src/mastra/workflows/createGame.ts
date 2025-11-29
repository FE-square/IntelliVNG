import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';
import { directorAgent } from '../agents/director';

// Step 1: Ideation
const ideationStep = new Step({
    id: 'ideation',
    agent: directorAgent,
    inputSchema: z.object({
        idea: z.string(),
    }),
    outputSchema: z.object({
        gameDesign: z.any(), // TODO: Define strict schema
    }),
    execute: async ({ context, agent }) => {
        const prompt = \`
      User Idea: \${context.input.idea}
      
      Please generate a game design including title, characters, and backgrounds.
    \`;
    const result = await agent.generate(prompt);
    return { gameDesign: result.text };
  },
});

export const createGameWorkflow = new Workflow({
  name: 'create-game',
  triggerSchema: z.object({
    idea: z.string(),
  }),
  steps: [ideationStep],
});
