// SPDX-License-Identifier: FSL-1.1-MIT
import { DynamicModule, Global, Module } from '@nestjs/common';
import { DecryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IFieldEncryptionService } from '@/datasources/encryption/encryption.service.interface';
import { FieldEncryptionService } from '@/datasources/encryption/field-encryption.service';
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
          provide: IFieldEncryptionService,
          useFactory: async (
            configService: IConfigurationService,
            loggingService: ILoggingService,
          ): Promise<IFieldEncryptionService> => {
            const provider = configService.getOrThrow<string>(
              'encryption.provider',
            );

            let service: IFieldEncryptionService;

            switch (provider as EncryptionProvider) {
              case EncryptionProvider.AWS: {
                const kmsClient = new KMSClient({});

                const dekEncrypted = configService.getOrThrow<string>(
                  'encryption.dekV1Encrypted',
                );
                const hmacKeyEncrypted = configService.getOrThrow<string>(
                  'encryption.hmacKeyEncrypted',
                );

                const [dekResult, hmacResult] = await Promise.all([
                  kmsClient.send(
                    new DecryptCommand({
                      CiphertextBlob: Buffer.from(dekEncrypted, 'base64'),
                    }),
                  ),
                  kmsClient.send(
                    new DecryptCommand({
                      CiphertextBlob: Buffer.from(hmacKeyEncrypted, 'base64'),
                    }),
                  ),
                ]);

                if (!dekResult.Plaintext || !hmacResult.Plaintext) {
                  throw new Error(
                    'KMS Decrypt returned empty plaintext for DEK or HMAC key',
                  );
                }

                service = new FieldEncryptionService(
                  Buffer.from(dekResult.Plaintext),
                  Buffer.from(hmacResult.Plaintext),
                );

                loggingService.info('Encryption initialized with AWS KMS');
                break;
              }
              case EncryptionProvider.LOCAL: {
                const localKey = Buffer.from(
                  configService.getOrThrow<string>('encryption.localKey'),
                  'hex',
                );
                const hmacSecret = Buffer.from(
                  configService.getOrThrow<string>('encryption.hmacSecret'),
                  'hex',
                );

                service = new FieldEncryptionService(localKey, hmacSecret);

                loggingService.info(
                  'Encryption initialized with local provider',
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
      exports: [IFieldEncryptionService],
    };
  }
}
