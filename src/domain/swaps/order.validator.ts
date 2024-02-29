import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { Order } from '@/domain/swaps/entities/order.entity';
import {
  ORDER_SCHEMA_ID,
  orderSchema,
} from '@/domain/swaps/entities/schemas/order.schema';

@Injectable()
export class OrderValidator implements IValidator<Order> {
  private readonly isValidOrder: ValidateFunction<Order>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaValidator: JsonSchemaService,
  ) {
    this.isValidOrder = this.jsonSchemaValidator.getSchema(
      ORDER_SCHEMA_ID,
      orderSchema,
    );
  }

  validate(data: unknown): Order {
    return this.genericValidator.validate(this.isValidOrder, data);
  }
}
