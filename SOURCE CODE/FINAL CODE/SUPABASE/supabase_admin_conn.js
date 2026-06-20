import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://dzgtfwdqfqecetnfhcdi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z3Rmd2RxZnFlY2V0bmZoY2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTIyNzUsImV4cCI6MjA5NjMyODI3NX0.WChJiRoRkNY_7iWsGeA7gnCAS1hEB8045jfxR6TZ-IE';

export const _supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: 'sb-admin-auth-token',
    persistSession: true,
    autoRefreshToken: true
  }
});