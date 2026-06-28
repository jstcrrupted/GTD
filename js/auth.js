'use strict';

// ============ AUTH (Supabase email/password) ============
import { $, state, toast, icon, setSyncStatus } from './core.js';
import { supabase, getSession } from './supabase.js';
import { setUser, hydrate, initSyncHooks, resetSync } from './sync.js';
import { subscribeRealtime, unsubscribeRealtime } from './realtime.js';
import { render } from './render.js';
import { saveNow } from './storage.js';

let mode = 'signin'; // 'signin' | 'signup'

function authError(msg) {
    const el = $('#authError');
    if (el) el.textContent = msg || '';
}
function setAuthBusy(busy) {
    const btn = $('#authSubmitBtn');
    if (btn) btn.disabled = busy;
}

export function renderAuth() {
    const el = $('#authOverlay');
    if (!el) return;
    const isSignup = mode === 'signup';
    el.innerHTML = `
        <div class="auth-card">
            <div class="auth-logo">
                <span class="auth-logo-icon">${icon('zap')}</span>
                <span>GTD Pro</span>
            </div>
            <h2 class="auth-title">${isSignup ? 'Создать аккаунт' : 'Вход'}</h2>
            <p class="auth-sub">${isSignup ? 'Зарегистрируйтесь для синхронизации между устройствами.' : 'Войдите, чтобы синхронизировать задачи.'}</p>
            <input type="email" id="authEmail" class="auth-input" placeholder="Email" autocomplete="email">
            <input type="password" id="authPassword" class="auth-input" placeholder="Пароль" autocomplete="${isSignup ? 'new-password' : 'current-password'}" data-action="${isSignup ? 'signUp' : 'signIn'}" data-on="enter">
            <div class="auth-err" id="authError"></div>
            <button class="auth-submit" id="authSubmitBtn" data-action="${isSignup ? 'signUp' : 'signIn'}">${isSignup ? 'Зарегистрироваться' : 'Войти'}</button>
            <div class="auth-toggle">
                ${isSignup ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}
                <a data-action="toggleAuthMode">${isSignup ? 'Войти' : 'Зарегистрироваться'}</a>
            </div>
        </div>
    `;
}

export function showAuth() {
    mode = 'signin';
    renderAuth();
    $('#authOverlay').classList.add('active');
    setTimeout(() => { const e = $('#authEmail'); if (e) e.focus(); }, 50);
}

export function hideAuth() {
    $('#authOverlay').classList.remove('active');
}

export function toggleAuthMode() {
    mode = mode === 'signin' ? 'signup' : 'signin';
    renderAuth();
    setTimeout(() => { const e = $('#authEmail'); if (e) e.focus(); }, 30);
}

function creds() {
    return {
        email: ($('#authEmail').value || '').trim(),
        password: $('#authPassword').value || ''
    };
}

export async function signIn() {
    const { email, password } = creds();
    if (!email || !password) { authError('Введите email и пароль'); return; }
    authError(''); setAuthBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);
    if (error) { authError(error.message); return; }
    await startSession(data.session);
}

export async function signUp() {
    const { email, password } = creds();
    if (!email || !password) { authError('Введите email и пароль'); return; }
    authError(''); setAuthBusy(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setAuthBusy(false);
    if (error) { authError(error.message); return; }
    if (data.session) {
        await startSession(data.session);            // project has confirmation disabled
    } else {
        mode = 'signin';
        renderAuth();
        authError('Аккаунт создан. Подтвердите email из письма, затем войдите.');
        toast('Проверьте почту для подтверждения', 'info');
    }
}

export async function signOut() {
    try { await supabase.auth.signOut(); } catch (e) { console.warn(e); }
    unsubscribeRealtime();
    resetSync();                 // clears userId so the cache write below won't push
    state.tasks = [];
    state.projects = [];
    state.tags = [];
    state.selectedTaskId = null;
    state.currentView = 'inbox';
    // Clear the IndexedDB cache so a different user signing in next doesn't
    // inherit (and push up) the previous user's data.
    try { await saveNow(); } catch (e) { /* ignore */ }
    render();
    showAuth();
    toast('Вы вышли из аккаунта');
}

async function startSession(session) {
    if (!session || !session.user) { showAuth(); return; }
    hideAuth();
    setUser(session.user.id);
    setSyncStatus('Синхронизация…', true);
    await hydrate();
    subscribeRealtime(session.user.id);
}

// On load: hydrate if a session exists, else show the auth screen.
export async function initAuth() {
    initSyncHooks();
    if (!supabase) { showAuth(); authError('Supabase недоступен'); return; }
    try {
        const { data } = await getSession();
        if (data && data.session) await startSession(data.session);
        else showAuth();
    } catch (e) {
        console.error('[auth] init failed', e);
        showAuth();
    }
}
