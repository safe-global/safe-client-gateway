import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { MAX_TTL } from '@/datasources/cache/constants';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { Inject } from '@nestjs/common';
import { isAddress, getAddress } from 'viem';

export class SanctionedAddressesRepository {
  private static readonly SdnListUrl =
    'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML';

  /**
   * The above XML file contains a list of sanctioned addresses in the following format:
   * <id>
   *   <uid>69420</uid>
   *   <idType>Digital Currency Address - ETH</idType>
   *   <idNumber>0x...</idNumber>
   * </id>
   */
  private static readonly AddressIdTypeTag = 'Digital Currency Address - ETH';

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async getSanctionedAddresses(): Promise<Array<`0x${string}`>> {
    const cacheDir = CacheRouter.getSanctionedAddressesCacheDir();
    const cachedAddresses = await this.cacheService.get(cacheDir);

    if (cachedAddresses) {
      return JSON.parse(cachedAddresses);
    } else {
      await this.updateSanctionedAddresses();

      const newCachedAddresses = await this.cacheService.get(cacheDir);
      if (!newCachedAddresses) {
        throw new Error('Failed populate sanctioned addresses cache');
      }

      return JSON.parse(newCachedAddresses);
    }
  }

  private async updateSanctionedAddresses(): Promise<void> {
    const cacheDir = CacheRouter.getSanctionedAddressesCacheDir();

    try {
      const list = await this.networkService.get<string>({
        url: SanctionedAddressesRepository.SdnListUrl,
      });
      const addresses = this.parseAddressesFromList(list.data);

      await this.cacheService.set(cacheDir, JSON.stringify(addresses), MAX_TTL);
    } catch (error) {
      this.loggingService.debug(
        `Failed to update sanction list: ${asError(error).message}`,
      );
      throw new Error('Unable to update sanctioned addresses');
    }
  }

  private parseAddressesFromList(xml: string): Array<`0x${string}`> {
    const addresses = new Set<`0x${string}`>();

    const idTagMatches = xml.match(this.getXmlRegEx('id', true));

    if (!idTagMatches) {
      throw new Error('No sanctions found in SDN list');
    }

    for (const idTagMatch of idTagMatches) {
      const idTypeTagMatch = idTagMatch.match(this.getXmlRegEx('idType'));
      const idNumberTagMatch = idTagMatch.match(this.getXmlRegEx('idNumber'));

      if (!idTypeTagMatch || !idNumberTagMatch) {
        continue;
      }

      const idType = idTypeTagMatch[1].trim();
      const idNumber = idNumberTagMatch[1].trim();

      console.log(idType, idNumber);

      if (
        idType == SanctionedAddressesRepository.AddressIdTypeTag &&
        isAddress(idNumber)
      ) {
        addresses.add(getAddress(idNumber));
      }
    }

    return Array.from(addresses);
  }

  private getXmlRegEx(tagName: string, global: boolean = false): RegExp {
    const pattern = `<${tagName}>([\\s\\S]*?)<\\/${tagName}>`;
    return new RegExp(pattern, global ? 'g' : '');
  }
}
