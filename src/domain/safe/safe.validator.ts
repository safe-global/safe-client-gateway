import { Injectable } from "@nestjs/common";
import { DefinedError, ValidateFunction } from "ajv";
import { IValidator } from "../interfaces/validator.interface";
import { JsonSchemaService } from "../schema/json-schema.service";
import { ValidationErrorFactory } from "../schema/validation-error-factory";
import { Safe } from "./entities/safe.entity";

@Injectable()
export class SafeValidator implements IValidator<Safe> {
  private readonly isValidSafe: ValidateFunction<Safe>;
  
   constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
   ) {}

   validate(data: unknown): Safe {
    if (!this.isValidSafe(data)) {
      const errors = this.isValidSafe.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as Safe;
   }
}