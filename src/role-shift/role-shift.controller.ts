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
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RoleShiftService } from './role-shift.service';
import { CreateRoleShiftDto } from './dto/create-role-shift.dto';
import { UpdateRoleShiftDto } from './dto/update-role-shift.dto';
import { VendorService } from '../vendors/vendor.service';
import { RoleShiftSchemaClass } from './infrastructure/persistence/document/entities/role-shift.schema';

// Define interface for service response
interface ServiceResponse<T> {
  data: T;
  message: string;
}

@ApiTags('Role Shifts')
@Controller('role-shifts')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class RoleShiftController {
  constructor(
    private readonly roleShiftService: RoleShiftService,
    private readonly vendorService: VendorService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new role shift' })
  @ApiResponse({ status: 201, description: 'The role shift has been successfully created.' })
  async create(@Body() createRoleShiftDto: CreateRoleShiftDto, @Request() req) {
    const authorized = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      createRoleShiftDto.vendorId
    );
    
    if (!authorized && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException('Not authorized to create shifts for this vendor');
    }
    
    return this.roleShiftService.create(createRoleShiftDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all role shifts' })
  @ApiResponse({ status: 200, description: 'Returns all role shifts.' })
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  async findAll() {
    return this.roleShiftService.findAll();
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get all role shifts for a vendor' })
  @ApiResponse({ status: 200, description: 'Returns all role shifts for the vendor.' })
  async findByVendor(@Param('vendorId') vendorId: string, @Request() req) {
    const authorized = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      vendorId
    );
    
    if (!authorized && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException('Not authorized to view role shifts for this vendor');
    }
    
    return this.roleShiftService.findByVendor(vendorId);
  }

  @Get('role/:roleId')
  @ApiOperation({ summary: 'Get all shifts for a specific role' })
  @ApiResponse({ status: 200, description: 'Returns all shifts for the role.' })
  async findByRole(@Param('roleId') roleId: string, @Request() req) {
    const shifts = await this.roleShiftService.findByRole(roleId);
    
    if (shifts.data.length === 0) {
      throw new NotFoundException('No shifts found for this role');
    }
    
    const vendorId = shifts.data[0].vendorId;
    const authorized = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      vendorId
    );
    
    if (!authorized && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException('Not authorized to view shifts for this role');
    }
    
    return shifts;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role shift by ID' })
  @ApiResponse({ status: 200, description: 'Returns the role shift.' })
  async findOne(@Param('id') id: string, @Request() req) {
    const shift = await this.roleShiftService.findById(id);
    
    const authorized = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      shift.data.vendorId
    );
    
    if (!authorized && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException('Not authorized to view this role shift');
    }
    
    return shift;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a role shift' })
  @ApiResponse({ status: 200, description: 'The role shift has been successfully updated.' })
  async update(
    @Param('id') id: string, 
    @Body() updateRoleShiftDto: UpdateRoleShiftDto,
    @Request() req
  ) {
    const shift = await this.roleShiftService.findById(id);
    
    const authorized = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      shift.data.vendorId
    );
    
    if (!authorized && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException('Not authorized to update shifts for this vendor');
    }
    
    return this.roleShiftService.update(id, updateRoleShiftDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a role shift' })
  @ApiResponse({ status: 200, description: 'The role shift has been successfully deleted.' })
  async remove(@Param('id') id: string, @Request() req) {
    const shift = await this.roleShiftService.findById(id);
    
    const authorized = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      shift.data.vendorId
    );
    
    if (!authorized && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException('Not authorized to delete shifts for this vendor');
    }
    
    return this.roleShiftService.remove(id);
  }

  @Get('day/:day/time/:time')
  @ApiOperation({ summary: 'Find role shifts for a specific day and time' })
  @ApiParam({ name: 'day', description: 'Day of week (0-6, Sunday-Saturday)', type: Number })
  @ApiParam({ name: 'time', description: 'Time in 24h format (HH:MM)', type: String })
  @ApiResponse({ status: 200, description: 'Returns matching role shifts.' })
  async findByDayAndTime(
    @Param('day') day: string,
    @Param('time') time: string
  ) {
    const dayOfWeek = parseInt(day, 10);
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new BadRequestException('Day must be a number between 0 and 6');
    }
    
    return this.roleShiftService.findByDayAndTime(dayOfWeek, time);
  }

  @Get('booking/:bookingItemId/day/:day')
  @ApiOperation({ summary: 'Find shifts for a booking item on a specific day' })
  @ApiParam({ name: 'bookingItemId', description: 'ID of the booking item' })
  @ApiParam({ name: 'day', description: 'Day of week (0-6, Sunday-Saturday)', type: Number })
  @ApiResponse({ status: 200, description: 'Returns matching role shifts for the booking item.' })
  async findForBookingItem(
    @Param('bookingItemId') bookingItemId: string,
    @Param('day') day: string
  ) {
    const dayOfWeek = parseInt(day, 10);
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new BadRequestException('Day must be a number between 0 and 6');
    }
    
    return this.roleShiftService.findForBookingItem(bookingItemId, dayOfWeek);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple role shifts in a single operation' })
  @ApiResponse({ status: 201, description: 'Role shifts created successfully' })
  async createBulkShifts(
    @Body() shifts: CreateRoleShiftDto[],
    @Request() req
  ) {
    if (!Array.isArray(shifts) || shifts.length === 0) {
      throw new BadRequestException('Please provide an array of role shifts');
    }
    
    const vendorIds = [...new Set(shifts.map(shift => shift.vendorId))];
    
    for (const vendorId of vendorIds) {
      const authorized = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        vendorId
      );
      
      if (!authorized && req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException(`Not authorized to create shifts for vendor ${vendorId}`);
      }
    }
    
    const results: Array<ServiceResponse<RoleShiftSchemaClass>> = [];
    
    for (const shift of shifts) {
      // This fixes line 228 error by specifying the return type
      const result = await this.roleShiftService.create(shift);
      results.push(result);
    }
    
    return {
      message: `Successfully created ${results.length} role shifts`,
      data: results.map(result => result.data)
    };
  }

  @Get('vendor/:vendorId/weekly-template')
  @ApiOperation({ summary: 'Get a weekly template of all role shifts for a vendor' })
  @ApiResponse({ status: 200, description: 'Returns all role shifts organized by day of week.' })
  async getWeeklyTemplate(@Param('vendorId') vendorId: string, @Request() req) {
    const authorized = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      vendorId
    );
    
    if (!authorized && req.user.role?.id !== RoleEnum.admin) {
      throw new UnauthorizedException('Not authorized to view role shifts for this vendor');
    }
    
    const shifts = await this.roleShiftService.findByVendor(vendorId);
    
    // Fix: Properly type the weekly template array to accept RoleShiftSchemaClass objects
    const weeklyTemplate: RoleShiftSchemaClass[][] = Array(7).fill(null).map(() => []);
    
    shifts.data.forEach(shift => {
      weeklyTemplate[shift.dayOfWeek].push(shift);
    });
     
    return {
      data: weeklyTemplate,
      message: 'Weekly template retrieved successfully'
    };
  }
}