// SPDX-License-Identifier: FSL-1.1-MIT
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  type ReviewOutcome,
  ReviewVerdictSchema,
} from '@/modules/cloud-cosigner/domain/entities/review-verdict.entity';

/**
 * The one place the cosigner talks to the Claude API. The official SDK owns
 * the HTTP call (timeouts, retries, streaming), which is why this datasource
 * does not go through `INetworkService` like the REST clients do; it is the
 * same exception the Blockaid SDK client makes.
 */
@Injectable()
export class AnthropicApi {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.model = this.configurationService.getOrThrow<string>(
      'cloudCosigner.reviewer.model',
    );
    this.maxTokens = this.configurationService.getOrThrow<number>(
      'cloudCosigner.reviewer.maxTokens',
    );
    this.client = new Anthropic({
      apiKey: this.configurationService.getOrThrow<string>(
        'cloudCosigner.reviewer.apiKey',
      ),
      timeout: this.configurationService.getOrThrow<number>(
        'cloudCosigner.reviewer.reviewTimeoutMs',
      ),
      maxRetries: 1,
    });
  }

  /**
   * Runs one review. Thinking is left at the model's adaptive default; the
   * verdict comes back as a strict structured output. A safety refusal is
   * reported as its own outcome so the caller can withhold the signature
   * instead of failing the job and retrying a request that will refuse again.
   */
  public async review(args: {
    system: string;
    prompt: string;
  }): Promise<ReviewOutcome> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: this.maxTokens,
      system: args.system,
      messages: [{ role: 'user', content: args.prompt }],
      output_config: {
        format: zodOutputFormat(ReviewVerdictSchema),
        effort: 'high',
      },
    });

    this.loggingService.debug({
      type: 'CLOUD_COSIGNER_REVIEW_USAGE',
      model: response.model,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    if (response.stop_reason === 'refusal') {
      return {
        kind: 'refusal',
        category: response.stop_details?.category ?? null,
        model: response.model,
      };
    }
    if (!response.parsed_output) {
      throw new Error(
        `Review returned no structured verdict (stop reason: ${response.stop_reason})`,
      );
    }
    return {
      kind: 'verdict',
      verdict: response.parsed_output,
      model: response.model,
    };
  }
}
