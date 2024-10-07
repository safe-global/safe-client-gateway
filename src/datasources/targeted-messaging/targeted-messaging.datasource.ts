import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { CreateOutreachDto } from '@/domain/targeted-messaging/entities/create-outreach.dto.entity';
import { CreateTargetedSafesDto } from '@/domain/targeted-messaging/entities/create-targeted-safes.dto.entity';
import { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import { Submission } from '@/domain/targeted-messaging/entities/submission.entity';
import { TargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import {
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import postgres from 'postgres';

export class TargetedMessagingDatasource
  implements ITargetedMessagingDatasource
{
  constructor(
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async createOutreach(
    createOutreachDto: CreateOutreachDto,
  ): Promise<Outreach> {
    const [outreach] = await this.sql`
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
      startDate: outreach.start_date,
      endDate: outreach.end_date,
      created_at: outreach.created_at,
      updated_at: outreach.updated_at,
    };
  }

  async createTargetedSafes(
    createTargetedSafesDto: CreateTargetedSafesDto,
  ): Promise<Array<TargetedSafe>> {
    return await this.sql.begin(async (sql) => {
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

      const targetedSafes =
        await sql`SELECT * FROM targeted_safes WHERE id = ANY(${inserted.map((i) => i.id)})`;

      return targetedSafes.map((targetedSafe) => ({
        id: targetedSafe.id,
        outreachId: targetedSafe.outreach_id,
        address: targetedSafe.address,
        created_at: targetedSafe.created_at,
        updated_at: targetedSafe.updated_at,
      }));
    });
  }

  async getTargetedSafe(args: {
    outreachId: number;
    safeAddress: `0x${string}`;
  }): Promise<TargetedSafe> {
    const [targetedSafe] = await this.sql`
      SELECT * FROM targeted_safes
      WHERE outreach_id = ${args.outreachId} AND address = ${args.safeAddress}`;

    if (!targetedSafe) {
      throw new NotFoundException();
    }

    return {
      id: targetedSafe.id,
      address: targetedSafe.address,
      outreachId: targetedSafe.outreach_id,
      created_at: targetedSafe.created_at,
      updated_at: targetedSafe.updated_at,
    };
  }

  async createSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
  }): Promise<Submission> {
    const [submission] = await this.sql`
      INSERT INTO submissions (targeted_safe_id, signer_address, completion_date)
      VALUES (${args.targetedSafe.id}, ${args.signerAddress}, ${new Date()})
      RETURNING *`.catch((err) => {
      this.loggingService.warn(
        `Error creating submission: ${asError(err).message}`,
      );
      throw new UnprocessableEntityException('Error creating submission');
    });

    return {
      id: submission.id,
      outreachId: args.targetedSafe.outreachId,
      targetedSafeId: submission.targeted_safe_id,
      signerAddress: submission.signer_address,
      completionDate: submission.completion_date,
      created_at: submission.created_at,
      updated_at: submission.updated_at,
    };
  }

  async getSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
  }): Promise<Submission> {
    const [submission] = await this.sql`
      SELECT * FROM submissions
      WHERE targeted_safe_id = ${args.targetedSafe.id} AND signer_address = ${args.signerAddress}`;

    if (!submission) {
      throw new NotFoundException();
    }

    return {
      id: submission.id,
      outreachId: args.targetedSafe.outreachId,
      targetedSafeId: submission.targeted_safe_id,
      signerAddress: submission.signer_address,
      completionDate: submission.completion_date,
      created_at: submission.created_at,
      updated_at: submission.updated_at,
    };
  }
}
