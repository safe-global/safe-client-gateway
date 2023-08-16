import { Inject, Injectable } from '@nestjs/common';
import {
  decodeFunctionData,
  getFunctionSelector,
  parseAbi,
  formatUnits,
  isHex,
} from 'viem';
import { ITokenRepository } from '../../../../domain/tokens/token.repository.interface';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import { Token } from '../../../../domain/tokens/entities/token.entity';
import { MAX_UINT256 } from '../../../../routes/transactions/constants';
import {
  ILoggingService,
  LoggingService,
} from '../../../../logging/logging.interface';
import { shortenAddress } from '../../../common/utils/utils';
import { SafeAppInfo } from '../../../transactions/entities/safe-app-info.entity';
import { IHumanDescriptionApi } from '../../../../domain/interfaces/human-description-api.interface';
import {
  HumanReadableFragment,
  ValueType,
} from '../../../../datasources/human-description-api/entities/human-description.entity';

// TODO: Write tests for this mapper
@Injectable()
export class HumanDescriptionsMapper {
  constructor(
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IHumanDescriptionApi)
    private readonly humanDescriptionApiService: IHumanDescriptionApi,
  ) {}

  async mapHumanDescription(
    to: string | undefined,
    data: string | null,
    chainId: string,
    safeAppInfo: SafeAppInfo | null,
  ): Promise<string | undefined> {
    if (!data || !isHex(data) || !to) return;

    const parsedMessages = Object.entries(
      this.humanDescriptionApiService.getParsedMessages(),
    );

    for (const [callSignature, template] of parsedMessages) {
      const sigHash = getFunctionSelector(callSignature);

      const isHumanReadable = data.startsWith(sigHash);

      if (isHumanReadable) {
        const token = await this.tokenRepository
          .getToken({ chainId, address: to })
          .catch(() => null);

        const abi = parseAbi([callSignature]);

        try {
          const { args } = decodeFunctionData({ abi, data });
          const messageFragments = template.process(to, args);

          const message = this.createMessage(messageFragments, token);

          return safeAppInfo
            ? message.concat(' via ', safeAppInfo.name)
            : message;
        } catch (error) {
          this.loggingService.info(
            `Error trying to decode the input data: ${error.message}`,
          );
          return;
        }
      }
    }

    return;
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

            // Unlimited approval
            if (block.value.amount === MAX_UINT256) {
              return `unlimited ${token.symbol}`;
            }

            return `${formatUnits(block.value.amount, token.decimals)} ${
              token.symbol
            }`;
          case ValueType.Address:
            return shortenAddress(block.value);
          default:
            return block.value;
        }
      })
      .join(' ');
  }
}
