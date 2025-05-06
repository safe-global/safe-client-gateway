import { z } from 'zod';

// TODO: Confirm list of supported exchange names
export const ExchangeNameSchema = z.string();

export type ExchangeName = z.infer<typeof ExchangeNameSchema>;
