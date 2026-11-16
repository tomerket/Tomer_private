import { createClient } from '@supabase/supabase-js';

// Browser client: used only for admin email/password auth.
// All data goes through our Node API (/api), never directly to the database.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
