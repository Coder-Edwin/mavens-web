import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateRecordingSheetDto {
  @IsUUID()
  studentId!: string;

  // A URL to an already-hosted photo (e.g. shared via WhatsApp/Drive) — this
  // app has no file-upload pipeline yet, matching how MerchandiseItem.imageUrl
  // and Course.coverImageUrl already work.
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coachComment?: string;
}

export class UpdateRecordingSheetDto {
  // Setting this is what "reviewing" the sheet means — it stamps
  // reviewedById/reviewedAt on the reviewing coach.
  @IsString()
  @MaxLength(2000)
  coachComment!: string;
}
