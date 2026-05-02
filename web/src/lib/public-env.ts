function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Copy web/.env.example to web/.env.local and set values.`);
  }
  return value;
}

export const publicEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787/api",
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:8787",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
};

export function requireSupabase() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", publicEnv.supabaseUrl),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", publicEnv.supabaseAnonKey)
  };
}

export function requireRazorpayKey() {
  return required("NEXT_PUBLIC_RAZORPAY_KEY_ID", publicEnv.razorpayKeyId);
}
