import { z } from 'zod';

// TODO: Define the schema for BridgeStatus
export const BridgeStatusSchema = z.any();

export type BridgeStatus = z.infer<typeof BridgeStatusSchema>;
