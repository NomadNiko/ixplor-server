import { Injectable } from '@nestjs/common';
import { StaffUserQueryService } from './services/staff-user-query.service';
import { StaffUserManagementService } from './services/staff-user-management.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import { AddShiftDto } from './dto/add-shift.dto';
import { AddQualificationDto } from './dto/add-qualification.dto';
import { StaffUserStatusEnum } from './infrastructure/persistence/document/entities/staff-user.schema';

@Injectable()
export class StaffUserService {
  constructor(
    private readonly queryService: StaffUserQueryService,
    private readonly managementService: StaffUserManagementService,
  ) {}

  // Query Methods
  findById = this.queryService.findById.bind(this.queryService);
  findByVendor = this.queryService.findByVendor.bind(this.queryService);
  findActiveByVendor = this.queryService.findActiveByVendor.bind(this.queryService);
  findQualifiedForBookingItem = this.queryService.findQualifiedForBookingItem.bind(this.queryService);
  getStaffWorkload = this.queryService.getStaffWorkload.bind(this.queryService);
  getAvailableStaff = this.queryService.getAvailableStaff.bind(this.queryService);
  findStaffWithBooking = this.queryService.findStaffWithBooking.bind(this.queryService);

  // Management Methods
  create = this.managementService.create.bind(this.managementService);
  update = this.managementService.update.bind(this.managementService);
  updateStatus = this.managementService.updateStatus.bind(this.managementService);
  remove = this.managementService.remove.bind(this.managementService);
  addShift = this.managementService.addShift.bind(this.managementService);
  removeShift = this.managementService.removeShift.bind(this.managementService);
  addQualification = this.managementService.addQualification.bind(this.managementService);
  removeQualification = this.managementService.removeQualification.bind(this.managementService);
  addBooking = this.managementService.addBooking.bind(this.managementService);
  updateBookingStatus = this.managementService.updateBookingStatus.bind(this.managementService);
  findBestAvailableStaff = this.managementService.findBestAvailableStaff.bind(this.managementService);
  reassignBooking = this.managementService.reassignBooking.bind(this.managementService);
}