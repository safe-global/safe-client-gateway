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
  RichInfo,
  RichTokenValueFragment,
  RichTextFragment,
  RichInfoFragment,
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

  async mapRichInfo(
    transaction: MultisigTransaction | ModuleTransaction,
    chainId: string,
  ): Promise<RichInfo | null> {
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

      const richInfoFragments = await this.enrichFragments(
        humanDescriptionFragments,
        transaction,
        chainId,
      );

      const richInfo = await this.enrichSafeAppInfo(
        richInfoFragments,
        transaction,
        chainId,
      );

      return {
        fragments: richInfo,
      };
    } catch (error) {
      this.loggingService.debug(
        `Error trying to decode the input data: ${error.message}`,
      );
      return null;
    }
  }

  mapHumanDescription(richInfo: RichInfo | null): string | null {
    if (!richInfo?.fragments) return null;

    return richInfo.fragments
      .map((fragment) => {
        if (fragment.type === ValueType.TokenValue) {
          return `${fragment.value} ${fragment.richData?.symbol}`;
        }

        return fragment.value;
      })
      .join(' ');
  }

  async enrichFragments(
    fragments: HumanDescriptionFragment[],
    transaction: MultisigTransaction | ModuleTransaction,
    chainId: string,
  ): Promise<RichInfoFragment[]> {
    return Promise.all(
      fragments.map(async (fragment) => {
        switch (fragment.type) {
          case ValueType.TokenValue:
            return this.enrichTokenValue(fragment, transaction, chainId);
          case ValueType.Address:
          default:
            return { ...fragment, richData: null };
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

      let amount: string;
      if (fragment.value.amount === MAX_UINT256) {
        amount = 'unlimited';
      } else if (token && token.decimals) {
        amount = formatUnits(fragment.value.amount, token.decimals);
      } else {
        amount = fragment.value.amount.toString();
      }

      return <RichTokenValueFragment>{
        type: ValueType.TokenValue,
        value: amount,
        richData: {
          symbol: token.symbol,
          logoUri: token.logoUri,
        },
      };
    } catch (error) {
      return {
        type: ValueType.TokenValue,
        value: fragment.value.amount.toString(),
        richData: {
          symbol: null,
          logoUri: null,
        },
      };
    }
  }

  async enrichSafeAppInfo(
    fragments: RichInfoFragment[],
    transaction: MultisigTransaction | ModuleTransaction,
    chainId: string,
  ): Promise<RichInfoFragment[]> {
    const safeAppInfo = isMultisigTransaction(transaction)
      ? await this.safeAppInfoMapper.mapSafeAppInfo(chainId, transaction)
      : null;

    if (safeAppInfo) {
      fragments.push(<RichTextFragment>{
        type: ValueType.Text,
        value: `via ${safeAppInfo.name}`,
        richData: null,
      });
    }

    return fragments;
  }

  private getSigHash(data: Hex): Hex | null {
    const dataStart = data.slice(0, HumanDescriptionMapper.SIG_HASH_INDEX);

    return isHex(dataStart) ? dataStart : null;
  }
}
