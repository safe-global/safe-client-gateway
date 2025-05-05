import { z } from 'zod';

// TODO: Define the schema for BridgeCalldata
export const BridgeCalldataSchema = z.any();

export type BridgeCalldata = z.infer<typeof BridgeCalldataSchema>;
