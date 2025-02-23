import {
  approvedHashConfirmationBuilder,
  confirmationBuilder,
  contractSignatureConfirmationBuilder,
  eoaConfirmationBuilder,
  ethSignConfirmationBuilder,
} from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  ConfirmationSchema,
  MultisigTransactionPageSchema,
  MultisigTransactionSchema,
  _MultisigTransactionTypeSchema,
} from '@/domain/safe/entities/multisig-transaction.entity';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';
import { ZodError } from 'zod';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

describe('MultisigTransaction', () => {
  describe('ConfirmationSchema', () => {
    it('should validate a Confirmation', async () => {
      const confirmation = (await confirmationBuilder()).build();

      const result = ConfirmationSchema.safeParse(confirmation);

      expect(result.success).toBe(true);
    });

    it('should not validate and invalid Confirmation', () => {
      const confirmation = {
        invalid: 'confirmation',
      };

      const result = ConfirmationSchema.safeParse(confirmation);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['owner'],
          received: 'undefined',
        },
        {
          code: 'invalid_date',
          message: 'Invalid date',
          path: ['submissionDate'],
        },
        {
          code: 'invalid_type',
          expected:
            "'CONTRACT_SIGNATURE' | 'APPROVED_HASH' | 'EOA' | 'ETH_SIGN'",
          message: 'Required',
          path: ['signatureType'],
          received: 'undefined',
        },
      ]);
    });
  });

  describe('MultisigTransactionSchema', () => {
    it('should validate a MultisigTransaction', async () => {
      const multisigTransaction = (await multisigTransactionBuilder()).build();

      const result =
        await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

      expect(result.success).toBe(true);
    });

    it('should not validate duplicate signatures', async () => {
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
      }) as `0x${string}`;
      const confirmation = (await confirmationBuilder(safeTxHash)).build();
      const otherSigner = getAddress(faker.finance.ethereumAddress());
      const multisigTransaction = (await multisigTransactionBuilder())
        .with('safeTxHash', safeTxHash)
        .with('confirmations', [
          confirmation,
          { ...confirmation, owner: otherSigner },
        ])
        .build();

      const result =
        await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

      expect(!result.success && result.error.issues).toEqual([
        {
          code: 'custom',
          message: 'Duplicate signatures',
          path: [],
        },
      ]);
    });

    it('should not validate duplicate confirmation owners', async () => {
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
      }) as `0x${string}`;
      const confirmations = await Promise.all(
        Array.from({ length: 2 }, async () => {
          return (await confirmationBuilder(safeTxHash)).build();
        }),
      );
      const multisigTransaction = (await multisigTransactionBuilder())
        .with('safeTxHash', safeTxHash)
        .with('confirmations', [
          confirmations[0],
          {
            ...confirmations[1],
            owner: confirmations[0].owner,
          },
        ])
        .build();

      const result =
        await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

      expect(!result.success && result.error.issues).toEqual([
        {
          code: 'custom',
          message: 'Duplicate owners',
          path: [],
        },
      ]);
    });

    describe('confirmations', () => {
      it(`should validate ${SignatureType.ApprovedHash} confirmations`, async () => {
        const multisigTransaction = (await multisigTransactionBuilder())
          .with('confirmations', [approvedHashConfirmationBuilder().build()])
          .build();

        const result =
          await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

        expect(result.success).toBe(true);
      });

      it(`should validate ${SignatureType.ContractSignature} confirmations`, async () => {
        const multisigTransaction = (await multisigTransactionBuilder())
          .with('confirmations', [
            contractSignatureConfirmationBuilder().build(),
          ])
          .build();

        const result =
          await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

        expect(result.success).toBe(true);
      });

      describe(`should validate EOA confirmations`, () => {
        it('should validate a valid EOA confirmation', async () => {
          const safeTxHash = faker.string.hexadecimal({
            length: 64,
          }) as `0x${string}`;
          const multisigTransaction = (await multisigTransactionBuilder())
            .with('safeTxHash', safeTxHash)
            .with('confirmations', [
              (await eoaConfirmationBuilder(safeTxHash)).build(),
            ])
            .build();

          const result =
            await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

          expect(result.success).toBe(true);
        });

        it('should throw if the v value is not 27 or 28', async () => {
          const privateKey = generatePrivateKey();
          const signer = privateKeyToAccount(privateKey);
          const safeTxHash = faker.string.hexadecimal({
            length: 64,
          }) as `0x${string}`;
          const signature = await signer.signMessage({
            message: { raw: safeTxHash },
          });

          const rAndS = signature.slice(0, 130);
          const v = parseInt(signature.slice(-2), 16);

          // Adjust v for eth_sign
          // @see https://docs.safe.global/advanced/smart-account-signatures#eth_sign-signature
          const adjustedV = v + 4;
          const adjustedSignature = (rAndS +
            adjustedV.toString(16)) as `0x${string}`;

          const multisigTransaction = (await multisigTransactionBuilder())
            .with('safeTxHash', safeTxHash)
            .with('confirmations', [
              (await eoaConfirmationBuilder(safeTxHash))
                .with('owner', signer.address)
                .with('signature', adjustedSignature)
                .build(),
            ])
            .build();

          const result =
            await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

          expect(!result.success && result.error.issues).toStrictEqual([
            {
              code: 'custom',
              message: 'EOA signature must have v equal to 27 or 28',
              path: [],
            },
          ]);
        });

        it('should throw if the recovered address does not match the confirmation owner', async () => {
          const safeTxHash = faker.string.hexadecimal({
            length: 64,
          }) as `0x${string}`;
          const nonSigner = getAddress(faker.finance.ethereumAddress());
          const multisigTransaction = (await multisigTransactionBuilder())
            .with('safeTxHash', safeTxHash)
            .with('confirmations', [
              (await eoaConfirmationBuilder(safeTxHash))
                .with('owner', nonSigner)
                .build(),
            ])
            .build();

          const result =
            await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

          expect(!result.success && result.error.issues).toStrictEqual([
            {
              code: 'custom',
              message: 'Invalid EOA signature',
              path: [],
            },
          ]);
        });

        it('should throw if the address cannot be recovered', async () => {
          const safeTxHash = faker.string.hexadecimal({
            length: 64,
          }) as `0x${string}`;
          const invalidSignature = faker.string.hexadecimal() as `0x${string}`;
          const multisigTransaction = (await multisigTransactionBuilder())
            .with('safeTxHash', safeTxHash)
            .with('confirmations', [
              (await eoaConfirmationBuilder(safeTxHash))
                .with('signature', invalidSignature)
                .build(),
            ])
            .build();

          const result =
            await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

          expect(!result.success && result.error.issues).toStrictEqual([
            {
              code: 'custom',
              message: 'EOA signature must have v equal to 27 or 28',
              path: [],
            },
          ]);
        });
      });

      describe(`should validate ETH_SIGN confirmations`, () => {
        it('should validate a valid ETH_SIGN confirmation', async () => {
          const safeTxHash = faker.string.hexadecimal({
            length: 64,
          }) as `0x${string}`;
          const multisigTransaction = (await multisigTransactionBuilder())
            .with('safeTxHash', safeTxHash)
            .with('confirmations', [
              (await ethSignConfirmationBuilder(safeTxHash)).build(),
            ])
            .build();

          const result =
            await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

          expect(result.success).toBe(true);
        });

        it('should throw if the v value is not 31 or 32', async () => {
          const privateKey = generatePrivateKey();
          const signer = privateKeyToAccount(privateKey);
          const safeTxHash = faker.string.hexadecimal({
            length: 64,
          }) as `0x${string}`;
          const signature = await signer.signMessage({
            message: { raw: safeTxHash },
          });
          const multisigTransaction = (await multisigTransactionBuilder())
            .with('safeTxHash', safeTxHash)
            .with('confirmations', [
              (await ethSignConfirmationBuilder(safeTxHash))
                .with('owner', signer.address)
                .with('signature', signature)
                .build(),
            ])
            .build();

          const result =
            await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

          expect(!result.success && result.error.issues).toStrictEqual([
            {
              code: 'custom',
              message: 'ETH_SIGN signature must have v equal to 31 or 32',
              path: [],
            },
          ]);
        });

        it('should throw if the recovered address does not match the confirmation owner', async () => {
          const safeTxHash = faker.string.hexadecimal({
            length: 64,
          }) as `0x${string}`;
          const nonSigner = getAddress(faker.finance.ethereumAddress());
          const multisigTransaction = (await multisigTransactionBuilder())
            .with('safeTxHash', safeTxHash)
            .with('confirmations', [
              (await ethSignConfirmationBuilder(safeTxHash))
                .with('owner', nonSigner)
                .build(),
            ])
            .build();

          const result =
            await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

          expect(!result.success && result.error.issues).toStrictEqual([
            {
              code: 'custom',
              message: 'Invalid ETH_SIGN signature',
              path: [],
            },
          ]);
        });

        it('should throw if the address cannot be recovered', async () => {
          const safeTxHash = faker.string.hexadecimal({
            length: 64,
          }) as `0x${string}`;
          const invalidSignature = faker.string.hexadecimal() as `0x${string}`;
          const multisigTransaction = (await multisigTransactionBuilder())
            .with('safeTxHash', safeTxHash)
            .with('confirmations', [
              (await ethSignConfirmationBuilder(safeTxHash))
                .with('signature', invalidSignature)
                .build(),
            ])
            .build();

          const result =
            await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

          expect(!result.success && result.error.issues).toStrictEqual([
            expect.objectContaining({
              code: 'custom',
              message: expect.stringMatching(
                /ETH_SIGN signature must have v equal to 31 or 32|Could not recover ETH_SIGN address/,
              ),
              path: [],
            }),
          ]);
        });
      });

      it('should throw if the signature type is invalid', async () => {
        const multisigTransaction = (await multisigTransactionBuilder())
          .with('confirmations', [
            (await confirmationBuilder())
              .with('signatureType', 'unknown' as SignatureType)
              .build(),
          ])
          .build();

        const result =
          await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

        expect(!result.success && result.error.issues).toStrictEqual([
          {
            code: 'custom',
            message: 'Invalid signature type',
            path: [],
          },
        ]);
      });
    });

    it.each([
      'safe' as const,
      'to' as const,
      'value' as const,
      'operation' as const,
      'nonce' as const,
      'submissionDate' as const,
      'safeTxHash' as const,
      'isExecuted' as const,
      'confirmationsRequired' as const,
      'trusted' as const,
    ])('should require %s', async (key) => {
      const multisigTransaction = (await multisigTransactionBuilder()).build();
      delete multisigTransaction[key];

      const result =
        await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0].path).toStrictEqual([
        key,
      ]);
    });

    it.each([
      'safe' as const,
      'to' as const,
      'gasToken' as const,
      'proposer' as const,
      'proposedByDelegate' as const,
      'refundReceiver' as const,
      'executor' as const,
    ])('should checksum %s', async (key) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const multisigTransaction = (await multisigTransactionBuilder())
        .with(key, nonChecksummedAddress as `0x${string}`)
        .build();

      const result =
        await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

      expect(result.success && result.data[key]).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it.each([
      'value' as const,
      'gasPrice' as const,
      'ethGasPrice' as const,
      'fee' as const,
    ])('should require %s to be a numeric string', async (key) => {
      const multisigTransaction = (await multisigTransactionBuilder())
        .with(key, faker.string.alpha())
        .build();

      const result =
        await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: [key],
        },
      ]);
    });

    it.each([
      'data' as const,
      'transactionHash' as const,
      'safeTxHash' as const,
    ])('should require %s to be a hex string', async (key) => {
      const multisigTransaction = (await multisigTransactionBuilder())
        .with(key, faker.string.numeric() as `0x${string}`)
        .build();

      const result =
        await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: [key],
      });
    });

    it.each([
      'data' as const,
      'dataDecoded' as const,
      'gasToken' as const,
      'safeTxGas' as const,
      'baseGas' as const,
      'gasPrice' as const,
      'proposer' as const,
      'proposedByDelegate' as const,
      'refundReceiver' as const,
      'executionDate' as const,
      'modified' as const,
      'blockNumber' as const,
      'transactionHash' as const,
      'executor' as const,
      'isSuccessful' as const,
      'ethGasPrice' as const,
      'gasUsed' as const,
      'fee' as const,
      'origin' as const,
      'confirmations' as const,
      'signatures' as const,
    ])('should default %s to null', async (key) => {
      const multisigTransaction = (await multisigTransactionBuilder()).build();
      delete multisigTransaction[key];

      const result =
        await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

      expect(result.success && result.data[key]).toBe(null);
    });

    it('should require operation to be 0 or 1', async () => {
      const multisigTransaction = (await multisigTransactionBuilder())
        .with('operation', faker.number.int({ min: 2 }))
        .build();

      const result =
        await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_enum_value',
          message: `Invalid enum value. Expected 0 | 1, received '${multisigTransaction.operation}'`,
          options: [0, 1],
          path: ['operation'],
          received: multisigTransaction.operation,
        },
      ]);
    });

    it.each([
      'executionDate' as const,
      'submissionDate' as const,
      'modified' as const,
    ])('should coerce %s to be a Date', async (key) => {
      const date = faker.date.recent();
      const multisigTransaction = (await multisigTransactionBuilder())
        .with(key, date.toString() as unknown as Date)
        .build();

      const result =
        await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

      // zod coerces to nearest millisecond
      date.setMilliseconds(0);
      expect(result.success && result.data[key]).toStrictEqual(date);
    });

    it('should not validate an invalid MultisigTransaction', async () => {
      const multisigTransaction = {
        invalid: 'multisigTransaction',
      };

      const result =
        await MultisigTransactionSchema.safeParseAsync(multisigTransaction);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['safe'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['to'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['value'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: '0 | 1',
          message: 'Required',
          path: ['operation'],
          received: 'undefined',
        },
        {
          code: 'invalid_date',
          message: 'Invalid date',
          path: ['submissionDate'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['safeTxHash'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'boolean',
          message: 'Required',
          path: ['isExecuted'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Required',
          path: ['confirmationsRequired'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'boolean',
          message: 'Required',
          path: ['trusted'],
          received: 'undefined',
        },
        {
          code: 'invalid_union',
          message: 'Invalid input',
          path: ['nonce'],
          unionErrors: [
            new ZodError([
              {
                code: 'invalid_type',
                expected: 'number',
                received: 'undefined',
                path: ['nonce'],
                message: 'Required',
              },
            ]),
            new ZodError([
              {
                code: 'invalid_type',
                expected: 'string',
                received: 'undefined',
                path: ['nonce'],
                message: 'Required',
              },
            ]),
          ],
        },
      ]);
    });

    describe('MultisigTransactionTypeSchema', () => {
      it('should validate a MultisigTransactionType', async () => {
        const multisigTransactionType = {
          ...(await multisigTransactionBuilder()).build(),
          txType: 'MULTISIG_TRANSACTION',
        };

        const result = await _MultisigTransactionTypeSchema.safeParseAsync(
          multisigTransactionType,
        );

        expect(result.success).toBe(true);
      });

      it('should not validate an invalid MultisigTransactionType', async () => {
        const multisigTransactionType = {
          invalid: 'multisigTransactionType',
        };

        const result = await _MultisigTransactionTypeSchema.safeParseAsync(
          multisigTransactionType,
        );

        expect(!result.success && result.error.issues).toStrictEqual([
          {
            code: 'invalid_type',
            expected: 'string',
            message: 'Required',
            path: ['safe'],
            received: 'undefined',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            message: 'Required',
            path: ['to'],
            received: 'undefined',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            message: 'Required',
            path: ['value'],
            received: 'undefined',
          },
          {
            code: 'invalid_type',
            expected: '0 | 1',
            message: 'Required',
            path: ['operation'],
            received: 'undefined',
          },
          {
            code: 'invalid_date',
            message: 'Invalid date',
            path: ['submissionDate'],
          },
          {
            code: 'invalid_type',
            expected: 'string',
            message: 'Required',
            path: ['safeTxHash'],
            received: 'undefined',
          },
          {
            code: 'invalid_type',
            expected: 'boolean',
            message: 'Required',
            path: ['isExecuted'],
            received: 'undefined',
          },
          {
            code: 'invalid_type',
            expected: 'number',
            message: 'Required',
            path: ['confirmationsRequired'],
            received: 'undefined',
          },
          {
            code: 'invalid_type',
            expected: 'boolean',
            message: 'Required',
            path: ['trusted'],
            received: 'undefined',
          },
          {
            code: 'invalid_literal',
            expected: 'MULTISIG_TRANSACTION',
            message: 'Invalid literal value, expected "MULTISIG_TRANSACTION"',
            path: ['txType'],
            received: undefined,
          },
          {
            code: 'invalid_union',
            message: 'Invalid input',
            path: ['nonce'],
            unionErrors: [
              new ZodError([
                {
                  code: 'invalid_type',
                  expected: 'number',
                  received: 'undefined',
                  path: ['nonce'],
                  message: 'Required',
                },
              ]),
              new ZodError([
                {
                  code: 'invalid_type',
                  expected: 'string',
                  received: 'undefined',
                  path: ['nonce'],
                  message: 'Required',
                },
              ]),
            ],
          },
        ]);
      });
    });

    describe('MultisigTransactionPageSchema', () => {
      it('should validate a MultisigTransactionPage', async () => {
        const multisigTransactionType = {
          ...(await multisigTransactionBuilder()).build(),
          type: 'MULTISIG_TRANSACTION',
        };
        const multisigTransactionPage = pageBuilder()
          .with('count', 1)
          .with('results', [multisigTransactionType])
          .build();

        const result = await MultisigTransactionPageSchema.safeParseAsync(
          multisigTransactionPage,
        );

        expect(result.success).toBe(true);
      });

      it('should not validate an invalid MultisigTransactionPage', async () => {
        const multisigTransactionPage = {
          invalid: 'multisigTransactionPage',
        };

        const result = await MultisigTransactionPageSchema.safeParseAsync(
          multisigTransactionPage,
        );

        expect(!result.success && result.error.issues).toStrictEqual([
          {
            code: 'invalid_type',
            expected: 'number',
            message: 'Required',
            path: ['count'],
            received: 'undefined',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            message: 'Required',
            path: ['next'],
            received: 'undefined',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            message: 'Required',
            path: ['previous'],
            received: 'undefined',
          },
          {
            code: 'invalid_type',
            expected: 'array',
            message: 'Required',
            path: ['results'],
            received: 'undefined',
          },
        ]);
      });
    });
  });
});
