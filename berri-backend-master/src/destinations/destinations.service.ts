import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Destination,
  FileType,
  DestinationType,
} from './entities/destination.entity';
import {
  CreateDestinationDto,
  UpdateDestinationDto,
} from './dto/destination.dto';
import { UsersService } from '../users/users.service';
import { EmailService } from '../core/email/email.service';

@Injectable()
export class DestinationsService {
  constructor(
    @InjectRepository(Destination)
    private destinationRepository: Repository<Destination>,
    private usersService: UsersService,
    private emailService: EmailService,
  ) {}

  async findAllByUserId(userId: number): Promise<Destination[]> {
    return this.destinationRepository.find({
      where: { userId },
      order: { type: 'ASC' },
    });
  }

  async findByUserIdAndType(
    userId: number,
    type: number,
  ): Promise<Destination | null> {
    return this.destinationRepository.findOne({
      where: { userId, type },
    });
  }

  async create(
    userId: number,
    createDto: CreateDestinationDto,
  ): Promise<Destination> {
    // Ellenőrizzük, hogy a type már létezik-e ehhez a userhez
    const existing = await this.findByUserIdAndType(userId, createDto.type);
    if (existing) {
      throw new BadRequestException(
        `Destination with type ${createDto.type} already exists for this user`,
      );
    }

    const destination = this.destinationRepository.create({
      ...createDto,
      userId,
    });

    return this.destinationRepository.save(destination);
  }

  async update(
    userId: number,
    type: number,
    updateDto: UpdateDestinationDto,
  ): Promise<Destination> {
    let destination = await this.findByUserIdAndType(userId, type);

    if (!destination) {
      // Ha nem található, hozzunk létre egy újat default értékekkel
      const user = await this.usersService.findOne(userId);

      const defaultData = {
        fileType: FileType.JPG,
        bundled: false,
        destination: DestinationType.EMAIL,
        emails: user.email, // A user saját email címe
        ...updateDto, // Az updateDto felülírhatja a defaultokat
      };

      destination = this.destinationRepository.create({
        userId,
        type,
        ...defaultData,
      });
    } else {
      // Ha létezik, frissítsük
      Object.assign(destination, updateDto);
    }

    return this.destinationRepository.save(destination);
  }

  async sendFileToDestination(
    userId: number,
    type: number,
    file: Express.Multer.File,
  ): Promise<{ message: string; sentTo: string[] }> {
    // Validate file type
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
    if (!file || !allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF and JPG files are allowed.',
      );
    }

    // Get destination
    const destination = await this.findByUserIdAndType(userId, type);
    if (!destination) {
      throw new BadRequestException(`Destination with type ${type} not found`);
    }

    // Get user for sender email
    const user = await this.usersService.findOne(userId);

    // Parse email addresses
    const emailAddresses = destination.emails
      ? destination.emails.split(',').map((email) => email.trim())
      : [];

    if (emailAddresses.length === 0) {
      throw new BadRequestException(
        'No email addresses configured for this destination',
      );
    }

    // Send emails to all recipients
    const sentEmails: string[] = [];
    for (const email of emailAddresses) {
      try {
        await this.emailService.sendFileByEmail(
          email,
          file.buffer,
          file.originalname,
          'Berri Scan',
          `Hello,\n\nPlease find the attached document scanned with Berri App.\n\nBest regards,\n${user.name || user.email}`,
        );
        sentEmails.push(email);
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        // Continue with other emails even if one fails
      }
    }

    return {
      message: `File sent successfully to ${sentEmails.length} recipient(s)`,
      sentTo: sentEmails,
    };
  }

  async sendFilesToDestination(
    userId: number,
    type: number,
    files: Express.Multer.File[],
  ): Promise<{ message: string; sentTo: string[]; filesCount: number }> {
    // Validate files
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
    
    // Validate all files
    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type for ${file.originalname}. Only PDF and JPG files are allowed.`,
        );
      }
    }

    // Get destination
    const destination = await this.findByUserIdAndType(userId, type);
    if (!destination) {
      throw new BadRequestException(`Destination with type ${type} not found`);
    }

    // Get user for sender email
    const user = await this.usersService.findOne(userId);

    // Parse email addresses
    const emailAddresses = destination.emails
      ? destination.emails.split(',').map((email) => email.trim())
      : [];

    if (emailAddresses.length === 0) {
      throw new BadRequestException(
        'No email addresses configured for this destination',
      );
    }

    // Send emails to all recipients
    const sentEmails: string[] = [];
    for (const email of emailAddresses) {
      try {
        await this.emailService.sendMultipleFilesByEmail(
          email,
          files,
          'Berri Scan - Multiple Documents',
          `Hello,\n\nPlease find the attached documents scanned with Berri App.\n\nFiles included: ${files.map((f) => f.originalname).join(', ')}\n\nBest regards,\n${user.name || user.email}`,
        );
        sentEmails.push(email);
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        // Continue with other emails even if one fails
      }
    }

    return {
      message: `${files.length} files sent successfully to ${sentEmails.length} recipient(s)`,
      sentTo: sentEmails,
      filesCount: files.length,
    };
  }
}
