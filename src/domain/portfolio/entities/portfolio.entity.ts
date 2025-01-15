import { z } from 'zod';

export const PortfolioSchema = z.unknown();

export type Portfolio = z.infer<typeof PortfolioSchema>;
