import { 
    Controller, 
    Get, 
    Patch, 
    Param, 
    Body, 
    UseGuards,
    UnauthorizedException,
    NotFoundException,
    BadRequestException,
    Request
  } from '@nestjs/common';
  import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
  import { AuthGuard } from '@nestjs/passport';
  import { RolesGuard } from '../roles/roles.guard';
  import { Roles } from '../roles/roles.decorator';
  import { RoleEnum } from '../roles/roles.enum';
  import { TicketService } from './ticket.service';
  import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
  import { UpdateTicketDto } from './dto/update-ticket.dto';
import { VendorService } from 'src/vendors/vendor.service';
import { TicketStatus } from './infrastructure/persistence/document/entities/ticket.schema';
  
  @ApiTags('Tickets')
  @Controller('tickets')
  export class TicketController {
    constructor(
      private readonly ticketService: TicketService,
      private readonly vendorService: VendorService
    ) {}
  
    // Get ticket by ID - Public access
    @Get(':id')
    async getTicket(@Param('id') id: string) {
      const ticket = await this.ticketService.findById(id);
      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }
      return { data: ticket };
    }
  
    // Update ticket status - Admin only
    @Patch(':id/status')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(RoleEnum.admin)
    @ApiBearerAuth()
    async updateTicketStatus(
      @Param('id') id: string,
      @Body() updateStatusDto: UpdateTicketStatusDto,
      @Request() req
    ) {
      const ticket = await this.ticketService.updateStatus(
        id, 
        updateStatusDto.status, 
        {
          reason: updateStatusDto.reason,
          updatedBy: req.user.id
        }
      );
      return { data: ticket };
    }
  
    // Update ticket details - Admin only
    @Patch(':id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(RoleEnum.admin)
    @ApiBearerAuth()
    async updateTicket(
      @Param('id') id: string,
      @Body() updateTicketDto: UpdateTicketDto
    ) {
      const ticket = await this.ticketService.updateTicket(id, updateTicketDto);
      return { data: ticket };
    }
  
    // Redeem ticket - Vendor only
    @Patch(':id/redeem')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    async redeemTicket(
      @Param('id') id: string,
      @Request() req
    ) {
      const ticket = await this.ticketService.findById(id);
      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }
  
      // Check if user belongs to vendor
      const isVendorUser = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        ticket.vendorId
      );
  
      if (!isVendorUser) {
        throw new UnauthorizedException('Not authorized to redeem this ticket');
      }
  
      if (ticket.status !== TicketStatus.ACTIVE) {
        throw new BadRequestException(`Ticket cannot be redeemed - current status: ${ticket.status}`);
      }
  
      return {
        data: await this.ticketService.updateStatus(id, TicketStatus.REDEEMED, {
          updatedBy: req.user.id
        })
      };
    }
  }