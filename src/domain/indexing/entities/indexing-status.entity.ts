import { z } from 'zod';

export const IndexingStatusSchema = z.object({
  currentBlockNumber: z.number(),
  erc20BlockNumber: z.number(),
  erc20Synced: z.boolean(),
  masterCopiesBlockNumber: z.number(),
  masterCopiesSynced: z.boolean(),
  synced: z.boolean(),
});

export type IndexingStatus = z.infer<typeof IndexingStatusSchema>;
