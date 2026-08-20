import { IsUUID, Matches } from 'class-validator';

export class InitiateStkPushDto {
  @IsUUID()
  studentId!: string;

  // Safaricom format: 2547XXXXXXXX or 2541XXXXXXXX — no leading +, no spaces
  @Matches(/^254[17]\d{8}$/, {
    message: 'phoneNumber must be in the format 2547XXXXXXXX (or 2541XXXXXXXX)'
  })
  phoneNumber!: string;
}
