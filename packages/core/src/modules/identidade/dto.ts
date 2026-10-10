import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import type { TipoConvite } from "@gas/types";

export class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(1) senha!: string;
}

export class AceitarConviteDto {
  @ApiProperty() @IsString() @MinLength(10) token!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(200) senha!: string;
}

export class CriarConviteDto {
  @ApiProperty({ enum: ["morador", "admin"] }) @IsIn(["morador", "admin"]) tipo!: TipoConvite;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) nome!: string;
  @ApiPropertyOptional({ description: "Obrigatório para convite de morador." })
  @IsOptional()
  @IsUUID()
  unidadeId?: string;
}
