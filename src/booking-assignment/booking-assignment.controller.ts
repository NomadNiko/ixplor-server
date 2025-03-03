import { 
    Controller, 
    Get, 
    Put, 
    Param, 
    Body, 
    UseGuards,
    Query,
    Request,
    UnauthorizedException
  } from '@nestjs/common';
  import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
  import { AuthGuard } from '@nestjs/passport';
  import { BookingAssignmentService } from './booking-assignment.service';
  import { BookingDetailsDto } from './dto/booking-details.dto';
  import { BookingAssignmentResponse, SingleBookingResponse } from './types/booking-assignment.types';
  
  @ApiTags('Booking Assignments')
  @Controller('booking-assignments')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  export class BookingAssignmentController {
    constructor(private readonly bookingAssignmentService: BookingAssignmentService) {}
  
    @Put(':bookingId/reassign/:staffId')
    @ApiOperation({ summary: 'Reassign booking to different staff member' })
    @ApiResponse({ status: 200, description: 'Booking reassigned successfully' })
    async reassignBooking(
      @Param('bookingId') bookingId: string,
      @Param('staffId') staffId: string,
      @Request() req
    ): Promise<SingleBookingResponse> {
      const canReassign = await this.bookingAssignmentService.validateReassignmentPermission(
        req.user.id,
        bookingId
      );
  
      if (!canReassign) {
        throw new UnauthorizedException('Not authorized to reassign this booking');
      }
  
      return this.bookingAssignmentService.reassignBooking(bookingId, staffId);
    }
  
    @Get('available-staff/:bookingId')
    @ApiOperation({ summary: 'Get available staff for booking reassignment' })
    async getAvailableStaffForReassignment(
      @Param('bookingId') bookingId: string
    ) {
      return this.bookingAssignmentService.findAvailableStaffForReassignment(bookingId);
    }
  
    @Get('vendor/:vendorId/date/:date')
    @ApiOperation({ summary: 'Get all bookings for vendor on specific date' })
    async getVendorBookingsForDate(
      @Param('vendorId') vendorId: string,
      @Param('date') date: string,
      @Query('status') status?: string
    ): Promise<BookingAssignmentResponse> {
      return this.bookingAssignmentService.getBookingsByDate(vendorId, new Date(date), status);
    }
  
    @Get('booking/:bookingId')
    @ApiOperation({ summary: 'Get booking details' })
    async getBookingDetails(
      @Param('bookingId') bookingId: string
    ): Promise<{ data: BookingDetailsDto | null }> {
      const details = await this.bookingAssignmentService.getBookingDetails(bookingId);
      return { data: details };
    }
  
    @Get('booking/:bookingId/staff')
    @ApiOperation({ summary: 'Get assigned staff for booking' })
    async getAssignedStaff(@Param('bookingId') bookingId: string) {
      return this.bookingAssignmentService.getAssignedStaff(bookingId);
    }
  }