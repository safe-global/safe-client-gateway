import { Inject, Injectable } from '@nestjs/common';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { MasterCopyVersionState, SafeState } from './entities/safe-info.entity';
import { IChainsRepository } from '../../domain/chains/chains.repository.interface';
import * as semver from 'semver';
import { MasterCopy } from '../../domain/chains/entities/master-copies.entity';
import { Safe } from '../../domain/safe/entities/safe.entity';
import { AddressInfoHelper } from '../common/address-info/address-info.helper';
import {
  isEthereumTransaction,
  isModuleTransaction,
  isMultisigTransaction,
} from '../../domain/safe/entities/transaction.entity';
import { AddressInfo } from '../common/entities/address-info.entity';
import { NULL_ADDRESS } from '../common/constants';
import { MessagesRepository } from '../../domain/messages/messages.repository';
import { IMessagesRepository } from '../../domain/messages/messages.repository.interface';

@Injectable()
export class SafesService {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    private readonly addressInfoHelper: AddressInfoHelper,
    @Inject(IMessagesRepository)
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async getSafeInfo(chainId: string, safeAddress: string): Promise<SafeState> {
    const [safe, { recommendedMasterCopyVersion }, supportedMasterCopies] =
      await Promise.all([
        this.safeRepository.getSafe({ chainId, address: safeAddress }),
        this.chainsRepository.getChain(chainId),
        this.chainsRepository.getMasterCopies(chainId),
      ]);

    const versionState = this.computeVersionState(
      safe,
      recommendedMasterCopyVersion,
      supportedMasterCopies,
    );

    const [
      masterCopyInfo,
      fallbackHandlerInfo,
      guardInfo,
      collectiblesTag,
      queuedTransactionTag,
      transactionHistoryTag,
      messagesTag,
    ] = await Promise.all([
      this.addressInfoHelper.getOrDefault(chainId, safe.masterCopy, [
        'CONTRACT',
      ]),
      safe.fallbackHandler === NULL_ADDRESS
        ? Promise.resolve(null)
        : this.addressInfoHelper.getOrDefault(chainId, safe.fallbackHandler, [
            'CONTRACT',
          ]),
      safe.guard === NULL_ADDRESS
        ? Promise.resolve(null)
        : this.addressInfoHelper.getOrDefault(chainId, safe.guard, [
            'CONTRACT',
          ]),
      this.getCollectiblesTag(chainId, safeAddress),
      this.getQueuedTransactionTag(chainId, safe),
      this.executedTransactionTag(chainId, safeAddress),
      this.modifiedMessageTag(chainId, safeAddress),
    ]);

    let moduleAddressesInfo: AddressInfo[] | null = null;
    if (safe.modules) {
      const moduleInfoCollection: Array<AddressInfo> =
        await this.addressInfoHelper.getCollection(chainId, safe.modules, [
          'CONTRACT',
        ]);
      moduleAddressesInfo =
        moduleInfoCollection.length == 0 ? null : moduleInfoCollection;
    }

    return new SafeState(
      new AddressInfo(safe.address),
      chainId,
      safe.nonce,
      safe.threshold,
      safe.owners.map((ownerAddress) => new AddressInfo(ownerAddress)),
      masterCopyInfo,
      versionState,
      this.toUnixTimestampInSecondsOrNow(collectiblesTag).toString(),
      this.toUnixTimestampInSecondsOrNow(queuedTransactionTag).toString(),
      this.toUnixTimestampInSecondsOrNow(transactionHistoryTag).toString(),
      this.toUnixTimestampInSecondsOrNow(messagesTag).toString(),
      moduleAddressesInfo,
      fallbackHandlerInfo,
      guardInfo,
      safe.version,
    );
  }

  private toUnixTimestampInSecondsOrNow(date: Date | null): number {
    const dateValue = date ? date.valueOf() : Date.now();
    return Math.floor(dateValue / 1000);
  }

  private async getCollectiblesTag(
    chainId: string,
    safeAddress: string,
  ): Promise<Date | null> {
    const lastCollectibleTransfer =
      await this.safeRepository.getCollectibleTransfers({
        chainId,
        safeAddress,
        limit: 1,
        offset: 0,
      });

    return lastCollectibleTransfer.results[0]?.executionDate ?? null;
  }

  private async getQueuedTransactionTag(
    chainId: string,
    safe: Safe,
  ): Promise<Date | null> {
    const lastQueuedTransaction =
      await this.safeRepository.getTransactionQueueByModified({
        chainId,
        safe,
        limit: 1,
      });

    return lastQueuedTransaction.results[0]?.modified ?? null;
  }

  private async executedTransactionTag(
    chainId: string,
    safeAddress: string,
  ): Promise<Date | null> {
    const lastExecutedTransaction = (
      await this.safeRepository.getTransactionHistoryByExecutionDate({
        chainId,
        safeAddress,
        limit: 1,
      })
    ).results[0];

    if (!lastExecutedTransaction) return null;

    if (isMultisigTransaction(lastExecutedTransaction)) {
      return (
        lastExecutedTransaction.modified ??
        lastExecutedTransaction.submissionDate
      );
    } else if (isEthereumTransaction(lastExecutedTransaction)) {
      return lastExecutedTransaction.executionDate;
    } else if (isModuleTransaction(lastExecutedTransaction)) {
      return lastExecutedTransaction.executionDate;
    } else {
      // This should never happen as AJV would not allow an unknown transaction to get to this stage
      throw Error('Unrecognized transaction type');
    }
  }

  private async modifiedMessageTag(
    chainId: string,
    safeAddress: string,
  ): Promise<Date | null> {
    const messages = await this.messagesRepository.getMessagesBySafe({
      chainId,
      safeAddress,
    });

    if (messages.results.length === 0) {
      return null;
    }

    const sortedMessages = messages.results.sort((m1, m2) => {
      return m2.modified.getTime() - m1.modified.getTime();
    });

    return sortedMessages[0].modified;
  }

  private computeVersionState(
    safe: Safe,
    recommendedSafeVersion: string,
    supportedMasterCopies: MasterCopy[],
  ): MasterCopyVersionState {
    // If the safe version or the recommended safe version is not valid we return UNKNOWN
    if (!semver.valid(safe.version)) return MasterCopyVersionState.UNKNOWN;
    if (!semver.valid(recommendedSafeVersion))
      return MasterCopyVersionState.UNKNOWN;
    // If the master copy of this safe is not part of the collection
    // of the supported master copies we return UNKNOWN
    if (
      !supportedMasterCopies
        .map((masterCopy) => masterCopy.address)
        .includes(safe.masterCopy)
    )
      return MasterCopyVersionState.UNKNOWN;

    // If the safe version is lower than the recommended safe version
    // we return it as outdated
    if (semver.lt(safe.version, recommendedSafeVersion))
      return MasterCopyVersionState.OUTDATED;

    // Else we consider that the safe is up-to-date
    return MasterCopyVersionState.UP_TO_DATE;
  }
}
