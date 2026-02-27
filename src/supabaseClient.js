import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wqzbcezhpymndbraijcb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxemJjZXpocHltbmRicmFpamNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjkyNTQsImV4cCI6MjA4NjU0NTI1NH0.0Pc7o9CYZvN8nUYjd_7CEUxrZtD1kMaB48IeMgliBvQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);