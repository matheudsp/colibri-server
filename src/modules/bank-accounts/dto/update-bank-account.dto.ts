import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateBankAccountDto } from './create-bank-account.dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {
  @ApiProperty({
    description:
      'Token de verificação recebido após a confirmação do código OTP.',
  })
  @IsString()
  @IsNotEmpty()
  actionToken: string;
}
