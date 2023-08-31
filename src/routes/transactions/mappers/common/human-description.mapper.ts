import { Hex } from 'viem/src/types/misc';
import { Inject, Injectable } from '@nestjs/common';
import { formatUnits, isHex } from 'viem';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { MAX_UINT256 } from '../../constants';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IHumanDescriptionRepository } from '@/domain/human-description/human-description.repository.interface';
import { HumanDescriptionRepository } from '@/domain/human-description/human-description.repository';
import {
  HumanDescriptionFragment,
  TokenValueFragment,
  ValueType,
} from '@/domain/human-description/entities/human-description.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { isMultisigTransaction } from '@/domain/safe/entities/transaction.entity';
import { SafeAppInfoMapper } from './safe-app-info.mapper';
import {
  RichHumanDescriptionFragment,
  RichTokenValueFragment,
  RichWordFragment,
} from '@/routes/transactions/entities/human-description.entity';

@Injectable()
export class HumanDescriptionMapper {
  private static SIG_HASH_INDEX = 10;

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
  ): Promise<RichHumanDescriptionFragment[] | null> {
    if (!transaction.data || !isHex(transaction.data) || !transaction.to) {
      return null;
    }

    const sigHash = this.getSigHash(transaction.data);

    if (!sigHash) return null;

    try {
      const humanDescriptionFragments =
        this.humanDescriptionRepository.getHumanDescription({
          functionSignatureHash: sigHash,
          to: transaction.to,
          data: transaction.data,
        });

      const humanDescriptionComponents = await this.enrichFragments(
        humanDescriptionFragments,
        transaction,
        chainId,
      );

      return this.enrichSafeAppInfo(
        humanDescriptionComponents,
        transaction,
        chainId,
      );
    } catch (error) {
      this.loggingService.debug(
        `Error trying to decode the input data: ${error.message}`,
      );
      return null;
    }
  }

  async enrichFragments(
    fragments: HumanDescriptionFragment[],
    transaction: MultisigTransaction | ModuleTransaction,
    chainId: string,
  ): Promise<RichHumanDescriptionFragment[]> {
    return Promise.all(
      fragments.map(async (fragment) => {
        switch (fragment.type) {
          case ValueType.TokenValue:
            return this.enrichTokenValue(fragment, transaction, chainId);
          case ValueType.Address:
          default:
            return fragment;
        }
      }),
    );
  }

  async enrichTokenValue(
    fragment: TokenValueFragment,
    transaction: MultisigTransaction | ModuleTransaction,
    chainId: string,
  ): Promise<RichTokenValueFragment> {
    try {
      const token = await this.tokenRepository.getToken({
        chainId,
        address: transaction.to,
      });

      return <RichTokenValueFragment>{
        type: ValueType.TokenValue,
        value: {
          token,
          amount:
            fragment.value.amount === MAX_UINT256
              ? 'unlimited'
              : token.decimals
              ? formatUnits(fragment.value.amount, token.decimals)
              : fragment.value.amount.toString(),
        },
      };
    } catch (error) {
      return {
        type: ValueType.TokenValue,
        value: {
          amount: fragment.value.amount.toString(),
          token: null,
        },
      };
    }
  }

  async enrichSafeAppInfo(
    components: RichHumanDescriptionFragment[],
    transaction: MultisigTransaction | ModuleTransaction,
    chainId: string,
  ): Promise<RichHumanDescriptionFragment[]> {
    const safeAppInfo = isMultisigTransaction(transaction)
      ? await this.safeAppInfoMapper.mapSafeAppInfo(chainId, transaction)
      : null;

    if (safeAppInfo) {
      components.push(<RichWordFragment>{
        type: ValueType.Word,
        value: `via ${safeAppInfo.name}`,
      });
    }

    return components;
  }

  private getSigHash(data: Hex): Hex | null {
    const dataStart = data.slice(0, HumanDescriptionMapper.SIG_HASH_INDEX);

    return isHex(dataStart) ? dataStart : null;
  }
}
