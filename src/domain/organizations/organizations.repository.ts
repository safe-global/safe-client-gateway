import { Injectable } from '@nestjs/common';
import { IOrganizationsRepository } from '@/domain/organizations/organizations.repository.interface';

@Injectable()
export class OrganizationsRepository implements IOrganizationsRepository {}
