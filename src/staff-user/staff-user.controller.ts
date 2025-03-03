import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StaffUserService } from './staff-user.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import { AddShiftDto } from './dto/add-shift.dto';
import { AddQualificationDto } from './dto/add-qualification.dto';
import { StaffUserResponseDto } from './dto/staff-user-response.dto';
import { StaffWorkloadDto } from './dto/staff-workload.dto';
import { VendorService } from '../vendors/vendor.service';

@ApiTags('Staff Users')
@Controller('staff-users')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class StaffUserController {
  constructor(
    private readonly staffUserService: StaffUserService,
    private readonly vendorService: VendorService,
  ) {}

  @Post()
  @Roles(RoleEnum.vendor, RoleEnum.admin)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create a new staff user' })
  @ApiResponse({ status: 201, type: StaffUserResponseDto })
  async create(@Body() createStaffUserDto: CreateStaffUserDto, @Request() req) {
    const hasAccess = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      createStaffUserDto.vendorId,
    );
    if (!hasAccess && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException(
        'Not authorized to create staff for this vendor',
      );
    }
    return this.staffUserService.create(createStaffUserDto);
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get all staff users for a vendor' })
  @ApiResponse({ status: 200, type: [StaffUserResponseDto] })
  async findByVendor(@Param('vendorId') vendorId: string, @Request() req) {
    const hasAccess = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      vendorId,
    );
    if (!hasAccess && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException(
        'Not authorized to view staff for this vendor',
      );
    }
    return this.staffUserService.findByVendor(vendorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get staff user by ID' })
  @ApiResponse({ status: 200, type: StaffUserResponseDto })
  async findById(@Param('id') id: string) {
    return await this.staffUserService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update staff user' })
  @ApiResponse({ status: 200, type: StaffUserResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateStaffUserDto: UpdateStaffUserDto,
    @Request() req,
  ) {
    const staffUser = await this.staffUserService.findById(id);
    const hasAccess = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      staffUser.data.vendorId,
    );
    if (!hasAccess && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException(
        'Not authorized to update this staff user',
      );
    }
    return this.staffUserService.update(id, updateStaffUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete staff user' })
  async remove(@Param('id') id: string, @Request() req) {
    const staffUser = await this.staffUserService.findById(id);
    const hasAccess = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      staffUser.data.vendorId,
    );
    if (!hasAccess && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException(
        'Not authorized to delete this staff user',
      );
    }
    return this.staffUserService.remove(id);
  }

  @Post(':id/shifts')
  @ApiOperation({ summary: 'Add shift to staff user' })
  @ApiResponse({ status: 201, type: StaffUserResponseDto })
  async addShift(
    @Param('id') id: string,
    @Body() shiftData: AddShiftDto,
    @Request() req,
  ) {
    const staffUser = await this.staffUserService.findById(id);
    const hasAccess = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      staffUser.data.vendorId,
    );
    if (!hasAccess && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException(
        'Not authorized to modify this staff user',
      );
    }
    return this.staffUserService.addShift(id, shiftData);
  }

  @Delete(':id/shifts/:shiftId')
  @ApiOperation({ summary: 'Remove shift from staff user' })
  async removeShift(
    @Param('id') id: string,
    @Param('shiftId') shiftId: string,
    @Request() req,
  ) {
    const staffUser = await this.staffUserService.findById(id);
    const hasAccess = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      staffUser.data.vendorId,
    );
    if (!hasAccess && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException(
        'Not authorized to modify this staff user',
      );
    }
    return this.staffUserService.removeShift(id, shiftId);
  }

  @Post(':id/qualifications')
  @ApiOperation({ summary: 'Add qualification to staff user' })
  @ApiResponse({ status: 201, type: StaffUserResponseDto })
  async addQualification(
    @Param('id') id: string,
    @Body() qualificationData: AddQualificationDto,
    @Request() req,
  ) {
    const staffUser = await this.staffUserService.findById(id);
    const hasAccess = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      staffUser.data.vendorId,
    );
    if (!hasAccess && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException(
        'Not authorized to modify this staff user',
      );
    }
    return this.staffUserService.addQualification(id, qualificationData);
  }

  @Get(':id/workload')
  @ApiOperation({ summary: 'Get staff workload for a specific date' })
  @ApiResponse({ status: 200, type: StaffWorkloadDto })
  async getWorkload(
    @Param('id') id: string,
    @Query('date') dateString: string,
    @Request() req,
  ) {
    const staffUser = await this.staffUserService.findById(id);
    const hasAccess = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      staffUser.data.vendorId,
    );
    if (!hasAccess && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException(
        "Not authorized to view this staff user's workload",
      );
    }
    const date = dateString ? new Date(dateString) : new Date();
    return this.staffUserService.getStaffWorkload(id, date);
  }

  @Get('available/:bookingItemId')
  @ApiOperation({ summary: 'Get available staff for a booking item' })
  @ApiResponse({ status: 200, type: [StaffUserResponseDto] })
  async getAvailableStaff(
    @Param('bookingItemId') bookingItemId: string,
    @Query('startDateTime') startDateTime: string,
    @Query('duration') duration: number,
  ) {
    return await this.staffUserService.getAvailableStaff(
      bookingItemId,
      new Date(startDateTime),
      duration,
    );
  }

  @Post(':id/shifts/bulk')
@ApiOperation({ summary: 'Create multiple shifts for staff user' })
@ApiResponse({ status: 201, description: 'Shifts created successfully' })
async createBulkShifts(
  @Param('id') id: string,
  @Body() shifts: Array<{ startDateTime: Date; endDateTime: Date }>,
  @Request() req
) {
  const staffUser = await this.staffUserService.findById(id);
  const hasAccess = await this.vendorService.isUserAssociatedWithVendor(
    req.user.id,
    staffUser.data.vendorId,
  );
  if (!hasAccess && req.user.role?.id !== RoleEnum.admin) {
    throw new UnauthorizedException(
      'Not authorized to modify this staff user'
    );
  }
  return this.staffUserService.createBulkShifts(id, shifts);
}

@Delete(':id/shifts/bulk')
@ApiOperation({ summary: 'Delete multiple shifts from staff user' })
@ApiResponse({ status: 200, description: 'Shifts deleted successfully' })
async deleteBulkShifts(
  @Param('id') id: string,
  @Body() shiftIds: string[],
  @Request() req
) {
  const staffUser = await this.staffUserService.findById(id);
  const hasAccess = await this.vendorService.isUserAssociatedWithVendor(
    req.user.id,
    staffUser.data.vendorId,
  );
  if (!hasAccess && req.user.role?.id !== RoleEnum.admin) {
    throw new UnauthorizedException(
      'Not authorized to modify this staff user'
    );
  }
  return this.staffUserService.deleteBulkShifts(id, shiftIds);
}

@Put(':id/shifts/bulk')
@ApiOperation({ summary: 'Update multiple shifts for staff user' })
@ApiResponse({ status: 200, description: 'Shifts updated successfully' })
async updateBulkShifts(
  @Param('id') id: string,
  @Body() updates: Array<{ 
    shiftId: string; 
    startDateTime?: Date; 
    endDateTime?: Date;
  }>,
  @Request() req
) {
  const staffUser = await this.staffUserService.findById(id);
  const hasAccess = await this.vendorService.isUserAssociatedWithVendor(
    req.user.id,
    staffUser.data.vendorId,
  );
  if (!hasAccess && req.user.role?.id !== RoleEnum.admin) {
    throw new UnauthorizedException(
      'Not authorized to modify this staff user'
    );
  }
  return this.staffUserService.updateBulkShifts(id, updates);
}
}
