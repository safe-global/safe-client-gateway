import { Inject, Injectable } from '@nestjs/common';
import { MessagesParsed } from '../../entities/readable-descriptions/parsed-messages';
import {
  decodeFunctionData,
  getFunctionSelector,
  parseAbi,
  Hex,
  formatUnits,
} from 'viem';
import { ITokenRepository } from 'src/domain/tokens/token.repository.interface';
import { TokenRepository } from 'src/domain/tokens/token.repository';
import { Token } from 'src/domain/tokens/entities/token.entity';
import { UNLIMITED_APPROVAL_AMOUNT } from 'src/routes/transactions/constants';

export enum ValueType {
  Word = 'word',
  TokenValue = 'tokenValue',
  Identifier = 'identifier',
  Recipient = 'recipient',
  Decimals = 'decimals',
}

export type TokenValueType = {
  amount: bigint;
  address: string;
};

interface TokenValueFragment {
  type: ValueType.TokenValue;
  value: TokenValueType;
}

interface WordFragment {
  type: ValueType.Word;
  value: string;
}

interface IdentifierFragment {
  type: ValueType.Identifier;
  value: unknown;
}

interface RecipientFragment {
  type: ValueType.Recipient;
  value: string;
}

interface DecimalsFragment {
  type: ValueType.Decimals;
  value: unknown;
}

export type HumanReadableFragment =
  | WordFragment
  | TokenValueFragment
  | IdentifierFragment
  | RecipientFragment
  | DecimalsFragment;

type Message = {
  render: (to: string, params: readonly unknown[]) => HumanReadableFragment[];
};

export type ContractMessages = Record<string, Message>;

// TODO: Write tests for this mapper
@Injectable()
export class ReadableDescriptionsMapper {
  constructor(
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
  ) {}

  async mapReadableDescription(
    to: string,
    data: string | null,
    chainId: string,
  ): Promise<string | null> {
    if (!data) return null;

    for (const [callSignature, message] of Object.entries(MessagesParsed)) {
      const sigHash = getFunctionSelector(callSignature);

      const isHumanReadable = data.startsWith(sigHash);

      if (isHumanReadable) {
        const token = await this.tokenRepository
          .getToken({ chainId, address: to })
          .catch(() => null);

        const abi = parseAbi([callSignature]);
        const { args } = decodeFunctionData({ abi, data: data as Hex });

        const messageBlocks = message.render(to, args);

        return this.createMessage(messageBlocks, token);
      }
    }

    return null;
  }

  createMessage(
    messageBlocks: HumanReadableFragment[],
    token: Token | null,
  ): string {
    return messageBlocks
      .map((block) => {
        switch (block.type) {
          case ValueType.TokenValue:
            if (!token?.decimals) return block.value.amount;

            if (block.value.amount === UNLIMITED_APPROVAL_AMOUNT) {
              return `Unlimited ${token.symbol}`;
            }

            return `${formatUnits(block.value.amount, token.decimals)} ${
              token.symbol
            }`;
          default:
            return block.value;
        }
      })
      .join(' ');
  }
}
