import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { TransfersService } from './transfers.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { CreateManualTransferDto } from './dto/create-manual-transfer.dto';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import type { SearchTransferDto } from './dto/search-transfer.dto';

@ApiTags('Transfers')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}
  @Post('manual-payout')
  @Roles(ROLES.LOCADOR)
  @ApiOperation({
    summary:
      'Realiza um saque manual do saldo total da subconta para a chave PIX cadastrada',
  })
  createManualTransfer(
    @CurrentUser() currentUser: JwtPayload,
    @Body() createManualTransferDto: CreateManualTransferDto,
  ) {
    return this.transfersService.createManualTransfer(
      currentUser,
      createManualTransferDto,
    );
  }

  @Get('my-transfers')
  @ApiOperation({
    summary: 'Lista os repasses (transferências) para o usuário logado',
  })
  findUserTransfers(
    @CurrentUser() currentUser: JwtPayload,
    @Query() findUserTransfersDto: SearchTransferDto,
  ) {
    return this.transfersService.findUserTransfers(
      currentUser,
      findUserTransfersDto,
    );
  }
}
