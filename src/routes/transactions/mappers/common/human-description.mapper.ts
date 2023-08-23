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
import { IHumanDescriptionRepository } from '../../../../domain/human-description/human-description.repository.interface';
import { HumanDescriptionRepository } from '../../../../domain/human-description/human-description.repository';
import {
  HumanDescriptionFragment,
  ValueType,
} from '../../../../domain/human-description/entities/human-description.entity';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { ModuleTransaction } from '../../../../domain/safe/entities/module-transaction.entity';
import { isMultisigTransaction } from '../../../../domain/safe/entities/transaction.entity';
import { SafeAppInfoMapper } from './safe-app-info.mapper';

@Injectable()
export class HumanDescriptionMapper {
  constructor(
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IHumanDescriptionRepository)
    private readonly humanDescriptionRepository: HumanDescriptionRepository,
    private readonly safeAppInfoMapper: SafeAppInfoMapper,
  ) {}

  async mapHumanDescription(
    transaction: MultisigTransaction | ModuleTransaction,
    chainId: string,
  ): Promise<string | null> {
    if (!transaction.data || !isHex(transaction.data) || !transaction.to) {
      return null;
    }

    const parsedDescriptions =
      this.humanDescriptionRepository.getDescriptions();

    const dataStart = transaction.data.slice(0, 10);
    const sigHash = isHex(dataStart) ? dataStart : null;

    if (!sigHash) return null;

    const template = parsedDescriptions[sigHash];
    const isHumanReadable = !!template;

    if (!isHumanReadable) return null;

    let token: Token | null = null;
    try {
      token = await this.tokenRepository.getToken({
        chainId,
        address: transaction.to,
      });
    } catch (error) {
      this.loggingService.debug(`Error trying to get token: ${error.message}`);
    }

    try {
      const { abi, process } = template;

      const { args = [] } = decodeFunctionData({ abi, data: transaction.data });

      const descriptionFragments = process(transaction.to, args);

      const description = this.createHumanDescription(
        descriptionFragments,
        token,
      );

      const safeAppInfo = isMultisigTransaction(transaction)
        ? await this.safeAppInfoMapper.mapSafeAppInfo(chainId, transaction)
        : null;

      return safeAppInfo
        ? `${description} via ${safeAppInfo.name}`
        : description;
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
      .map((fragment) => {
        switch (fragment.type) {
          case ValueType.TokenValue:
            if (!token?.decimals) {
              console.log(token);
              return fragment.value.amount;
            }

            // Unlimited approval
            if (fragment.value.amount === MAX_UINT256) {
              return `unlimited ${token.symbol}`;
            }

            return `${formatUnits(fragment.value.amount, token.decimals)} ${
              token.symbol
            }`;
          case ValueType.Address:
            return this.shortenAddress(fragment.value);
          default:
            return fragment.value;
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
