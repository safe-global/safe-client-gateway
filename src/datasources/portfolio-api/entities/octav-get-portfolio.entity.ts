import { z } from 'zod';
import { PortfolioSchema } from '@/domain/portfolio/entities/portfolio.entity';

export const OctavGetPortfolioSchema = z.object({
  getPortfolio: z.array(PortfolioSchema),
});

export type OctavGetPortfolio = z.infer<typeof OctavGetPortfolioSchema>;
