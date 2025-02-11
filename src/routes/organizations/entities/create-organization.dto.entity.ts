import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z.string(),
});

export class CreateOrganizationDto
  implements z.infer<typeof CreateOrganizationSchema>
{
  @ApiProperty({ type: String })
  public readonly name!: Organization['name'];
}

export class CreateOrganizationResponse {
  @ApiProperty({ type: String })
  public readonly name!: Organization['name'];

  @ApiProperty({ type: Number })
  public readonly id!: Organization['id'];
}
