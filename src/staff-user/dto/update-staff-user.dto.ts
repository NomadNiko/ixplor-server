import { PartialType } from '@nestjs/swagger';
import { CreateStaffUserDto } from './create-staff-user.dto';

export class UpdateStaffUserDto extends PartialType(CreateStaffUserDto) {}