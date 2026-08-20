import { IsOptional, IsUUID } from 'class-validator';

export class RegisterTournamentDto {
  // Required for PARENT and ADMIN callers (which student are they registering?).
  // Ignored for STUDENT callers — they can only ever register themselves.
  @IsOptional()
  @IsUUID()
  studentId?: string;
}
