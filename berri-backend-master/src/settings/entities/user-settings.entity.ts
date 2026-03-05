import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/user.entity';

@Entity('user_settings')
export class UserSettings {
  @ApiProperty({ description: 'Settings ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'User ID' })
  @Column()
  userId: number;

  @OneToOne(() => User, (user) => user.settings)
  @JoinColumn()
  user: User;

  // Dropbox beállítások
  @ApiProperty({ description: 'Dropbox access token', required: false })
  @Column({ nullable: true })
  dropboxAccessToken: string;

  @ApiProperty({ description: 'Dropbox refresh token', required: false })
  @Column({ nullable: true })
  dropboxRefreshToken: string;

  // OneDrive beállítások
  @ApiProperty({ description: 'OneDrive access token', required: false })
  @Column({ nullable: true })
  oneDriveAccessToken: string;

  @ApiProperty({ description: 'OneDrive refresh token', required: false })
  @Column({ nullable: true })
  oneDriveRefreshToken: string;

  // Google Drive beállítások
  @ApiProperty({ description: 'Google Drive access token', required: false })
  @Column({ nullable: true })
  googleDriveAccessToken: string;

  @ApiProperty({ description: 'Google Drive refresh token', required: false })
  @Column({ nullable: true })
  googleDriveRefreshToken: string;

  // File naming beállítások
  @ApiProperty({ description: 'File naming template', required: false })
  @Column({ nullable: true, default: '{timestamp}_{originalname}' })
  fileNaming: string;

  @ApiProperty({ description: 'Settings creation date' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Settings last update date' })
  @UpdateDateColumn()
  updatedAt: Date;
}
