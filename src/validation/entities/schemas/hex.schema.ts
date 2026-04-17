import { isHex } from 'viem';
import { z } from 'zod';

export const HexSchema = z.string().refine(isHex, {
  error: 'Invalid "0x" notated hex string',
});
