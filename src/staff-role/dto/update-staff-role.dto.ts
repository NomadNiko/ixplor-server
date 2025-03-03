import { PartialType } from '@nestjs/swagger';
import { CreateStaffRoleDto } from './create-staff-role.dto';

export class UpdateStaffRoleDto extends PartialType(CreateStaffRoleDto) {}