import { ApiProperty } from '@nestjs/swagger';

export class CreateAsaasCustomerDto {
  @ApiProperty()
  name!: string;
  @ApiProperty()
  cpfCnpj!: string;
  @ApiProperty()
  email!: string;
  @ApiProperty()
  phone!: string;
}
