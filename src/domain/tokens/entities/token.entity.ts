import { TokenSchema } from '@/domain/tokens/entities/schemas/token.schema';
import { z } from 'zod';

export enum TokenType {
  Erc721 = 'ERC721',
  Erc20 = 'ERC20',
  NativeToken = 'NATIVE_TOKEN',
}

export type Token = z.infer<typeof TokenSchema>;
