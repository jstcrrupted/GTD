'use strict';

// ============ REALTIME: incoming changes from Supabase ============
import { supabase } from './supabase.js';
import { applyRemote } from './sync.js';

let channel = null;

function handler(table) {
    return (payload) => {
        // soft-deletes are UPDATEs (deleted_at set), so payload.new carries the row;
        // fall back to payload.old for any true DELETE.
        const row = (payload.new && Object.keys(payload.new).length) ? payload.new : payload.old;
        if (row) applyRemote(table, row);
    };
}

export async function subscribeRealtime(userId) {
    if (channel || !userId) return;
    // Realtime needs the user's JWT so RLS-filtered postgres_changes are delivered.
    try {
        const { data } = await supabase.auth.getSession();
        const token = data && data.session && data.session.access_token;
        if (token && supabase.realtime && supabase.realtime.setAuth) supabase.realtime.setAuth(token);
    } catch (e) { console.warn('[realtime] setAuth failed', e); }

    channel = supabase.channel('gtd-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks',    filter: `user_id=eq.${userId}` }, handler('tasks'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` }, handler('projects'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tags',     filter: `user_id=eq.${userId}` }, handler('tags'))
        .subscribe((status) => console.log('[realtime] channel:', status));
}

export function unsubscribeRealtime() {
    if (channel) { supabase.removeChannel(channel); channel = null; }
}
