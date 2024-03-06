import { Page } from '@/domain/entities/page.entity';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { Rank } from '@/domain/locking/entities/rank.entity';
import {
  RANK_PAGE_SCHEMA_ID,
  RANK_SCHEMA_ID,
  rankPageSchema,
  rankSchema,
} from '@/domain/locking/entities/schemas/rank.schema';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';

@Injectable()
export class RankValidator implements IValidator<Rank> {
  private readonly isValidRank: ValidateFunction<Rank>;
  private readonly isValidPage: ValidateFunction<Page<Rank>>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidRank = this.jsonSchemaService.getSchema(
      RANK_SCHEMA_ID,
      rankSchema,
    );

    this.isValidPage = this.jsonSchemaService.getSchema(
      RANK_PAGE_SCHEMA_ID,
      rankPageSchema,
    );
  }

  validate(data: unknown): Rank {
    return this.genericValidator.validate(this.isValidRank, data);
  }

  validatePage(data: unknown): Page<Rank> {
    return this.genericValidator.validate(this.isValidPage, data);
  }
}
