// SPDX-License-Identifier: FSL-1.1-MIT
import { DynamicModule, Global, Module } from '@nestjs/common';
import { DecryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IEncryptionService } from '@/datasources/encryption/encryption.service.interface';
import { EncryptionService } from '@/datasources/encryption/encryption.service';
import { EncryptionLocator } from '@/datasources/encryption/encryption-locator';
import type { ILoggingService } from '@/logging/logging.interface';
import { LoggingService } from '@/logging/logging.interface';

export enum EncryptionProvider {
  AWS = 'aws',
  LOCAL = 'local',
}

@Global()
@Module({})
export class EncryptionModule {
  static register(): DynamicModule {
    return {
      module: EncryptionModule,
      providers: [
        {
          provide: IEncryptionService,
          useFactory: async (
            configService: IConfigurationService,
            loggingService: ILoggingService,
          ): Promise<IEncryptionService> => {
            const provider = configService.getOrThrow<string>(
              'encryption.provider',
            );
            const currentVersion = configService.getOrThrow<number>(
              'encryption.currentVersion',
            );

            let service: IEncryptionService;

            switch (provider as EncryptionProvider) {
              case EncryptionProvider.AWS: {
                service = await EncryptionModule.createAwsService(
                  configService,
                  currentVersion,
                );
                loggingService.info(
                  `Encryption initialized with AWS KMS (version ${currentVersion})`,
                );
                break;
              }
              /** Hex keys from config, no KMS — for dev/testing or when KMS is unavailable. */
              case EncryptionProvider.LOCAL: {
                service = EncryptionModule.createLocalService(
                  configService,
                  currentVersion,
                );
                loggingService.info(
                  `Encryption initialized with local provider (version ${currentVersion})`,
                );
                break;
              }
              default:
                throw new Error(
                  `Unknown encryption provider: ${provider}. Use 'aws' or 'local'.`,
                );
            }

            EncryptionLocator.setService(service);
            return service;
          },
          inject: [IConfigurationService, LoggingService],
        },
      ],
      exports: [IEncryptionService],
    };
  }

  private static async createAwsService(
    configService: IConfigurationService,
    currentVersion: number,
  ): Promise<EncryptionService> {
    const kmsClient = new KMSClient({});
    const dekVersions = new Map<number, Buffer>();

    const dekV1Encrypted = configService.getOrThrow<string>(
      'encryption.dekV1Encrypted',
    );
    const hmacKeyEncrypted = configService.getOrThrow<string>(
      'encryption.hmacKeyEncrypted',
    );

    const [dekV1Result, hmacResult] = await Promise.all([
      kmsClient.send(
        new DecryptCommand({
          CiphertextBlob: Buffer.from(dekV1Encrypted, 'base64'),
        }),
      ),
      kmsClient.send(
        new DecryptCommand({
          CiphertextBlob: Buffer.from(hmacKeyEncrypted, 'base64'),
        }),
      ),
    ]);

    if (!dekV1Result.Plaintext || !hmacResult.Plaintext) {
      throw new Error(
        'KMS Decrypt returned empty plaintext for DEK or HMAC key',
      );
    }

    dekVersions.set(1, Buffer.from(dekV1Result.Plaintext));

    // Decrypt additional DEK versions if configured
    const dekV2Encrypted = configService.get<string>(
      'encryption.dekV2Encrypted',
    );
    if (dekV2Encrypted) {
      const dekV2Result = await kmsClient.send(
        new DecryptCommand({
          CiphertextBlob: Buffer.from(dekV2Encrypted, 'base64'),
        }),
      );
      if (!dekV2Result.Plaintext) {
        throw new Error('KMS Decrypt returned empty plaintext for DEK v2');
      }
      dekVersions.set(2, Buffer.from(dekV2Result.Plaintext));
    }

    return new EncryptionService(
      dekVersions,
      currentVersion,
      Buffer.from(hmacResult.Plaintext),
    );
  }

  private static createLocalService(
    configService: IConfigurationService,
    currentVersion: number,
  ): EncryptionService {
    const localKey = Buffer.from(
      configService.getOrThrow<string>('encryption.localKey'),
      'hex',
    );
    const hmacSecret = Buffer.from(
      configService.getOrThrow<string>('encryption.hmacSecret'),
      'hex',
    );

    const dekVersions = new Map<number, Buffer>();
    dekVersions.set(1, localKey);

    // Support a second local key for testing key rotation
    const localKeyV2 = configService.get<string>('encryption.localKeyV2');
    if (localKeyV2) {
      dekVersions.set(2, Buffer.from(localKeyV2, 'hex'));
    }

    return new EncryptionService(dekVersions, currentVersion, hmacSecret);
  }
}
