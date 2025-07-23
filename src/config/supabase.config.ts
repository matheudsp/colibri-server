import { ConfigService } from '@nestjs/config';
import { SupabaseCustomConfig } from '../common/interfaces/supabase-config.interface';

export const supabaseConfig = (
  configService: ConfigService,
): SupabaseCustomConfig => {
  return {
    supabaseUrl: configService.get<string>('SUPABASE_URL', ''),
    supabaseKey: configService.get<string>('SUPABASE_KEY', ''),
    options: {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    },
  };
};
