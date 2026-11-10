// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { PortfolioSchema } from '#/modules/portfolio/domain/entities/portfolio.entity';

/**
 * A portfolio as cached from one Zerion /positions call, with when it was
 * fetched and when its cache entry is due to expire (epoch milliseconds). It
 * is the entry GET /v1/portfolio reads, so totals summed from it match the
 * Assets page.
 */
export const PortfolioSnapshotSchema = PortfolioSchema.extend({
  fetchedAt: z.number(),
  expiresAt: z.number(),
});

export type PortfolioSnapshot = z.infer<typeof PortfolioSnapshotSchema>;
