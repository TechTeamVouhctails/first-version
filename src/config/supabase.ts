import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "./env.js";

export const supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const jwks = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));

export async function verifySupabaseJwt(token: string) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `${env.SUPABASE_URL}/auth/v1`
  });
  return payload;
}
