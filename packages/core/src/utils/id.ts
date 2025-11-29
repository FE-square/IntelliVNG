import { nanoid } from 'nanoid';

export const createId = () => nanoid(10);

export const createNodeId = (type: string) => `${type}_${nanoid(8)}`;
