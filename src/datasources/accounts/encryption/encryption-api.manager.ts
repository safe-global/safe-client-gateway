import { IConfigurationService } from '@/config/configuration.service.interface';
import { AccountsEncryptionType } from '@/config/entities/schemas/configuration.schema';
import { AwsEncryptionApiService } from '@/datasources/accounts/encryption/aws-encryption-api.service';
import { LocalEncryptionApiService } from '@/datasources/accounts/encryption/local-encryption-api.service';
import { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import { IEncryptionApiManager } from '@/domain/interfaces/encryption-api.manager.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class EncryptionApiManager implements IEncryptionApiManager {
  /**
   * This is linked to the Accounts feature. It is used to determine which encryption provider to use.
   * If the encryption is needed for a different feature, this should be renamed/moved to a generic configuration.
   **/
  private readonly accountsEncryptionType: AccountsEncryptionType;

  /**
   * Only one IEncryptionApi should be active at a time.
   */
  private encryptionApi: IEncryptionApi | undefined;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.accountsEncryptionType =
      this.configurationService.getOrThrow<AccountsEncryptionType>(
        'accounts.encryption.type',
      );
  }

  getApi(): Promise<IEncryptionApi> {
    if (this.encryptionApi) return Promise.resolve(this.encryptionApi);
    return this.accountsEncryptionType === 'aws'
      ? this._setAwsEncryptionApi()
      : this._setLocalEncryptionApi();
  }

  destroyApi(): void {
    this.encryptionApi = undefined;
  }

  private _setAwsEncryptionApi(): Promise<IEncryptionApi> {
    this.encryptionApi = new AwsEncryptionApiService(
      this.configurationService,
      this.loggingService,
    );
    return Promise.resolve(this.encryptionApi);
  }

  private _setLocalEncryptionApi(): Promise<IEncryptionApi> {
    this.encryptionApi = new LocalEncryptionApiService(
      this.configurationService,
    );
    return Promise.resolve(this.encryptionApi);
  }
}
