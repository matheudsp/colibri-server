import { SupabaseClientOptions } from '@supabase/supabase-js';

export interface SupabaseCustomConfig {
  supabaseUrl: string;
  supabaseKey: string;
  options?: SupabaseClientOptions<never>;
}
