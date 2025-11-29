import { Mastra, Agent } from '@mastra/core';
import { directorAgent } from './agents/director';
import { createGameWorkflow } from './workflows/createGame';

export const mastra = new Mastra({
    agents: {
        director: directorAgent,
    },
    workflows: {
        createGame: createGameWorkflow,
    },
});
