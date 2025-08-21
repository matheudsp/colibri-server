import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
} from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Controller('bank-accounts')
@RequireAuth()
@ApiBearerAuth()
@ApiTags('Bank Accounts')
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Post()
  @Roles(ROLES.LOCADOR)
  @ApiOperation({ summary: 'Create a bank-account' })
  @ApiBody({ type: CreateBankAccountDto })
  create(
    @Body() createBankAccountDto: CreateBankAccountDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.bankAccountsService.create(createBankAccountDto, currentUser);
  }

  @Get('balance')
  @Roles(ROLES.LOCADOR)
  @ApiOperation({ summary: "Get the user's payment gateway account balance" })
  getBalance(@CurrentUser() currentUser: JwtPayload) {
    return this.bankAccountsService.getBalance(currentUser);
  }

  @Get('my-account')
  @Roles(ROLES.LOCADOR)
  @ApiOperation({ summary: "Get the current user's bank account details" })
  findMyAccount(@CurrentUser() currentUser: JwtPayload) {
    return this.bankAccountsService.findMyAccount(currentUser);
  }

  @Patch()
  @Roles(ROLES.LOCADOR)
  @ApiOperation({ summary: "Update the current user's bank account" })
  @ApiBody({ type: UpdateBankAccountDto })
  update(
    @Body() updateBankAccountDto: UpdateBankAccountDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.bankAccountsService.update(updateBankAccountDto, currentUser);
  }
}
