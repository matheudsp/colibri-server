import { ApiProperty } from '@nestjs/swagger';

export class CreateAsaasCustomerDto {
  @ApiProperty()
  externalReference!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  cpfCnpj!: string;
  @ApiProperty()
  email!: string;
  @ApiProperty()
  phone!: string;
  @ApiProperty()
  notificationDisabled!: boolean;
}
