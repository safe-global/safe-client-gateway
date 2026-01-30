import { z } from 'zod';

// Accepts only ISO format (without offset/local by default)
export const DateStringSchema = z.iso.datetime();
