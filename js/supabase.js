'use strict';

// ============ SUPABASE CLIENT ============
// supabase-js is vendored as a UMD build loaded via <script> in index.html,
// which defines the global `window.supabase`. We read createClient from it so
// the app shell (and this module graph) loads offline without a CDN import.

const SUPABASE_URL = 'https://nocvwdbxekvmdwrukrpq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xjwd5XX9SweLgmsSpNzj8g_7szUqrNX';

const lib = (typeof window !== 'undefined') ? window.supabase : null;

export const supabase = lib
    ? lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
    })
    : null;

if (!supabase) {
    console.warn('[supabase] vendored client not found (window.supabase missing)');
}

export function getUser() { return supabase.auth.getUser(); }
export function getSession() { return supabase.auth.getSession(); }
export function onAuthChange(cb) { return supabase.auth.onAuthStateChange(cb); }
