import { Inject, Injectable } from '@nestjs/common';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { SafeList } from '@/modules/owners/routes/entities/safe-list.entity';
import { SafesByChainIdV3 } from '@/modules/safe/domain/entities/safes-by-chain-id-v3.entity';
import { findSimilarAddressPairs } from '@/modules/owners/routes/utils/address-poisoning';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { Address } from 'viem';

@Injectable()
export class OwnersService {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async getSafesByOwner(args: {
    chainId: string;
    ownerAddress: Address;
  }): Promise<SafeList> {
    return this.safeRepository.getSafesByOwner(args);
  }

  async getAllSafesByOwner(args: {
    ownerAddress: Address;
  }): Promise<{ [chainId: string]: Array<string> | null }> {
    const safesByChainId = await this.safeRepository.getAllSafesByOwner(args);
    return this.filterPoisonedAddresses(safesByChainId);
  }

  private async detectPoisonedAddresses(
    chainId: string,
    addresses: Array<string>,
  ): Promise<Set<string>> {
    const poisoned = new Set<string>();
    const pairs = findSimilarAddressPairs(addresses);

    if (pairs.length === 0) return poisoned;

    await Promise.allSettled(
      pairs.map(async ([i, j]) => {
        const [resultI, resultJ] = await Promise.allSettled([
          this.safeRepository.getCreationTransaction({
            chainId,
            safeAddress: addresses[i] as Address,
          }),
          this.safeRepository.getCreationTransaction({
            chainId,
            safeAddress: addresses[j] as Address,
          }),
        ]);

        if (resultI.status === 'fulfilled' && resultJ.status === 'fulfilled') {
          const timeI = resultI.value.created.getTime();
          const timeJ = resultJ.value.created.getTime();

          if (timeI > timeJ) {
            poisoned.add(addresses[i]);
          } else if (timeJ > timeI) {
            poisoned.add(addresses[j]);
          } else {
            // Equal creation dates — cannot determine which is malicious, skip pair
            this.loggingService.warn(
              `Address poisoning detection: equal creation dates for pair ${addresses[i]} and ${addresses[j]} on chain ${chainId}`,
            );
          }
        } else {
          this.loggingService.warn(
            `Address poisoning detection: failed to fetch creation transactions for pair ${addresses[i]} and ${addresses[j]} on chain ${chainId}`,
          );
        }
      }),
    );

    return poisoned;
  }

  private async filterPoisonedAddresses(safesByChainId: {
    [chainId: string]: Array<string> | null;
  }): Promise<{ [chainId: string]: Array<string> | null }> {
    const entries = Object.entries(safesByChainId);
    const results = await Promise.all(
      entries.map(async ([chainId, addresses]) => {
        if (addresses === null) {
          return [chainId, null] as const;
        }
        const poisoned = await this.detectPoisonedAddresses(chainId, addresses);
        if (poisoned.size === 0) {
          return [chainId, addresses] as const;
        }
        return [
          chainId,
          addresses.filter((addr) => !poisoned.has(addr)),
        ] as const;
      }),
    );
    return Object.fromEntries(results);
  }

  async getAllSafesByOwnerV3(args: {
    ownerAddress: Address;
  }): Promise<SafesByChainIdV3> {
    return this.safeRepository.getAllSafesByOwnerV3(args);
  }
}
