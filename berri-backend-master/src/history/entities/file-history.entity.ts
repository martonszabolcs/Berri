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

@Entity('file_history')
@Index(['userId', 'date']) // Index a hatékony lekérdezésekhez
export class FileHistory {
  @ApiProperty({ description: 'History ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'User ID' })
  @Column()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @ApiProperty({ description: 'Upload date' })
  @Column({ type: 'timestamp' })
  date: Date;

  @ApiProperty({ description: 'Original filename' })
  @Column({ type: 'varchar', length: 500 })
  filename: string;

  @ApiProperty({ description: 'Download/View URL', required: false })
  @Column({ type: 'text', nullable: true })
  url: string;

  @ApiProperty({ description: 'Storage provider (dropbox, onedrive, googledrive)' })
  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @ApiProperty({ description: 'File size in bytes', required: false })
  @Column({ type: 'bigint', nullable: true })
  fileSize: number;

  @ApiProperty({ description: 'File MIME type', required: false })
  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string;

  @ApiProperty({ description: 'History entry creation date' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'History entry last update date' })
  @UpdateDateColumn()
  updatedAt: Date;
}