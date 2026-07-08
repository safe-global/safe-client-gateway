// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { SafeList } from '@/modules/owners/routes/entities/safe-list.entity';
import { findSimilarAddressPairs } from '@/modules/owners/routes/utils/address-poisoning';
import { unionStrip } from '@/modules/owners/routes/utils/malicious-safe-strip';
import type { SafesByChainId } from '@/modules/safe/domain/entities/safes-by-chain-id.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { MaliciousAddressScanner } from '@/modules/safe-shield/malicious-address-scan/malicious-address-scanner.service';

@Injectable()
export class OwnersService {
  private readonly maliciousFilterEnabled: boolean;

  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    private readonly maliciousAddressScanner: MaliciousAddressScanner,
  ) {
    this.maliciousFilterEnabled = configurationService.getOrThrow<boolean>(
      'features.ownersMaliciousFilter',
    );
  }

  async getSafesByOwner(args: {
    chainId: string;
    ownerAddress: Address;
  }): Promise<SafeList> {
    const safeList = await this.safeRepository.getSafesByOwner(args);
    if (!this.maliciousFilterEnabled) return safeList;

    const malicious = await this.maliciousAddressScanner.getMaliciousAddresses(
      args.chainId,
      safeList.safes,
    );
    if (malicious.size === 0) return safeList;
    return { safes: unionStrip(safeList.safes, malicious) };
  }

  getSafesByOwnerV2(args: {
    chainId: string;
    ownerAddress: Address;
  }): Promise<SafeList> {
    return this.safeRepository.getSafesByOwnerV2(args);
  }

  async getAllSafesByOwner(args: {
    ownerAddress: Address;
  }): Promise<SafesByChainId> {
    const safesByChainId = await this.safeRepository.getAllSafesByOwner(args);
    return this.stripPerChain(safesByChainId, { useHeuristic: true });
  }

  async getAllSafesByOwnerV2(args: {
    ownerAddress: Address;
  }): Promise<SafesByChainId> {
    const safesByChainId = await this.safeRepository.getAllSafesByOwnerV2(args);
    return this.stripPerChain(safesByChainId, { useHeuristic: false });
  }

  private async stripPerChain(
    safesByChainId: SafesByChainId,
    opts: { useHeuristic: boolean },
  ): Promise<SafesByChainId> {
    if (!(opts.useHeuristic || this.maliciousFilterEnabled)) {
      return safesByChainId;
    }

    const results = await Promise.all(
      Object.entries(safesByChainId).map(async ([chainId, addresses]) => {
        if (addresses === null) return [chainId, null] as const;

        const stripped = new Set<string>();
        if (this.maliciousFilterEnabled) {
          const malicious =
            await this.maliciousAddressScanner.getMaliciousAddresses(
              chainId,
              addresses,
            );
          for (const address of malicious) stripped.add(address);
        }
        if (opts.useHeuristic) {
          const poisoned = await this.detectPoisonedAddresses(
            chainId,
            addresses,
          );
          for (const address of poisoned) stripped.add(address.toLowerCase());
        }

        if (stripped.size === 0) return [chainId, addresses] as const;
        return [chainId, unionStrip(addresses, stripped)] as const;
      }),
    );
    return Object.fromEntries(results);
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
}
