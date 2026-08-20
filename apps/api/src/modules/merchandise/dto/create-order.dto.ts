import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class OrderLineItemInput {
  @IsUUID()
  merchandiseItemId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsString()
  size?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderLineItemInput)
  items!: OrderLineItemInput[];
}
