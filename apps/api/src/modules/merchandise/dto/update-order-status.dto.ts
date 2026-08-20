import { IsIn } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['PENDING', 'FULFILLED', 'CANCELLED'])
  status!: 'PENDING' | 'FULFILLED' | 'CANCELLED';
}
