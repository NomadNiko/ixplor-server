import { PartialType } from '@nestjs/swagger';
import { CreateStaffScheduleDto } from './create-staff-schedule.dto';

export class UpdateStaffScheduleDto extends PartialType(CreateStaffScheduleDto) {}