import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/// Admin triage: move a lead through the pipeline and jot a follow-up note.
export class UpdateLeadDto {
  @IsOptional()
  @IsIn(['NEW', 'CONTACTED', 'ENROLLED', 'ARCHIVED'])
  status?: 'NEW' | 'CONTACTED' | 'ENROLLED' | 'ARCHIVED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
