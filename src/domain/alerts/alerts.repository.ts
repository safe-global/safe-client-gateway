import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.interface';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts-registration.entity';
import { AlertsDeletion } from '@/domain/alerts/entities/alerts-deletion.entity';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/decoders/delay-modifier-decoder.helper';
import { SafeDecoder } from '@/domain/contracts/decoders/safe-decoder.helper';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { IAccountRepository } from '@/domain/account/account.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { UrlGeneratorHelper } from '@/domain/alerts/urls/url-generator.helper';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { ISubscriptionRepository } from '@/domain/subscriptions/subscription.repository.interface';
import { SubscriptionRepository } from '@/domain/subscriptions/subscription.repository';
import { Account } from '@/domain/account/entities/account.entity';

@Injectable()
export class AlertsRepository implements IAlertsRepository {
  private static readonly UNKNOWN_TX_EMAIL_SUBJECT = 'Malicious transaction';
  private static readonly RECOVERY_TX_EMAIL_SUBJECT = 'Recovery attempt';

  constructor(
    @Inject(IAlertsApi)
    private readonly alertsApi: IAlertsApi,
    @Inject(IEmailApi)
    private readonly emailApi: IEmailApi,
    @Inject(IAccountRepository)
    private readonly accountRepository: IAccountRepository,
    private readonly urlGenerator: UrlGeneratorHelper,
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
    private readonly chainRepository: IChainsRepository,
    @Inject(ISubscriptionRepository)
    private readonly subscriptionRepository: ISubscriptionRepository,
  ) {}

  async addContract(contract: AlertsRegistration): Promise<void> {
    await this.alertsApi.addContract(contract);
  }

  async deleteContract(contract: AlertsDeletion): Promise<void> {
    await this.alertsApi.deleteContract(contract);
  }

  async handleAlertLog(chainId: string, log: AlertLog): Promise<void> {
    const moduleAddress = log.address;

    const { safes } = await this.safeRepository.getSafesByModule({
      chainId,
      moduleAddress,
    });

    if (safes.length === 0) {
      this.loggingService.debug(
        `An alert for a module that is not activated on a Safe was received. moduleAddress=${moduleAddress}`,
      );
      return;
    }

    // Recovery module is deployed per Safe so we can assume that it is only enabled on one
    const safeAddress = safes[0];
    const subscribedAccounts = await this._getSubscribedAccounts({
      chainId,
      safeAddress,
    });
    if (subscribedAccounts.length === 0) {
      this.loggingService.debug(
        `An alert for a Safe with no associated emails was received. moduleAddress=${moduleAddress}, safeAddress=${safeAddress}`,
      );
      return;
    }

    try {
      const safe = await this.safeRepository.getSafe({
        chainId,
        address: safeAddress,
      });

      const decodedEvent = this.delayModifierDecoder.decodeEventLog({
        data: log.data as Hex,
        topics: log.topics as [Hex, Hex, Hex],
      });
      const decodedTransactions = this._decodeTransactionAdded(
        decodedEvent.args.data,
      );

      const newSafeState = await this._mapSafeSetup({
        safe,
        decodedTransactions,
      });

      await this._notifySafeSetup({
        chainId,
        newSafeState,
        accountsToNotify: subscribedAccounts,
      });
    } catch {
      await this._notifyUnknownTransaction({
        chainId,
        safeAddress,
        accountsToNotify: subscribedAccounts,
      });
    }
  }

  /**
   * Gets all the subscribed accounts to CATEGORY_ACCOUNT_RECOVERY for a given safe
   *
   * @param args.chainId - the chain id where the safe is deployed
   * @param args.safeAddress - the safe address to which the accounts should be retrieved
   *
   * @private
   */
  private async _getSubscribedAccounts(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<Account[]> {
    const accounts = await this.accountRepository.getAccounts({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      onlyVerified: true,
    });

    const subscribedAccounts = accounts.map(async (account) => {
      const accountSubscriptions =
        await this.subscriptionRepository.getSubscriptions({
          chainId: account.chainId,
          safeAddress: account.safeAddress,
          signer: account.signer,
        });
      return accountSubscriptions.some(
        (subscription) =>
          subscription.key === SubscriptionRepository.CATEGORY_ACCOUNT_RECOVERY,
      )
        ? account
        : null;
    });

    return (await Promise.all(subscribedAccounts)).filter(
      (account): account is Account => account !== null,
    );
  }

  private _decodeTransactionAdded(
    data: Hex,
  ): Array<ReturnType<typeof this._decodeRecoveryTransaction>> {
    try {
      return this.multiSendDecoder
        .mapMultiSendTransactions(data)
        .flatMap((multiSend) => {
          return this._decodeRecoveryTransaction(multiSend.data);
        });
    } catch {
      return [this._decodeRecoveryTransaction(data)];
    }
  }

  private _decodeRecoveryTransaction(
    data: Hex,
  ): ReturnType<typeof this.safeDecoder.decodeFunctionData> {
    const decoded = this.safeDecoder.decodeFunctionData({ data });

    const isRecoveryTransaction = [
      'addOwnerWithThreshold',
      'removeOwner',
      'swapOwner',
      'changeThreshold',
    ].includes(decoded.functionName);

    if (!isRecoveryTransaction) {
      throw new Error('Unknown recovery transaction');
    }

    return decoded;
  }

  private async _mapSafeSetup(args: {
    safe: Safe;
    decodedTransactions: Array<ReturnType<SafeDecoder['decodeFunctionData']>>;
  }): Promise<Safe> {
    return args.decodedTransactions.reduce((newSafe, decodedTransaction) => {
      switch (decodedTransaction.functionName) {
        case 'addOwnerWithThreshold': {
          const [ownerToAdd, newThreshold] = decodedTransaction.args;

          newSafe.owners.push(ownerToAdd);
          newSafe.threshold = Number(newThreshold);
          break;
        }
        case 'removeOwner': {
          const [, ownerToRemove, newThreshold] = decodedTransaction.args;

          newSafe.owners = newSafe.owners.filter((owner) => {
            return owner.toLowerCase() !== ownerToRemove.toLowerCase();
          });
          newSafe.threshold = Number(newThreshold);
          break;
        }
        case 'swapOwner': {
          const [, ownerToRemove, ownerToAdd] = decodedTransaction.args;

          newSafe.owners = newSafe.owners.map((owner) => {
            return owner.toLowerCase() === ownerToRemove.toLowerCase()
              ? ownerToAdd
              : owner;
          });
          break;
        }
        case 'changeThreshold': {
          const [newThreshold] = decodedTransaction.args;

          newSafe.threshold = Number(newThreshold);
          break;
        }
        default: {
          throw new Error(
            `Unknown recovery transaction ${decodedTransaction?.functionName}`,
          );
        }
      }

      return newSafe;
    }, structuredClone(args.safe));
  }

  private async _notifyUnknownTransaction(args: {
    safeAddress: string;
    chainId: string;
    accountsToNotify: Account[];
  }): Promise<void> {
    const chain = await this.chainRepository.getChain(args.chainId);
    const webAppUrl = this.urlGenerator.addressToSafeWebAppUrl({
      chain,
      safeAddress: args.safeAddress,
    });

    const emailActions = args.accountsToNotify.map((account) => {
      const unsubscriptionUrl = this.urlGenerator.unsubscriptionSafeWebAppUrl({
        unsubscriptionToken: account.unsubscriptionToken,
      });
      return this.emailApi.createMessage({
        to: [account.emailAddress.value],
        template: this.configurationService.getOrThrow<string>(
          'email.templates.unknownRecoveryTx',
        ),
        subject: AlertsRepository.UNKNOWN_TX_EMAIL_SUBJECT,
        substitutions: {
          webAppUrl,
          unsubscriptionUrl,
        },
      });
    });

    Promise.allSettled(emailActions)
      .then((results) => {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const signer = args.accountsToNotify.at(index)?.signer;
            this.loggingService.warn(
              `Error sending email to user with account ${signer}, for Safe ${args.safeAddress} on chain ${args.chainId}`,
            );
          }
        });
      })
      .catch((reason) => {
        this.loggingService.warn(reason);
      });
  }

  private async _notifySafeSetup(args: {
    chainId: string;
    newSafeState: Safe;
    accountsToNotify: Account[];
  }): Promise<void> {
    const chain = await this.chainRepository.getChain(args.chainId);

    const webAppUrl = this.urlGenerator.addressToSafeWebAppUrl({
      chain,
      safeAddress: args.newSafeState.address,
    });
    const owners = args.newSafeState.owners.map((address) => {
      return {
        address,
        explorerUrl: this.urlGenerator.addressToExplorerUrl({
          chain,
          address,
        }),
      };
    });

    const emailActions = args.accountsToNotify.map((account) => {
      const unsubscriptionUrl = this.urlGenerator.unsubscriptionSafeWebAppUrl({
        unsubscriptionToken: account.unsubscriptionToken,
      });
      return this.emailApi.createMessage({
        to: [account.emailAddress.value],
        template: this.configurationService.getOrThrow<string>(
          'email.templates.recoveryTx',
        ),
        subject: AlertsRepository.RECOVERY_TX_EMAIL_SUBJECT,
        substitutions: {
          webAppUrl,
          owners,
          threshold: args.newSafeState.threshold.toString(),
          unsubscriptionUrl,
        },
      });
    });

    Promise.allSettled(emailActions)
      .then((results) => {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const signer = args.accountsToNotify.at(index)?.signer;
            this.loggingService.warn(
              `Error sending email to user with account ${signer}, for Safe ${args.newSafeState.address} on chain ${args.chainId}`,
            );
          }
        });
      })
      .catch((reason) => {
        this.loggingService.warn(reason);
      });
  }
}
