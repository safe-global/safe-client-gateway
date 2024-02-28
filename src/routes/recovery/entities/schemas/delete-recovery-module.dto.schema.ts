import { JSONSchemaType } from 'ajv';
import { DeleteRecoveryModuleDto } from '@/routes/recovery/entities/delete-recovery-module.dto.entity';

export const DELETE_RECOVERY_MODULE_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/recovery/delete-recovery-module.dto.json';

export const deleteRecoveryModuleDtoSchema: JSONSchemaType<DeleteRecoveryModuleDto> =
  {
    $id: DELETE_RECOVERY_MODULE_DTO_SCHEMA_ID,
    type: 'object',
    properties: {
      moduleAddress: { type: 'string' },
    },
    required: ['moduleAddress'],
  };
