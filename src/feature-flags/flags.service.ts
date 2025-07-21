import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FlagsService {
  private readonly flags: Record<string, boolean>;

  constructor(private readonly configService: ConfigService) {
    this.flags = {
      enableNewFeature: false,
      experimentalMode: false,
      ...this.loadFlagsFromConfig(),
    };
  }

  private loadFlagsFromConfig(): Record<string, boolean> {
    try {
      const flagsConfig = this.configService.get<string>('FEATURE_FLAGS');
      if (!flagsConfig) {
        return {};
      }

      const parsed = JSON.parse(flagsConfig) as Record<string, unknown>;

      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid FEATURE_FLAGS format');
      }

      const flags: Record<string, boolean> = {};
      for (const key of Object.keys(parsed)) {
        flags[key] = Boolean(parsed[key]);
      }

      return flags;
    } catch (error) {
      console.error('Error loading feature flags:', error);
      return {};
    }
  }

  isEnabled(flagName: string): boolean {
    return this.flags[flagName] === true;
  }

  getAllFlags(): Record<string, boolean> {
    return this.flags;
  }

  setFlag(flagName: string, enabled: boolean): void {
    if (typeof enabled !== 'boolean') {
      throw new Error('Flag value must be boolean');
    }
    this.flags[flagName] = enabled;
  }
}
