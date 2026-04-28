import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class TransferDto {
  @ApiProperty({
    example: "KEL12345678",
    description: "Recipient: Kelyo ID (KEL...), phone (+241...), or @username",
  })
  @IsString()
  @Length(3, 30)
  toRecipient!: string;

  @ApiProperty({ example: 5000 })
  @IsInt()
  @Min(100)
  @Max(1_000_000_000)
  amount!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;
}
