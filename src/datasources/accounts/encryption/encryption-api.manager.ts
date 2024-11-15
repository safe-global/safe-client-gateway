import { IConfigurationService } from '@/config/configuration.service.interface';
import { AccountsEncryptionType } from '@/config/entities/schemas/configuration.schema';
import { AwsEncryptionApiService } from '@/datasources/accounts/encryption/aws-encryption-api.service';
import { LocalEncryptionApiService } from '@/datasources/accounts/encryption/local-encryption-api.service';
import { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';
import { IEncryptionApiManager } from '@/domain/interfaces/encryption-api.manager.interface';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class EncryptionApiManager
  implements IEncryptionApiManager, OnModuleInit
{
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
  ) {
    this.accountsEncryptionType =
      this.configurationService.getOrThrow<AccountsEncryptionType>(
        'accounts.encryption.type',
      );
  }

  // TODO: LocalStack testing
  async onModuleInit(): Promise<void> {
    await new AwsEncryptionApiService(this.configurationService).onModuleInit();
  }

  getApi(): Promise<IEncryptionApi> {
    if (this.encryptionApi) return Promise.resolve(this.encryptionApi);
    switch (this.accountsEncryptionType) {
      case 'aws':
        this.encryptionApi = new AwsEncryptionApiService(
          this.configurationService,
        );
        break;
      case 'local':
        this.encryptionApi = new LocalEncryptionApiService(
          this.configurationService,
        );
        break;
      default:
        throw new Error(
          `Unsupported encryption type: ${this.accountsEncryptionType}`,
        );
    }
    return Promise.resolve(this.encryptionApi);
  }

  destroyApi(): void {
    this.encryptionApi = undefined;
  }
}
