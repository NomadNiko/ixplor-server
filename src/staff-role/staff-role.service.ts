import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StaffRoleSchemaClass, StaffRoleSchemaDocument } from './infrastructure/persistence/document/entities/staff-role.schema';
import { CreateStaffRoleDto } from './dto/create-staff-role.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import { VendorService } from '../vendors/vendor.service';
import { BookingItemService } from '../booking-item/booking-item.service';

@Injectable()
export class StaffRoleService {
  constructor(
    @InjectModel(StaffRoleSchemaClass.name)
    private readonly staffRoleModel: Model<StaffRoleSchemaDocument>,
    private readonly vendorService: VendorService,
    private readonly bookingItemService: BookingItemService,
  ) {}

  async create(createStaffRoleDto: CreateStaffRoleDto) {
    try {
      // Validate vendor exists
      await this.vendorService.isUserAssociatedWithVendor('anyUserId', createStaffRoleDto.vendorId);      
      // Validate all booking items exist and belong to this vendor
      if (createStaffRoleDto.qualifiedBookingItems?.length) {
        for (const bookingItemId of createStaffRoleDto.qualifiedBookingItems) {
          const bookingItem = await this.bookingItemService.findById(bookingItemId);
          if (bookingItem.data.vendorId !== createStaffRoleDto.vendorId) {
            throw new BadRequestException(`Booking item ${bookingItemId} does not belong to this vendor`);
          }
        }
      }

      const staffRole = new this.staffRoleModel(createStaffRoleDto);
      const savedRole = await staffRole.save();
      
      return {
        data: savedRole,
        message: 'Staff role created successfully'
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error creating staff role:', error);
      throw new InternalServerErrorException('Failed to create staff role');
    }
  }

  async findAll() {
    try {
      const roles = await this.staffRoleModel.find().exec();
      return { data: roles };
    } catch (error) {
      console.error('Error finding all staff roles:', error);
      throw new InternalServerErrorException('Failed to fetch staff roles');
    }
  }

  async findByVendor(vendorId: string) {
    try {
      const roles = await this.staffRoleModel.find({ vendorId }).exec();
      return { data: roles };
    } catch (error) {
      console.error(`Error finding staff roles for vendor ${vendorId}:`, error);
      throw new InternalServerErrorException('Failed to fetch vendor staff roles');
    }
  }

  async findById(id: string) {
    try {
      const role = await this.staffRoleModel.findById(id).exec();
      if (!role) {
        throw new NotFoundException(`Staff role with ID ${id} not found`);
      }
      return { data: role };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error finding staff role ${id}:`, error);
      throw new InternalServerErrorException('Failed to fetch staff role');
    }
  }

  async update(id: string, updateStaffRoleDto: UpdateStaffRoleDto) {
    try {
      // Validate all booking items if provided
      if (updateStaffRoleDto.qualifiedBookingItems?.length) {
        const role = await this.staffRoleModel.findById(id).exec();
        if (!role) {
          throw new NotFoundException(`Staff role with ID ${id} not found`);
        }
        
        for (const bookingItemId of updateStaffRoleDto.qualifiedBookingItems) {
          const bookingItem = await this.bookingItemService.findById(bookingItemId);
          if (bookingItem.data.vendorId !== role.vendorId) {
            throw new BadRequestException(`Booking item ${bookingItemId} does not belong to this vendor`);
          }
        }
      }

      const updatedRole = await this.staffRoleModel
        .findByIdAndUpdate(id, updateStaffRoleDto, { new: true })
        .exec();
      
      if (!updatedRole) {
        throw new NotFoundException(`Staff role with ID ${id} not found`);
      }
      
      return {
        data: updatedRole,
        message: 'Staff role updated successfully'
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error updating staff role ${id}:`, error);
      throw new InternalServerErrorException('Failed to update staff role');
    }
  }

  async remove(id: string) {
    try {
      const deletedRole = await this.staffRoleModel.findByIdAndDelete(id).exec();
      if (!deletedRole) {
        throw new NotFoundException(`Staff role with ID ${id} not found`);
      }
      return {
        data: deletedRole,
        message: 'Staff role deleted successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error deleting staff role ${id}:`, error);
      throw new InternalServerErrorException('Failed to delete staff role');
    }
  }

  async findByBookingItem(bookingItemId: string) {
    try {
      const roles = await this.staffRoleModel
        .find({ qualifiedBookingItems: bookingItemId, isActive: true })
        .exec();
      
      return { data: roles };
    } catch (error) {
      console.error(`Error finding roles for booking item ${bookingItemId}:`, error);
      throw new InternalServerErrorException('Failed to fetch roles by booking item');
    }
  }

  async addBookingItemQualification(roleId: string, bookingItemId: string) {
    try {
      const role = await this.staffRoleModel.findById(roleId).exec();
      if (!role) {
        throw new NotFoundException(`Staff role with ID ${roleId} not found`);
      }
      
      const bookingItem = await this.bookingItemService.findById(bookingItemId);
      if (bookingItem.data.vendorId !== role.vendorId) {
        throw new BadRequestException(`Booking item ${bookingItemId} does not belong to this vendor`);
      }

      // Add booking item if not already added
      if (!role.qualifiedBookingItems.includes(bookingItemId)) {
        role.qualifiedBookingItems.push(bookingItemId);
        await role.save();
      }

      return {
        data: role,
        message: 'Booking item qualification added successfully'
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error adding booking item qualification to role ${roleId}:`, error);
      throw new InternalServerErrorException('Failed to add booking item qualification');
    }
  }

  async removeBookingItemQualification(roleId: string, bookingItemId: string) {
    try {
      const role = await this.staffRoleModel.findById(roleId).exec();
      if (!role) {
        throw new NotFoundException(`Staff role with ID ${roleId} not found`);
      }

      // Remove booking item from qualifications
      role.qualifiedBookingItems = role.qualifiedBookingItems.filter(
        itemId => itemId !== bookingItemId
      );
      await role.save();

      return {
        data: role,
        message: 'Booking item qualification removed successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error removing booking item qualification from role ${roleId}:`, error);
      throw new InternalServerErrorException('Failed to remove booking item qualification');
    }
  }
} 