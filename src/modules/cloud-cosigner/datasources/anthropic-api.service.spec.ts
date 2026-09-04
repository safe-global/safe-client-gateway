// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { AnthropicApi } from '@/modules/cloud-cosigner/datasources/anthropic-api.service';
import { reviewVerdictBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/review-verdict.builder';

const mockParse = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    public readonly options: unknown;
    public readonly messages = { parse: mockParse };
    constructor(options: unknown) {
      this.options = options;
      constructed.push(options);
    }
  },
}));

const constructed: Array<unknown> = [];

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

function response(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    model: 'claude-opus-5',
    stop_reason: 'end_turn',
    stop_details: null,
    usage: { input_tokens: 10, output_tokens: 5 },
    parsed_output: null,
    ...overrides,
  };
}

describe('AnthropicApi', () => {
  const apiKey = faker.string.alphanumeric(32);
  const model = 'claude-opus-5';
  const maxTokens = faker.number.int({ min: 1_000, max: 16_000 });
  const reviewTimeoutMs = faker.number.int({ min: 1_000, max: 300_000 });
  let api: AnthropicApi;

  beforeEach(() => {
    constructed.length = 0;
    const configurationService = new FakeConfigurationService();
    configurationService.set('cloudCosigner.reviewer.apiKey', apiKey);
    configurationService.set('cloudCosigner.reviewer.model', model);
    configurationService.set('cloudCosigner.reviewer.maxTokens', maxTokens);
    configurationService.set(
      'cloudCosigner.reviewer.reviewTimeoutMs',
      reviewTimeoutMs,
    );
    api = new AnthropicApi(configurationService, mockLoggingService);
  });

  it('should configure the client from configuration', () => {
    expect(constructed).toStrictEqual([
      { apiKey, timeout: reviewTimeoutMs, maxRetries: 1 },
    ]);
  });

  it('should request a structured verdict and return it', async () => {
    const verdict = reviewVerdictBuilder().build();
    mockParse.mockResolvedValue(response({ parsed_output: verdict }));
    const system = faker.lorem.sentence();
    const prompt = faker.lorem.paragraph();

    await expect(api.review({ system, prompt })).resolves.toStrictEqual({
      kind: 'verdict',
      verdict,
      model,
    });

    expect(mockParse).toHaveBeenCalledWith({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: {
        format: expect.objectContaining({ type: 'json_schema' }),
        effort: 'high',
      },
    });
  });

  it('should surface a refusal as its own outcome', async () => {
    mockParse.mockResolvedValue(
      response({
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber', explanation: '' },
      }),
    );

    await expect(
      api.review({ system: 'a', prompt: 'b' }),
    ).resolves.toStrictEqual({ kind: 'refusal', category: 'cyber', model });
  });

  it('should throw when no structured verdict came back', async () => {
    mockParse.mockResolvedValue(response({ stop_reason: 'max_tokens' }));

    await expect(api.review({ system: 'a', prompt: 'b' })).rejects.toThrow(
      'Review returned no structured verdict (stop reason: max_tokens)',
    );
  });

  it('should propagate API errors', async () => {
    mockParse.mockRejectedValue(new Error('rate limited'));

    await expect(api.review({ system: 'a', prompt: 'b' })).rejects.toThrow(
      'rate limited',
    );
  });
});
