import { Hex } from 'viem/src/types/misc';
import { Inject, Injectable } from '@nestjs/common';
import { decodeFunctionData, formatUnits, isHex } from 'viem';
import { ITokenRepository } from '../../../../domain/tokens/token.repository.interface';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import { Token } from '../../../../domain/tokens/entities/token.entity';
import { MAX_UINT256 } from '../../../../routes/transactions/constants';
import {
  ILoggingService,
  LoggingService,
} from '../../../../logging/logging.interface';
import { SafeAppInfo } from '../../../transactions/entities/safe-app-info.entity';
import { IHumanDescriptionRepository } from '../../../../domain/human-description/human-description.repository.interface';
import { HumanDescriptionRepository } from '../../../../domain/human-description/human-description.repository';
import {
  HumanDescriptionFragment,
  ValueType,
} from '../../../../domain/human-description/entities/human-description.entity';

@Injectable()
export class HumanDescriptionMapper {
  constructor(
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IHumanDescriptionRepository)
    private readonly humanDescriptionRepository: HumanDescriptionRepository,
  ) {}

  async mapHumanDescription(
    to: string | undefined,
    data: string | null,
    chainId: string,
    safeAppInfo: SafeAppInfo | null,
  ): Promise<string | null> {
    if (!data || !isHex(data) || !to) return null;

    const parsedDescriptions =
      this.humanDescriptionRepository.getDescriptions();

    const dataStart = data.slice(0, 10);
    const sigHash = isHex(dataStart) ? dataStart : null;

    if (!sigHash) return null;

    const template = parsedDescriptions[sigHash];
    const isHumanReadable = !!template;

    if (!isHumanReadable) return null;

    let token: Token | null = null;
    try {
      token = await this.tokenRepository.getToken({ chainId, address: to });
    } catch (error) {
      this.loggingService.debug(`Error trying to get token: ${error.message}`);
    }

    try {
      const { abi, process } = template;

      const { args = [] } = decodeFunctionData({ abi, data });

      const messageFragments = process(to, args);

      const message = this.createHumanDescription(messageFragments, token);

      return safeAppInfo ? `${message} via ${safeAppInfo.name}` : message;
    } catch (error) {
      this.loggingService.debug(
        `Error trying to decode the input data: ${error.message}`,
      );
      return null;
    }
  }

  createHumanDescription(
    descriptionFragments: HumanDescriptionFragment[],
    token: Token | null,
  ): string {
    return descriptionFragments
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
            return this.shortenAddress(block.value);
          default:
            return block.value;
        }
      })
      .join(' ');
  }

  private shortenAddress(address: Hex, length = 4): string {
    if (address.length !== 42) {
      throw Error('Invalid address');
    }

    const visibleCharactersLength = length * 2 + 2;

    if (address.length < visibleCharactersLength) {
      return address;
    }

    return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
  }
}
