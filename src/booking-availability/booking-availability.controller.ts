import { 
    Controller, 
    Get, 
    Post, 
    Body, 
    Query, 
    Param, 
    UseGuards 
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { AuthGuard } from '@nestjs/passport';
  import { BookingAvailabilityService } from './booking-availability.service';
  import { TimeSlotRequestDto, TimeSlotResponseDto } from './dto/time-slot-request.dto';
  import { BookingRequestValidationDto, BookingValidationResponseDto } from './dto/booking-request-validation.dto';
  import { AvailableStaffDto } from './dto/available-staff.dto';
  
  @ApiTags('Booking Availability')
  @Controller('booking-availability')
  export class BookingAvailabilityController {
    constructor(private readonly availabilityService: BookingAvailabilityService) {}
  
    @Get(':bookingItemId')
    @ApiOperation({ summary: 'Get available slots for a booking item' })
    @ApiResponse({ 
      status: 200, 
      description: 'Returns available time slots',
      type: TimeSlotResponseDto 
    })
    async getAvailableSlots(
      @Param('bookingItemId') bookingItemId: string,
      @Query() request: TimeSlotRequestDto
    ): Promise<TimeSlotResponseDto> {
      return this.availabilityService.getAvailableTimeSlots(bookingItemId, request);
    }
  
    @Get(':bookingItemId/date/:date')
    @ApiOperation({ summary: 'Get available slots for specific date' })
    @ApiResponse({ 
      status: 200, 
      description: 'Returns available time slots for date',
      type: TimeSlotResponseDto 
    })
    async getAvailableSlotsForDate(
      @Param('bookingItemId') bookingItemId: string,
      @Param('date') dateString: string
    ) {
      const date = new Date(dateString);
      return this.availabilityService.getAvailableTimeSlotsForDate(bookingItemId, date);
    }
  
    @Get('staff/:bookingItemId/:startDateTime')
    @ApiOperation({ summary: 'Find available staff for time slot' })
    @ApiResponse({ 
      status: 200, 
      description: 'Returns available staff',
      type: [AvailableStaffDto] 
    })
    async findAvailableStaff(
      @Param('bookingItemId') bookingItemId: string,
      @Param('startDateTime') startDateTime: string
    ) {
      return this.availabilityService.findAvailableStaff(
        bookingItemId,
        new Date(startDateTime)
      );
    }
  
    @Post('validate')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Validate booking request' })
    @ApiResponse({ 
      status: 200, 
      description: 'Returns validation result',
      type: BookingValidationResponseDto 
    })
    async validateBookingRequest(
      @Body() request: BookingRequestValidationDto
    ): Promise<BookingValidationResponseDto> {
      return this.availabilityService.validateBookingRequest(request);
    }
  
    @Get('excluding-booking/:bookingItemId/date/:date/exclude/:bookingId')
    @ApiOperation({ summary: 'Get available slots excluding a specific booking' })
    @ApiResponse({ 
      status: 200, 
      description: 'Returns available time slots excluding specified booking',
      type: TimeSlotResponseDto 
    })
    async getAvailableTimeSlotsExcludingBooking(
      @Param('bookingItemId') bookingItemId: string,
      @Param('date') dateString: string,
      @Param('bookingId') bookingId: string
    ) {
      const date = new Date(dateString);
      return this.availabilityService.getAvailableTimeSlotsExcludingBooking(
        bookingItemId,
        date,
        bookingId
      );
    }
  }