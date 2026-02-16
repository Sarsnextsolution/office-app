import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wqzbcezhpymndbraijcb.supabase.co";
const supabaseAnonKey = "sb_publishable_CK-0_LyExXGollI2qK15kg_1-t8Urfr";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
