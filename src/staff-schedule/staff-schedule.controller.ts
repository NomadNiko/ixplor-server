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
    BadRequestException
  } from '@nestjs/common';
  import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
  import { AuthGuard } from '@nestjs/passport';
  import { RolesGuard } from '../roles/roles.guard';
  import { Roles } from '../roles/roles.decorator';
  import { RoleEnum } from '../roles/roles.enum';
  import { StaffScheduleService } from './staff-schedule.service';
  import { CreateStaffScheduleDto } from './dto/create-staff-schedule.dto';
  import { UpdateStaffScheduleDto } from './dto/update-staff-schedule.dto';
  import { StaffScheduleStatusEnum } from './infrastructure/persistence/document/entities/staff-schedule.schema';
  import { VendorService } from '../vendors/vendor.service';
  
  @ApiTags('Staff Schedules')
  @Controller('staff-schedules')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  export class StaffScheduleController {
    constructor(
      private readonly staffScheduleService: StaffScheduleService,
      private readonly vendorService: VendorService,
    ) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new staff schedule' })
    @ApiResponse({ status: 201, description: 'The staff schedule has been successfully created.' })
    async create(@Body() createStaffScheduleDto: CreateStaffScheduleDto, @Request() req) {
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        createStaffScheduleDto.vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to create schedules for this vendor');
      }
      
      return this.staffScheduleService.create(createStaffScheduleDto);
    }
  
    @Get()
    @Roles(RoleEnum.admin)
    @UseGuards(RolesGuard)
    @ApiOperation({ summary: 'Get all staff schedules (admin only)' })
    @ApiResponse({ status: 200, description: 'Returns all staff schedules.' })
    async findAll() {
      // Fix: Use an empty string or undefined instead of null
      const vendorSchedules = await this.staffScheduleService.findByVendor('');
      return vendorSchedules;
    }
    
    @Get('vendor/:vendorId')
    @ApiOperation({ summary: 'Get all schedules for a vendor' })
    @ApiResponse({ status: 200, description: 'Returns all schedules for the vendor.' })
    @ApiQuery({ name: 'date', required: false, type: Date })
    @ApiQuery({ name: 'status', required: false, enum: StaffScheduleStatusEnum })
    async findByVendor(
      @Param('vendorId') vendorId: string,
      @Request() req,
      @Query('date') dateString?: string,
      @Query('status') status?: StaffScheduleStatusEnum,
    ) {
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to view schedules for this vendor');
      }
      
      const date = dateString ? new Date(dateString) : undefined;
      
      return this.staffScheduleService.findByVendor(vendorId, date, status);
    }
  
    @Get('staff/:staffId')
    @ApiOperation({ summary: 'Get all schedules for a staff member' })
    @ApiResponse({ status: 200, description: 'Returns all schedules for the staff member.' })
    @ApiQuery({ name: 'startDate', required: false, type: Date })
    @ApiQuery({ name: 'endDate', required: false, type: Date })
    async findByStaff(
        @Param('staffId') staffId: string,
        @Request() req,
      @Query('startDate') startDateString?: string,
      @Query('endDate') endDateString?: string,
    ) {
      // Allow staff to see their own schedules
      if (req.user.id !== staffId) {
        const staffVendor = await this.staffScheduleService.findByStaff(staffId);
        if (staffVendor.data.length > 0) {
          const vendorId = staffVendor.data[0].vendorId;
          const authorized = await this.vendorService.isUserAssociatedWithVendor(
            req.user.id,
            vendorId
          );
          
          if (!authorized && req.user.role?.id !== RoleEnum.admin) {
            throw new UnauthorizedException('Not authorized to view schedules for this staff member');
          }
        }
      }
      
      const startDate = startDateString ? new Date(startDateString) : undefined;
      const endDate = endDateString ? new Date(endDateString) : undefined;
      
      return this.staffScheduleService.findByStaff(staffId, startDate, endDate);
    }
  
    @Get('role/:roleId')
    @ApiOperation({ summary: 'Get all schedules for a role' })
    @ApiResponse({ status: 200, description: 'Returns all schedules for the role.' })
    @ApiQuery({ name: 'startDate', required: false, type: Date })
    @ApiQuery({ name: 'endDate', required: false, type: Date })
    async findByRole(
      @Param('roleId') roleId: string,
      @Request() req,
      @Query('startDate') startDateString?: string,
      @Query('endDate') endDateString?: string,
    ) {
      // Need to get vendor ID from role to check authorization
      const roleSchedules = await this.staffScheduleService.findByRole(roleId);
      
      if (roleSchedules.data.length > 0) {
        const vendorId = roleSchedules.data[0].vendorId;
        const authorized = await this.vendorService.isUserAssociatedWithVendor(
          req.user.id,
          vendorId
        );
        
        if (!authorized && req.user.role?.id !== RoleEnum.admin) {
          throw new UnauthorizedException('Not authorized to view schedules for this role');
        }
      }
      
      const startDate = startDateString ? new Date(startDateString) : undefined;
      const endDate = endDateString ? new Date(endDateString) : undefined;
      
      return this.staffScheduleService.findByRole(roleId, startDate, endDate);
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get a staff schedule by ID' })
    @ApiResponse({ status: 200, description: 'Returns the staff schedule.' })
    async findById(@Param('id') id: string, @Request() req) {
      const schedule = await this.staffScheduleService.findById(id);
      
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        schedule.data.vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin && req.user.id !== schedule.data.staffId) {
        throw new UnauthorizedException('Not authorized to view this schedule');
      }
      
      return schedule;
    }
  
    @Put(':id')
    @ApiOperation({ summary: 'Update a staff schedule' })
    @ApiResponse({ status: 200, description: 'The staff schedule has been successfully updated.' })
    async update(
      @Param('id') id: string,
      @Body() updateStaffScheduleDto: UpdateStaffScheduleDto,
      @Request() req
    ) {
      const schedule = await this.staffScheduleService.findById(id);
      
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        schedule.data.vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to update this schedule');
      }
      
      return this.staffScheduleService.update(id, updateStaffScheduleDto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete a staff schedule' })
    @ApiResponse({ status: 200, description: 'The staff schedule has been successfully deleted.' })
    async remove(@Param('id') id: string, @Request() req) {
      const schedule = await this.staffScheduleService.findById(id);
      
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        schedule.data.vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to delete this schedule');
      }
      
      return this.staffScheduleService.remove(id);
    }
  
    @Put(':id/publish')
    @ApiOperation({ summary: 'Publish a staff schedule' })
    @ApiResponse({ status: 200, description: 'The staff schedule has been published.' })
    async publishSchedule(@Param('id') id: string, @Request() req) {
      const schedule = await this.staffScheduleService.findById(id);
      
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        schedule.data.vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to publish this schedule');
      }
      
      return this.staffScheduleService.updateStatus(id, StaffScheduleStatusEnum.PUBLISHED);
    }
  
    @Post('vendor/:vendorId/publish')
    @ApiOperation({ summary: 'Publish all draft schedules for a vendor in a date range' })
    @ApiResponse({ status: 200, description: 'The schedules have been published.' })
    async publishVendorSchedules(
      @Param('vendorId') vendorId: string,
      @Body() publishData: { startDate: Date, endDate: Date },
      @Request() req
    ) {
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to publish schedules for this vendor');
      }
      
      if (!publishData.startDate || !publishData.endDate) {
        throw new BadRequestException('Start date and end date are required');
      }
      
      const startDate = new Date(publishData.startDate);
      const endDate = new Date(publishData.endDate);
      
      if (startDate > endDate) {
        throw new BadRequestException('Start date must be before end date');
      }
      
      return this.staffScheduleService.publishSchedules(vendorId, startDate, endDate);
    }
  
    @Post('vendor/:vendorId/generate')
    @ApiOperation({ summary: 'Generate draft schedules from role shifts' })
    @ApiResponse({ status: 201, description: 'Draft schedules have been generated.' })
    async generateSchedules(
      @Param('vendorId') vendorId: string,
      @Body() generateData: { startDate: Date, endDate: Date },
      @Request() req
    ) {
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to generate schedules for this vendor');
      }
      
      if (!generateData.startDate || !generateData.endDate) {
        throw new BadRequestException('Start date and end date are required');
      }
      
      const startDate = new Date(generateData.startDate);
      const endDate = new Date(generateData.endDate);
      
      if (startDate > endDate) {
        throw new BadRequestException('Start date must be before end date');
      }
      
      return this.staffScheduleService.generateFromRoleShifts(vendorId, startDate, endDate);
    }
  }