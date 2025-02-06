import { User } from '@/datasources/users/entities/users.entity.db';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { OrganizationStatus } from '@/domain/organizations/entities/organization.entity';
import { UserOrganizationStatus } from '@/domain/users/entities/user-organization.entity';
import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { UserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';
import { IOrganizationsRepository } from '@/domain/organizations/organizations.repository.interface';
import {
  FindOptionsWhere,
  FindOptionsSelect,
  FindOptionsRelations,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@Injectable()
export class OrganizationsRepository implements IOrganizationsRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async create(args: {
    userId: number;
    name: string;
    authPayload: AuthPayload;
    status: OrganizationStatus;
  }): Promise<Organization> {
    const organizationRepository =
      await this.postgresDatabaseService.getRepository(Organization);

    const user = new User();
    user.id = args.userId;

    const organization = new Organization();
    organization.status = args.status;

    // Many to many relationship with custom fields
    const userOrganization = new UserOrganization();
    userOrganization.name = args.name;
    userOrganization.status = UserOrganizationStatus.ACTIVE;
    userOrganization.user = user;
    userOrganization.organization = organization;

    organization.user_organizations = [userOrganization];

    return await organizationRepository.save(organization);
  }

  public async findOneOrFail(
    args: Parameters<OrganizationsRepository['findOne']>[0],
  ): Promise<Organization> {
    const organization = await this.findOne(args);

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    return organization;
  }

  public async findOne(args: {
    where:
      | Array<FindOptionsWhere<Organization>>
      | FindOptionsWhere<Organization>;
    select?: FindOptionsSelect<Organization>;
    relations?: FindOptionsRelations<Organization>;
  }): Promise<Organization | null> {
    const organizationRepository =
      await this.postgresDatabaseService.getRepository(Organization);

    return await organizationRepository.findOne(args);
  }

  public async findOrFail(
    args: Parameters<OrganizationsRepository['find']>[0],
  ): Promise<Array<Organization>> {
    const organizations = await this.find(args);

    if (organizations.length === 0) {
      throw new NotFoundException('Organizations not found.');
    }

    return organizations;
  }

  public async find(args: {
    where:
      | Array<FindOptionsWhere<Organization>>
      | FindOptionsWhere<Organization>;
    select?: FindOptionsSelect<Organization>;
    relations?: FindOptionsRelations<Organization>;
  }): Promise<Array<Organization>> {
    const organizationRepository =
      await this.postgresDatabaseService.getRepository(Organization);

    return await organizationRepository.find(args);
  }

  public async findByUserIdOrFail(
    args: Parameters<OrganizationsRepository['findByUserId']>[0],
  ): Promise<Array<Organization>> {
    const organization = await this.findByUserId(args);

    if (!organization) {
      throw new NotFoundException(
        'Organization not found. UserId = ' + args.userId,
      );
    }

    return organization;
  }

  public async findByUserId(args: {
    userId: number;
    select?: FindOptionsSelect<Organization>;
    relations?: FindOptionsRelations<Organization>;
  }): Promise<Array<Organization>> {
    const organizationRepository =
      await this.postgresDatabaseService.getRepository(Organization);

    return await organizationRepository.find({
      where: {
        user_organizations: { user: { id: args.userId } },
      },
    });
  }

  public async update(args: {
    id: Organization['id'];
    updatePayload: QueryDeepPartialEntity<Organization>;
  }): Promise<Pick<Organization, 'id'>> {
    const organizationRepository =
      await this.postgresDatabaseService.getRepository(Organization);

    const updateResult = await organizationRepository.update(
      args.id,
      args.updatePayload,
    );

    return updateResult.generatedMaps[0].id;
  }

  // @todo Add a soft delete method
  public async delete(args: {
    id: number;
    authPayload: AuthPayload;
  }): Promise<void> {
    const organizationRepository =
      await this.postgresDatabaseService.getRepository(Organization);

    const organization = await this.findOneOrFail({
      where: { id: args.id },
    });

    await organizationRepository.delete(organization.id);
  }
}
