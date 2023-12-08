import { Inject, Injectable } from '@nestjs/common';
import {
  Hex,
  createPublicClient,
  getAddress,
  getContract,
  http,
  parseAbi,
} from 'viem';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.interface';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts.entity';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';
import { MultiSendDecoder } from '@/domain/alerts/contracts/multi-send-decoder.helper';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { IEmailRepository } from '@/domain/email/email.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';

@Injectable()
export class AlertsRepository implements IAlertsRepository {
  constructor(
    @Inject(IAlertsApi)
    private readonly alertsApi: IAlertsApi,
    @Inject(IEmailApi)
    private readonly emailApi: IEmailApi,
    @Inject(IEmailRepository)
    private readonly emailRepository: IEmailRepository,
    private readonly delayModifierDecoder: DelayModifierDecoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  async addContracts(contracts: Array<AlertsRegistration>): Promise<void> {
    await this.alertsApi.addContracts(contracts);
  }

  async handleAlertLog(chainId: string, log: AlertLog): Promise<void> {
    const moduleAddress = log.address;

    const decodedEvent = this.delayModifierDecoder.decodeEventLog({
      data: log.data as Hex,
      topics: log.topics as [Hex, Hex, Hex],
    });

    const decodedTransactions = this.decodeTransactionAdded(
      decodedEvent.args.data,
    );

    if (!decodedTransactions) {
      const target = await this.getRecoveryTarget({ chainId, moduleAddress });
      return this._notifyUnknownTransaction({ chainId, safeAddress: target });
    }

    const safeAddress = decodedEvent.args.to;

    const safe = await this.safeRepository.getSafe({
      chainId,
      address: safeAddress,
    });

    for (const decodedTransaction of decodedTransactions) {
      switch (decodedTransaction.functionName) {
        case 'addOwnerWithThreshold': {
          const [ownerToAdd, newThreshold] = decodedTransaction.args;

          safe.owners.push(ownerToAdd);
          safe.threshold = Number(newThreshold);
          break;
        }
        case 'removeOwner': {
          const [, ownerToRemove, newThreshold] = decodedTransaction.args;

          safe.owners = safe.owners.filter((owner) => {
            return owner.toLowerCase() !== ownerToRemove.toLowerCase();
          });
          safe.threshold = Number(newThreshold);
          break;
        }
        case 'swapOwner': {
          const [, ownerToRemove, ownerToAdd] = decodedTransaction.args;

          safe.owners = safe.owners.map((owner) => {
            return owner.toLowerCase() === ownerToRemove.toLowerCase()
              ? ownerToAdd
              : owner;
          });
          break;
        }
        case 'changeThreshold': {
          const [newThreshold] = decodedTransaction.args;

          safe.threshold = Number(newThreshold);
          break;
        }
        default: {
          return this._notifyUnknownTransaction({ chainId, safeAddress });
        }
      }
    }
  }

  private decodeTransactionAdded(data: Hex) {
    try {
      const decoded = this.safeDecoder.decodeFunctionData({ data });

      if (decoded.functionName !== 'execTransaction') {
        return [decoded];
      }

      // TODO: Check "validity" of multiSend transaction:
      // - calling official deployment
      // - all transactions are to current Safe
      // - all transactions are owner management
      return this.multiSendDecoder
        .mapMultiSendTransactions(decoded.args[2])
        .flatMap(({ data }) => this.safeDecoder.decodeFunctionData({ data }));
    } catch {
      return null;
    }
  }

  async getRecoveryTarget(args: {
    chainId: string;
    moduleAddress: string;
  }): Promise<string> {
    const FUNCTION_SIGNATURE =
      'function target() view returns (address)' as const;

    const chain = await this.chainsRepository.getChain(args.chainId);

    // TODO: Add token
    const rpcUrl = chain.rpcUri.value;

    const chainConfig = {
      id: Number(chain.chainId),
      name: chain.chainName,
      network: chain.chainName.toLowerCase(),
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] },
      },
    };

    const publicClient = createPublicClient({
      chain: chainConfig,
      transport: http(),
    });

    const contract = getContract({
      address: getAddress(args.moduleAddress),
      abi: parseAbi([FUNCTION_SIGNATURE]),
      publicClient,
    });

    return contract.read.target();
  }

  private async _notifyUnknownTransaction(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const emails =
      await this.emailRepository.getVerifiedEmailsBySafeAddress(args);

    if (!emails.length) {
      this.loggingService.debug(
        `An alert log for an invalid transaction with no verified emails associated was thrown for Safe ${args.safeAddress}`,
      );
    } else {
      return this.emailApi.createMessage({
        to: emails,
        template: this.configurationService.getOrThrow<string>(
          'email.templates.unknownRecoveryTx',
        ),
        // TODO: subject and substitutions need to be set according to the template design
        subject: 'Unknown transaction attempt',
        substitutions: {},
      });
    }
  }
}
