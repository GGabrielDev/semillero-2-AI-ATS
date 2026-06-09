import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabasePublishableKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or env.SUPABASE_PUBLISHABLE_KEY");
}

// Client-side/public Supabase client
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Server-side admin/secret Supabase client
export const createServerSupabaseClient = () => {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  
  // Use secret key if available and not a placeholder; otherwise fall back to publishable key
  const activeKey = (secretKey && secretKey !== "sb_secret_your_secret_key") 
    ? secretKey 
    : publishableKey;

  if (!activeKey) {
    throw new Error("Missing env.SUPABASE_SECRET_KEY or SUPABASE_PUBLISHABLE_KEY");
  }
  return createClient(supabaseUrl, activeKey);
};
