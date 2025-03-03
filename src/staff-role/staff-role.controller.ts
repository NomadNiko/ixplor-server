import { 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete, 
    Body, 
    Param, 
    UseGuards,
    Query, 
    Request, 
    UnauthorizedException 
  } from '@nestjs/common';
  import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
  import { AuthGuard } from '@nestjs/passport';
  import { RolesGuard } from '../roles/roles.guard';
  import { Roles } from '../roles/roles.decorator';
  import { RoleEnum } from '../roles/roles.enum';
  import { StaffRoleService } from './staff-role.service';
  import { CreateStaffRoleDto } from './dto/create-staff-role.dto';
  import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
  import { VendorService } from '../vendors/vendor.service';
  
  @ApiTags('Staff Roles')
  @Controller('staff-roles')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  export class StaffRoleController {
    constructor(
      private readonly staffRoleService: StaffRoleService,
      private readonly vendorService: VendorService,
    ) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new staff role' })
    @ApiResponse({ status: 201, description: 'The staff role has been successfully created.' })
    async create(@Body() createStaffRoleDto: CreateStaffRoleDto, @Request() req) {
      // Check if user is authorized for this vendor
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        createStaffRoleDto.vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to create roles for this vendor');
      }
      
      return this.staffRoleService.create(createStaffRoleDto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all staff roles' })
    @ApiResponse({ status: 200, description: 'Returns all staff roles.' })
    @Roles(RoleEnum.admin)
    @UseGuards(RolesGuard)
    async findAll() {
      return this.staffRoleService.findAll();
    }
  
    @Get('vendor/:vendorId')
    @ApiOperation({ summary: 'Get all staff roles for a vendor' })
    @ApiResponse({ status: 200, description: 'Returns all staff roles for the vendor.' })
    async findByVendor(@Param('vendorId') vendorId: string, @Request() req) {
      // Check if user is authorized for this vendor
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to view roles for this vendor');
      }
      
      return this.staffRoleService.findByVendor(vendorId);
    }
  
    @Get('booking-item/:bookingItemId')
    @ApiOperation({ summary: 'Get all roles qualified for a specific booking item' })
    @ApiResponse({ status: 200, description: 'Returns qualified roles.' })
    async findByBookingItem(@Param('bookingItemId') bookingItemId: string) {
      return this.staffRoleService.findByBookingItem(bookingItemId);
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get staff role by ID' })
    @ApiResponse({ status: 200, description: 'Returns the staff role.' })
    async findOne(@Param('id') id: string) {
      return this.staffRoleService.findById(id);
    }
  
    @Put(':id')
    @ApiOperation({ summary: 'Update a staff role' })
    @ApiResponse({ status: 200, description: 'The staff role has been successfully updated.' })
    async update(
      @Param('id') id: string, 
      @Body() updateStaffRoleDto: UpdateStaffRoleDto,
      @Request() req
    ) {
      const role = await this.staffRoleService.findById(id);
      
      // Check if user is authorized for this vendor
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        role.data.vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to update roles for this vendor');
      }
      
      return this.staffRoleService.update(id, updateStaffRoleDto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete a staff role' })
    @ApiResponse({ status: 200, description: 'The staff role has been successfully deleted.' })
    async remove(@Param('id') id: string, @Request() req) {
      const role = await this.staffRoleService.findById(id);
      
      // Check if user is authorized for this vendor
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        role.data.vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to delete roles for this vendor');
      }
      
      return this.staffRoleService.remove(id);
    }
  
    @Post(':id/booking-items/:bookingItemId')
    @ApiOperation({ summary: 'Add booking item qualification to a role' })
    @ApiResponse({ status: 200, description: 'Booking item qualification added successfully.' })
    async addBookingItem(
      @Param('id') id: string,
      @Param('bookingItemId') bookingItemId: string,
      @Request() req
    ) {
      const role = await this.staffRoleService.findById(id);
      
      // Check if user is authorized for this vendor
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        role.data.vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to modify roles for this vendor');
      }
      
      return this.staffRoleService.addBookingItemQualification(id, bookingItemId);
    }
  
    @Delete(':id/booking-items/:bookingItemId')
    @ApiOperation({ summary: 'Remove booking item qualification from a role' })
    @ApiResponse({ status: 200, description: 'Booking item qualification removed successfully.' })
    async removeBookingItem(
      @Param('id') id: string,
      @Param('bookingItemId') bookingItemId: string,
      @Request() req
    ) {
      const role = await this.staffRoleService.findById(id);
      
      // Check if user is authorized for this vendor
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        role.data.vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException('Not authorized to modify roles for this vendor');
      }
      
      return this.staffRoleService.removeBookingItemQualification(id, bookingItemId);
    }
  }