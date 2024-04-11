import { z } from 'zod';
import { isHex } from 'viem';

export const HexSchema = z.string().refine(isHex, {
  message: 'Invalid "0x" notated hex string',
});
