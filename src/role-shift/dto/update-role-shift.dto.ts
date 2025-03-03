import { PartialType } from '@nestjs/swagger';
import { CreateRoleShiftDto } from './create-role-shift.dto';

export class UpdateRoleShiftDto extends PartialType(CreateRoleShiftDto) {}