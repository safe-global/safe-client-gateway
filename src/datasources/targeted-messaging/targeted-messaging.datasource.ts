import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CachedQueryResolver } from '@/datasources/db/cached-query-resolver';
import { ICachedQueryResolver } from '@/datasources/db/cached-query-resolver.interface';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { CreateOutreachDto } from '@/domain/targeted-messaging/entities/create-outreach.dto.entity';
import { CreateTargetedSafesDto } from '@/domain/targeted-messaging/entities/create-targeted-safes.dto.entity';
import { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import { Submission } from '@/domain/targeted-messaging/entities/submission.entity';
import { TargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';
import { TargetedSafe as DbTargetedSafe } from '@/datasources/targeted-messaging/entities/targeted-safe.entity';
import { Submission as DbSubmission } from '@/datasources/targeted-messaging/entities/submission.entity';
import { Outreach as DbOutreach } from '@/datasources/targeted-messaging/entities/outreach.entity';
import { SubmissionNotFoundError } from '@/domain/targeted-messaging/errors/submission-not-found.error';
import { TargetedSafeNotFoundError } from '@/domain/targeted-messaging/errors/targeted-safe-not-found.error';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { Inject, UnprocessableEntityException } from '@nestjs/common';
import postgres from 'postgres';

export class TargetedMessagingDatasource
  implements ITargetedMessagingDatasource
{
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(ICachedQueryResolver)
    private readonly cachedQueryResolver: CachedQueryResolver,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
  }

  async createOutreach(
    createOutreachDto: CreateOutreachDto,
  ): Promise<Outreach> {
    const [outreach] = await this.sql<DbOutreach[]>`
      INSERT INTO outreaches (name, start_date, end_date)
      VALUES (${createOutreachDto.name}, ${createOutreachDto.startDate}, ${createOutreachDto.endDate})
      RETURNING *`.catch((err) => {
      this.loggingService.warn(
        `Error creating outreach: ${asError(err).message}`,
      );
      throw new UnprocessableEntityException('Error creating outreach');
    });

    return {
      id: outreach.id,
      name: outreach.name,
      startDate: new Date(outreach.start_date),
      endDate: new Date(outreach.end_date),
      created_at: new Date(outreach.created_at),
      updated_at: new Date(outreach.updated_at),
    };
  }

  async createTargetedSafes(
    createTargetedSafesDto: CreateTargetedSafesDto,
  ): Promise<Array<TargetedSafe>> {
    const targetedSafes = await this.sql.begin(async (sql) => {
      const inserted = await sql<[{ id: number }]>`
        INSERT INTO targeted_safes
        ${sql(
          createTargetedSafesDto.addresses.map((address) => ({
            outreach_id: createTargetedSafesDto.outreachId,
            address,
          })),
        )}
        RETURNING id`.catch((err) => {
        this.loggingService.warn(
          `Error adding targeted Safes: ${asError(err).message}`,
        );
        throw new UnprocessableEntityException('Error adding targeted Safes');
      });

      const targetedSafes = await sql<
        DbTargetedSafe[]
      >`SELECT * FROM targeted_safes WHERE id = ANY(${inserted.map((i) => i.id)})`;

      return targetedSafes.map((targetedSafe) => ({
        id: targetedSafe.id,
        outreachId: targetedSafe.outreach_id,
        address: targetedSafe.address,
        created_at: new Date(targetedSafe.created_at),
        updated_at: new Date(targetedSafe.updated_at),
      }));
    });

    await this.cacheService.deleteByKey(
      CacheRouter.getTargetedSafeCacheKey(createTargetedSafesDto.outreachId),
    );

    return targetedSafes;
  }

  async getTargetedSafe(args: {
    outreachId: number;
    safeAddress: `0x${string}`;
  }): Promise<TargetedSafe> {
    const [targetedSafe] = await this.cachedQueryResolver.get<DbTargetedSafe[]>(
      {
        cacheDir: CacheRouter.getTargetedSafeCacheDir(args),
        query: this.sql`
        SELECT * FROM targeted_safes
        WHERE outreach_id = ${args.outreachId} AND address = ${args.safeAddress}`,
        ttl: this.defaultExpirationTimeInSeconds,
      },
    );

    if (!targetedSafe) {
      throw new TargetedSafeNotFoundError();
    }

    return {
      id: targetedSafe.id,
      address: targetedSafe.address,
      outreachId: targetedSafe.outreach_id,
      created_at: new Date(targetedSafe.created_at),
      updated_at: new Date(targetedSafe.updated_at),
    };
  }

  async createSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
  }): Promise<Submission> {
    const [submission] = await this.sql<DbSubmission[]>`
      INSERT INTO submissions (targeted_safe_id, signer_address, completion_date)
      VALUES (${args.targetedSafe.id}, ${args.signerAddress}, ${new Date()})
      RETURNING *`.catch((err) => {
      this.loggingService.warn(
        `Error creating submission: ${asError(err).message}`,
      );
      throw new UnprocessableEntityException('Error creating submission');
    });
    await this.cacheService.deleteByKey(
      CacheRouter.getSubmissionCacheKey(args.targetedSafe.outreachId),
    );

    return {
      id: submission.id,
      outreachId: args.targetedSafe.outreachId,
      targetedSafeId: submission.targeted_safe_id,
      signerAddress: submission.signer_address,
      completionDate: new Date(submission.completion_date),
      created_at: new Date(submission.created_at),
      updated_at: new Date(submission.updated_at),
    };
  }

  async getSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
  }): Promise<Submission> {
    const [submission] = await this.cachedQueryResolver.get<DbSubmission[]>({
      cacheDir: CacheRouter.getSubmissionCacheDir({
        outreachId: args.targetedSafe.outreachId,
        safeAddress: args.targetedSafe.address,
        signerAddress: args.signerAddress,
      }),
      query: this.sql`
        SELECT * FROM submissions
        WHERE targeted_safe_id = ${args.targetedSafe.id} AND signer_address = ${args.signerAddress}`,
      ttl: this.defaultExpirationTimeInSeconds,
    });

    if (!submission) {
      throw new SubmissionNotFoundError();
    }

    return {
      id: submission.id,
      outreachId: args.targetedSafe.outreachId,
      targetedSafeId: args.targetedSafe.id,
      signerAddress: args.signerAddress,
      completionDate: new Date(submission.completion_date),
      created_at: new Date(submission.created_at),
      updated_at: new Date(submission.updated_at),
    };
  }
}
