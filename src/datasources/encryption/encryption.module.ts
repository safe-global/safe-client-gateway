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

    const deksEncrypted = configService.getOrThrow<Record<string, string>>(
      'encryption.deksEncrypted',
    );
    const hmacKeyEncrypted = configService.getOrThrow<string>(
      'encryption.hmacKeyEncrypted',
    );

    const kmsDecrypt = async (ciphertext: string): Promise<Buffer> => {
      const { Plaintext } = await kmsClient.send(
        new DecryptCommand({
          CiphertextBlob: Buffer.from(ciphertext, 'base64'),
        }),
      );
      if (!Plaintext) {
        throw new Error('KMS Decrypt returned empty plaintext');
      }
      return Buffer.from(Plaintext);
    };

    const dekEntries = Object.entries(deksEncrypted);
    const [hmacKey, ...dekPlaintexts] = await Promise.all([
      kmsDecrypt(hmacKeyEncrypted),
      ...dekEntries.map(([, encrypted]) => kmsDecrypt(encrypted)),
    ]);

    return new EncryptionService(
      new Map(dekEntries.map(([v], i) => [Number(v), dekPlaintexts[i]])),
      currentVersion,
      hmacKey,
    );
  }

  private static createLocalService(
    configService: IConfigurationService,
    currentVersion: number,
  ): EncryptionService {
    const localKeys = configService.getOrThrow<Record<string, string>>(
      'encryption.localKeys',
    );
    const hmacSecret = Buffer.from(
      configService.getOrThrow<string>('encryption.hmacSecret'),
      'hex',
    );

    const dekVersions = new Map<number, Buffer>();
    for (const [version, hex] of Object.entries(localKeys)) {
      dekVersions.set(Number(version), Buffer.from(hex, 'hex'));
    }

    return new EncryptionService(dekVersions, currentVersion, hmacSecret);
  }
}
