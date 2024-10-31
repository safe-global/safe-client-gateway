import { z } from 'zod';

export const IndexingStatusSchema = z.object({
  currentBlockNumber: z.number(),
  currentBlockTimestamp: z.coerce.date(),
  erc20BlockNumber: z.number(),
  erc20BlockTimestamp: z.coerce.date(),
  erc20Synced: z.boolean(),
  masterCopiesBlockNumber: z.number(),
  masterCopiesBlockTimestamp: z.coerce.date(),
  masterCopiesSynced: z.boolean(),
  synced: z.boolean(),
});

export type IndexingStatus = z.infer<typeof IndexingStatusSchema>;
