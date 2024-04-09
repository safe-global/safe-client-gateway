import { z } from 'zod';
import { isHex } from 'viem';

export const HexSchema = z.string().refine(isHex, {
  message: 'Invalid hex string',
});
