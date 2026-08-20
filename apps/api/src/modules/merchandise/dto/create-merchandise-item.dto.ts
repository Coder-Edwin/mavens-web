import { IsInt, IsOptional, IsPositive, IsString, Min, MinLength } from 'class-validator';

export class CreateMerchandiseItemDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsPositive()
  price!: number;

  @IsOptional()
  @IsString()
  sizeOptions?: string; // comma-separated, e.g. "S,M,L,XL"

  @IsInt()
  @Min(0)
  stockQuantity!: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
