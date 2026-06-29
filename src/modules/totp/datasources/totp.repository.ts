// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { UserTotp } from '@/modules/totp/datasources/entities/user-totp.entity.db';

@Injectable()
export class TotpRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async getSecret(userId: number): Promise<string | null> {
    const repository =
      await this.postgresDatabaseService.getRepository(UserTotp);
    const row = await repository.findOne({ where: { userId } });
    return row?.secret ?? null;
  }

  /**
   * Inserts a secret for a user. The primary key on `user_id` makes this
   * reject (409) if the user already has one, so a session alone can never
   * overwrite an existing secret. Rotation must explicitly delete first.
   */
  public async insertSecret(userId: number, secret: string): Promise<void> {
    const repository =
      await this.postgresDatabaseService.getRepository(UserTotp);
    try {
      await repository.insert({ userId, secret });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new UniqueConstraintError('TOTP is already set up');
      }
      throw err;
    }
  }
}
