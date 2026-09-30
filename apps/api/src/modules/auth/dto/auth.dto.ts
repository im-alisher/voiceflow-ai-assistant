import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ada@voiceflow.local' })
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;

  @ApiProperty({ example: 'Str0ngPassphrase', format: 'password' })
  @IsString()
  @Length(1, 128)
  password!: string;

  @ApiPropertyOptional({ default: false, description: 'Extends the refresh token lifetime' })
  @IsOptional()
  rememberMe?: boolean = false;
}

export class RegisterDto {
  @ApiProperty({ example: 'ada@voiceflow.local' })
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;

  @ApiProperty({ example: 'Str0ngPassphrase', format: 'password', minLength: 10, maxLength: 128 })
  @IsString()
  @Length(10, 128, { message: 'Password must be between 10 and 128 characters' })
  password!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @Length(2, 64)
  displayName!: string;

  @ApiPropertyOptional({ default: 'en-US' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string = 'en-US';
}

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Optional when the refresh token is presented as an httpOnly cookie',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ format: 'password', minLength: 10, maxLength: 128 })
  @IsString()
  @Length(10, 128)
  newPassword!: string;
}
