import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import { IsString, Length, Matches } from "class-validator";

class SetUsernameDto {
  @IsString()
  @Length(3, 20)
  @Matches(/^@?[a-zA-Z0-9_]{3,20}$/)
  username!: string;
}

class UpdateProfileDto {
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @IsString()
  @Length(1, 100)
  lastName!: string;
}

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  async me(@CurrentUser() current: AuthenticatedUser) {
    const user = await this.users.findById(current.id);
    return {
      id: user.id,
      phone: user.phone,
      kelyoId: user.kelyoId,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      kycTier: user.kycTier,
      kycStatus: user.kycStatus,
      isPhoneVerified: user.isPhoneVerified,
      countryCode: user.countryCode,
      createdAt: user.createdAt,
    };
  }

  @Patch("me")
  async updateMyProfile(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(current.id, dto.firstName, dto.lastName);
  }

  @Get("lookup")
  async lookup(@Query("q") query: string) {
    if (!query) throw new NotFoundException("Query required");
    const user = await this.users.findRecipient(query);
    if (!user || !user.isActive) throw new NotFoundException("Recipient not found");
    return {
      kelyoId: user.kelyoId,
      username: user.username,
      displayName:
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.username ||
        user.kelyoId,
      kycVerified: user.kycTier !== "TIER_0",
    };
  }

  @Get("username/check")
  async checkUsername(@Query("username") username: string) {
    if (!username) return { available: false, reason: "Vide" };
    return this.users.checkUsernameAvailability(username);
  }

  @Post("me/username")
  async setMyUsername(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: SetUsernameDto,
  ) {
    return this.users.setUsername(current.id, dto.username);
  }
}
