import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabasePublishableKey) {
  throw new Error("Missing env.SUPABASE_PUBLISHABLE_KEY");
}

// Client-side/public Supabase client
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Server-side admin/secret Supabase client
export const createServerSupabaseClient = () => {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing env.SUPABASE_SECRET_KEY");
  }
  return createClient(supabaseUrl, secretKey);
};
