import { z } from 'zod';

// TODO: Populate list of exchanges, and add tests
export const ExchangeNameSchema = z.string();

export type ExchangeName = z.infer<typeof ExchangeNameSchema>;
