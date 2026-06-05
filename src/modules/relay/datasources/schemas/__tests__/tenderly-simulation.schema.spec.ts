// SPDX-License-Identifier: FSL-1.1-MIT
import { TenderlySimulationResponseSchema } from '@/modules/relay/datasources/schemas/tenderly-simulation.schema';

describe('TenderlySimulationResponseSchema', () => {
  it('parses a minimal successful response with no transaction_info', () => {
    const parsed = TenderlySimulationResponseSchema.parse({
      transaction: { status: true },
    });

    expect(parsed.transaction.status).toBe(true);
    expect(parsed.transaction.transaction_info).toBeUndefined();
  });

  it('parses a failed response with an error_message', () => {
    const parsed = TenderlySimulationResponseSchema.parse({
      transaction: {
        status: false,
        error_message: "Reverted with reason string: 'GS013'",
      },
    });

    expect(parsed.transaction.status).toBe(false);
    expect(parsed.transaction.error_message).toBe(
      "Reverted with reason string: 'GS013'",
    );
  });

  it('parses transaction_info with explicit null logs', () => {
    const parsed = TenderlySimulationResponseSchema.parse({
      transaction: {
        status: true,
        transaction_info: { logs: null },
      },
    });

    expect(parsed.transaction.transaction_info?.logs).toBeNull();
  });

  it('parses log entries that are missing the `raw` field', () => {
    const parsed = TenderlySimulationResponseSchema.parse({
      transaction: {
        status: true,
        transaction_info: { logs: [{}, {}] },
      },
    });

    expect(parsed.transaction.transaction_info?.logs).toEqual([{}, {}]);
  });

  it('preserves the original casing of log topics', () => {
    const upper =
      '0xABCDEF0000000000000000000000000000000000000000000000000000000000';
    const lower =
      '0x123456abcdef00000000000000000000000000000000000000000000abcdef00';

    const parsed = TenderlySimulationResponseSchema.parse({
      transaction: {
        status: true,
        transaction_info: {
          logs: [{ raw: { topics: [upper, lower] } }],
        },
      },
    });

    const topics = parsed.transaction.transaction_info?.logs?.[0].raw?.topics;
    expect(topics).toEqual([upper, lower]);
  });

  it('defaults missing topics array to an empty array', () => {
    const parsed = TenderlySimulationResponseSchema.parse({
      transaction: {
        status: true,
        transaction_info: { logs: [{ raw: {} }] },
      },
    });

    expect(parsed.transaction.transaction_info?.logs?.[0].raw?.topics).toEqual(
      [],
    );
  });

  it('rejects a response missing the required `transaction.status` field', () => {
    expect(() =>
      TenderlySimulationResponseSchema.parse({
        transaction: {},
      }),
    ).toThrow();
  });

  it('rejects a response without a transaction object', () => {
    expect(() =>
      TenderlySimulationResponseSchema.parse({ status: true }),
    ).toThrow();
  });
});
