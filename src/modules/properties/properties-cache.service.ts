import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from 'src/modules/cache/cache.service';

@Injectable()
export class PropertyCacheService {
  private readonly logger = new Logger(PropertyCacheService.name);
  private readonly AVAILABLE_PROPERTIES_LIST_KEY = 'list:properties_available';

  constructor(private readonly cacheService: CacheService) {}

  async clearPropertiesCache(landlordId: string): Promise<void> {
    this.logger.log(
      `Limpando cache de propriedades para o locador: ${landlordId}`,
    );
    await this.cacheService.delFromList(this.AVAILABLE_PROPERTIES_LIST_KEY);
    await this.cacheService.delFromList(`list:user_properties:${landlordId}`);
  }

  async clearAllAvailablePropertiesCache(): Promise<void> {
    this.logger.log(
      'Limpando toda a lista de cache de propriedades disponíveis...',
    );
    await this.cacheService.delFromList(this.AVAILABLE_PROPERTIES_LIST_KEY);
  }
}
