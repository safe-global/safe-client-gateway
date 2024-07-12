import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';
import { GetContractEventsReturnType, parseAbi } from 'viem';

@Injectable()
export class SanctionedAddressesIndexer {
  // TODO: Include some form of E2E test to ensure pageSize is correctly set and doesn't error
  private static readonly OracleByChainId: {
    [chainId: string]: {
      address: `0x${string}`;
      creationTxHash: `0x${string}`;
      pageSize: bigint | null;
    };
  } = {
    // Mainnet
    '1': {
      address: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb',
      creationTxHash:
        '0x06b69d22afb6fd1399d2ee15bf51ed53d55212ccf8a2bfd5d427ecc06d5c519f',
      pageSize: null,
    },
    // BSC
    '56': {
      address: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb',
      creationTxHash:
        '0x4383f79125e4912a454a2b340e1307a45fbae424e4c434a50c96c1b8ab839f3a',
      pageSize: BigInt(2_000),
    },
    // Polygon
    '137': {
      address: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb',
      creationTxHash:
        '0x2402805df99b3ce3a92ae073ef2221b73a711867d1ded529a51f21e91e9a7dae',
      pageSize: null,
    },
    // Base
    '8453': {
      address: '0x3A91A31cB3dC49b4db9Ce721F50a9D076c8D739B',
      creationTxHash:
        '0x4a7273ae2cbec2c80e7a72640101dbe0c765d39fe06b557a8f29898d9fe6131a',
      pageSize: null,
    },
    // Arbitrum
    '42161': {
      address: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb',
      creationTxHash:
        '0x85d27fb186607a904c8e8dd8dcfb54c7217a7e1564cdb438fa7bde982f3ab062',
      pageSize: null,
    },
    // Celo
    '42220': {
      address: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb',
      creationTxHash:
        '0x1d1e60302407e6409989e01ca6c5ef5b70dd2e8f78c05c5fa04eebe5c0e36cc1',
      pageSize: null,
    },
    // Avalanche
    '43114': {
      address: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb',
      creationTxHash:
        '0x272a3311131feacc7b32138896c05f580cc8b5dfece2256c0848b323c1503f0d',
      pageSize: null,
    },
    // Optimism
    '11155420': {
      address: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb',
      creationTxHash:
        '0x141d187d2a1cde323896752ebd9d4b843b0c040865c82ec8b1db92fcf134c7eb',
      pageSize: null,
    },
  };

  private static readonly OracleAbi = parseAbi([
    'event SanctionedAddressesAdded(address[] addrs)',
    'event SanctionedAddressesRemoved(address[] addrs)',
  ]);

  constructor(
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  // TODO: Store addresses with block indexed until (for continuation) - concatenated across all chains?
  async getSanctionedAddresses(chainId: string): Promise<Array<`0x${string}`>> {
    const events = await this.getAllSanctionEvents(chainId);

    // Parse events, accordingly populating a sanctioned addresses Set
    const blockedAddresses = events.reduce((acc, event) => {
      for (const address of event.args.addrs) {
        if (event.eventName === 'SanctionedAddressesAdded') {
          acc.add(address);
        } else if (event.eventName === 'SanctionedAddressesRemoved') {
          acc.delete(address);
        } else {
          throw new Error('Unexpected log when fetching blocked addresses');
        }
      }
      return acc;
    }, new Set<`0x${string}`>());

    return Array.from(blockedAddresses);
  }

  private async getAllSanctionEvents(
    chainId: string,
  ): Promise<
    GetContractEventsReturnType<
      typeof SanctionedAddressesIndexer.OracleAbi,
      undefined,
      true,
      bigint,
      bigint
    >
  > {
    const contract = SanctionedAddressesIndexer.OracleByChainId[chainId];

    if (!contract) {
      this.loggingService.warn(
        `Sanctioned addresses contract not found for chain ${chainId}`,
      );
      return [];
    }

    const blockchainApi = await this.blockchainApiManager.getApi(chainId);
    const [creationTx, latestBlock] = await Promise.all([
      blockchainApi.getTransactionReceipt({
        hash: contract.creationTxHash,
      }),
      blockchainApi.getBlockNumber(),
    ]);

    // Index by page to avoid log limitations
    const pageSize = contract.pageSize ?? creationTx.blockNumber;

    const events: GetContractEventsReturnType<
      typeof SanctionedAddressesIndexer.OracleAbi,
      undefined,
      true,
      bigint,
      bigint
    > = [];

    for (
      let block = creationTx.blockNumber;
      block < latestBlock;
      block += pageSize
    ) {
      const pageEvents = await blockchainApi
        .getContractEvents({
          address: contract.address,
          abi: SanctionedAddressesIndexer.OracleAbi,
          fromBlock: block,
          toBlock: block + pageSize - BigInt(1),
          strict: true,
        })
        // Errors are likely due to RPC restrictions
        .catch((e) => {
          this.loggingService.warn(
            `Error fetching sanctioned addresses events for chain ${chainId} with a page size of ${pageSize}: ${e.message}`,
          );
          return [];
        });

      const isInsufficientLogs = BigInt(pageEvents.length) < pageSize;
      const isLastPage = block + pageSize > latestBlock;

      if (isInsufficientLogs && !isLastPage) {
        throw new Error(
          `RPC returned insufficient logs (${pageEvents.length}/${pageSize.toString()})! There is likely an \`eth_Logs\` restriction on chain ${chainId}`,
        );
      }

      events.push(...pageEvents);
    }

    return events;
  }
}
