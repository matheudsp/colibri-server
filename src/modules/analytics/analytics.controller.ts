import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@Roles(ROLES.ADMIN, ROLES.LOCADOR)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('rent-income')
  @ApiOperation({ summary: 'Get monthly rent income for a given period' })
  getRentIncome(
    @CurrentUser() currentUser: JwtPayload,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getRentIncome(currentUser, period);
  }

  @Get('tenants-status')
  @ApiOperation({ summary: 'Get tenants status' })
  getTenantsStatus(@CurrentUser() currentUser: JwtPayload) {
    return this.analyticsService.getTenantsStatus(currentUser);
  }

  @Get('payments-summary')
  @ApiOperation({ summary: 'Get payments summary for a given period' })
  getPaymentsSummary(
    @CurrentUser() currentUser: JwtPayload,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getPaymentsSummary(currentUser, period);
  }

  @Get('properties-occupancy')
  @ApiOperation({ summary: 'Get current properties occupancy' })
  getPropertiesOccupancy(@CurrentUser() currentUser: JwtPayload) {
    return this.analyticsService.getPropertiesOccupancy(currentUser);
  }

  @Get('marketing-summary')
  @Roles(ROLES.ADMIN)
  @ApiOperation({
    summary: 'Obtém um resumo das respostas da pesquisa de marketing',
  })
  getMarketingSummary() {
    return this.analyticsService.getMarketingSurveySummary();
  }
}
