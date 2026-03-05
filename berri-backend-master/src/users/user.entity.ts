import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { UserSettings } from '../settings/entities/user-settings.entity';
import { Destination } from '../destinations/entities/destination.entity';

@Entity()
export class User {
  @ApiProperty({ description: 'User ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'User name' })
  @Column({ nullable: true })
  name: string;

  @ApiProperty({ description: 'User email address' })
  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @ApiProperty({ description: 'Email verification status' })
  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true, type: 'varchar' })
  emailVerificationToken: string | null;

  @Column({ nullable: true, type: 'varchar' })
  resetPasswordToken: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resetPasswordExpires: Date | null;

  @ApiProperty({ description: 'User creation date' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'User last update date' })
  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => UserSettings, (settings) => settings.user)
  settings: UserSettings;

  @OneToMany(() => Destination, (destination) => destination.user)
  destinations: Destination[];
}
