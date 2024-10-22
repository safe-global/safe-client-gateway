import { Outreach as DbOutreach } from '@/datasources/targeted-messaging/entities/outreach.entity';
import { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class OutreachDbMapper {
  map(outreach: DbOutreach): Outreach {
    return {
      id: outreach.id,
      name: outreach.name,
      startDate: this.parseDate(outreach.start_date),
      endDate: this.parseDate(outreach.end_date),
      sourceId: outreach.source_id,
      type: outreach.type,
      teamName: outreach.team_name,
      sourceFile: outreach.source_file,
      sourceFileProcessedDate: outreach.source_file_processed_date
        ? this.parseDate(outreach.source_file_processed_date)
        : null,
      sourceFileChecksum: outreach.source_file_checksum,
      created_at: this.parseDate(outreach.created_at),
      updated_at: this.parseDate(outreach.updated_at),
    };
  }

  private parseDate(date: Date | string): Date {
    return date instanceof Date ? date : new Date(date);
  }
}
