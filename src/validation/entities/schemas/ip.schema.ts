import { z } from 'zod';

export const IpSchema = z.string().ip();
