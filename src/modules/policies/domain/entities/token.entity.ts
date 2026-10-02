// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type {
  Erc20Token,
  NativeToken,
} from '@/modules/tokens/domain/entities/token.entity';

export type Token = NativeToken | Erc20Token;

export type TokenReference = { chainId: string; token: Address };
