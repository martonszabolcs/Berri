import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserSettings } from '../settings/entities/user-settings.entity';
import { Destination } from '../destinations/entities/destination.entity';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserSettings)
    private userSettingsRepository: Repository<UserSettings>,
    @InjectRepository(Destination)
    private destinationsRepository: Repository<Destination>,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: [
        'id',
        'name',
        'email',
        'emailVerified',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['settings', 'destinations'],
      select: [
        'id',
        'name',
        'email',
        'emailVerified',
        'createdAt',
        'updatedAt',
      ],
    });
    console.log("USER found", user);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  findOneByEmail(email: string | undefined): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  findOneByResetPasswordToken(token: string | undefined): Promise<User | null> {
    return this.usersRepository.findOneBy({
      resetPasswordToken: token,
    });
  }

  findOneByEmailVerificationToken(
    token: string | undefined,
  ): Promise<User | null> {
    return this.usersRepository.findOneBy({
      emailVerificationToken: token,
    });
  }

  async create(createUserDto: CreateUserDto): Promise<User | null> {
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      SALT_ROUNDS,
    );
    const emailVerificationToken = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    const newUser = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      emailVerificationToken,
      emailVerified: false,
    });

    return this.usersRepository.save(newUser);
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.update(id, updateUserDto);
    return this.findOne(id);
  }

  update(user: Partial<User>): Promise<any> {
    return this.usersRepository.update(
      {
        id: user.id,
      },
      user,
    );
  }

  updatePassword(id: number, hashedPassword: string): Promise<any> {
    return this.usersRepository.update(
      {
        id,
      },
      {
        password: hashedPassword,
      },
    );
  }

  async delete(id: number): Promise<void> {
    const user = await this.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete related user settings
    await this.userSettingsRepository.delete({ userId: id });

    // Delete related destinations
    await this.destinationsRepository.delete({ userId: id });

    // Finally delete the user
    await this.usersRepository.delete(id);
  }
}
