import { Inject, Injectable } from '@nestjs/common';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { Chain } from '@/modules/chains/domain/entities/chain.entity';
import { generateShareTemplate } from '@/modules/share/templates/transaction-share.template';
import {
  ShareImageGenerator,
  TransactionImageData,
} from '@/modules/share/helpers/share-image.generator';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  ISafeRepository,
  SafeRepositoryModule,
} from '@/modules/safe/domain/safe.repository.interface';
import { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import {
  MULTISIG_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '@/modules/transactions/routes/constants';

@Injectable()
export class ShareService {
  private readonly frontendUrl: string;
  private readonly cgwUrl: string;

  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    private readonly shareImageGenerator: ShareImageGenerator,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.frontendUrl =
      this.configurationService.get<string>('share.frontendUrl') ??
      'https://app.safe.global';
    this.cgwUrl =
      this.configurationService.get<string>('share.cgwUrl') ??
      'https://safe-client.safe.global';
  }

  async generateTransactionHtml(safe: string, txId: string): Promise<string> {
    const chainId = this.extractChainId(safe);

    const [txData, chain] = await Promise.all([
      this.getTransactionData(chainId, txId),
      this.chainsRepository.getChain(chainId),
    ]);

    const frontendUrl = `${this.frontendUrl}/transactions/tx?safe=${safe}&id=${txId}`;
    const imageUrl = `${this.cgwUrl}/v1/share/tx/image?safe=${encodeURIComponent(safe)}&id=${encodeURIComponent(txId)}`;

    return generateShareTemplate({
      title: txData.title,
      description: this.getDescription(txData, chain),
      image: imageUrl,
      url: frontendUrl,
      redirectUrl: frontendUrl,
    });
  }

  async generateTransactionImage(
    safe: string,
    txId: string,
  ): Promise<{ image: Buffer; contentType: string }> {
    const chainId = this.extractChainId(safe);

    const [txData, chain] = await Promise.all([
      this.getTransactionData(chainId, txId),
      this.chainsRepository.getChain(chainId),
    ]);

    const imageData: TransactionImageData = {
      txType: txData.title,
      status: txData.status,
      chainName: chain.chainName,
      safeAddress: this.extractAddress(safe),
      confirmationsSubmitted: txData.confirmationsSubmitted,
      confirmationsRequired: txData.confirmationsRequired,
    };

    const image =
      await this.shareImageGenerator.generateTransactionImage(imageData);

    return {
      image,
      contentType: this.shareImageGenerator.getSvgContentType(),
    };
  }

  private async getTransactionData(
    chainId: string,
    txId: string,
  ): Promise<{
    title: string;
    status: string;
    confirmationsSubmitted?: number;
    confirmationsRequired?: number;
  }> {
    const [txType, , safeTxHash] = txId.split(TRANSACTION_ID_SEPARATOR);

    if (txType === MULTISIG_TRANSACTION_PREFIX && safeTxHash) {
      const tx = await this.safeRepository.getMultiSigTransaction({
        chainId,
        safeTransactionHash: safeTxHash,
      });

      return {
        title: this.getTxTitle(tx),
        status: this.getStatusFromMultisig(tx),
        confirmationsSubmitted: tx.confirmations?.length ?? 0,
        confirmationsRequired: tx.confirmationsRequired,
      };
    }

    return {
      title: 'Transaction',
      status: 'Unknown',
    };
  }

  private extractChainId(safe: string): string {
    const parts = safe.split(':');
    return parts[0];
  }

  private extractAddress(safe: string): string {
    const parts = safe.split(':');
    return parts.length > 1 ? parts[1] : safe;
  }

  private getTxTitle(tx: MultisigTransaction): string {
    if (tx.value && BigInt(tx.value) > 0n && (!tx.data || tx.data === '0x')) {
      return 'ETH Transfer';
    }
    if (tx.data && tx.data !== '0x') {
      return 'Contract Interaction';
    }
    return 'Transaction';
  }

  private getStatusFromMultisig(tx: MultisigTransaction): string {
    if (tx.isExecuted) {
      return tx.isSuccessful ? 'Executed' : 'Failed';
    }
    return 'Pending';
  }

  private getDescription(
    txData: { status: string; confirmationsSubmitted?: number; confirmationsRequired?: number },
    chain: Chain,
  ): string {
    if (
      txData.status === 'Pending' &&
      txData.confirmationsSubmitted !== undefined &&
      txData.confirmationsRequired !== undefined
    ) {
      return `${txData.confirmationsSubmitted}/${txData.confirmationsRequired} signatures - Pending on ${chain.chainName}`;
    }
    return `${txData.status} transaction on ${chain.chainName}`;
  }
}
