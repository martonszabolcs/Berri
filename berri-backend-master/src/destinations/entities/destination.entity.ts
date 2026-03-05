import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/user.entity';

export enum DestinationType {
  EMAIL = 'email',
  ONEDRIVE = 'onedrive',
  DROPBOX = 'dropbox',
  GOOGLE_DRIVE = 'googledrive',
}

export enum FileType {
  PDF = 'pdf',
  JPG = 'jpg',
}

@Entity('destinations')
@Index(['userId', 'type'], { unique: true }) // Egy user-nek csak egy adott type-ja lehet
export class Destination {
  @ApiProperty({ description: 'Destination ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'User ID' })
  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.destinations)
  @JoinColumn()
  user: User;

  @ApiProperty({
    description: 'Type number (1-7), unique per user',
    minimum: 1,
    maximum: 7,
  })
  @Column({ type: 'int' })
  type: number;

  @ApiProperty({
    description: 'File type',
    enum: FileType,
    example: FileType.JPG,
  })
  @Column({
    type: 'enum',
    enum: FileType,
  })
  fileType: FileType;

  @ApiProperty({ description: 'Whether files should be bundled' })
  @Column({ default: false })
  bundled: boolean;

  @ApiProperty({
    description: 'Destination provider',
    enum: DestinationType,
    example: DestinationType.EMAIL,
  })
  @Column({
    type: 'enum',
    enum: DestinationType,
  })
  destination: DestinationType;

  @ApiProperty({
    description: 'Email addresses (comma-separated) or empty',
    required: false,
  })
  @Column({ nullable: true, type: 'text' })
  emails: string;

  @ApiProperty({ description: 'Destination creation date' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Destination last update date' })
  @UpdateDateColumn()
  updatedAt: Date;
}