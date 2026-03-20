// --- CONFIGURATION ---
const SUPABASE_URL = 'https://qpbjxurwrzsatwfiqcdd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwYmp4dXJ3cnpzYXR3ZmlxY2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTEzNjQsImV4cCI6MjA4NjgyNzM2NH0.2fee2Tke8VDwYCl8ba7wR8iLdOleHAhtO3oP17NhEOA';

let supabaseClient = null;

// --- THEME ENGINE ---
let currentTheme = localStorage.getItem('site-theme') || 'dark';

window.applyTheme = function (theme) {
    if (theme === 'light') { document.body.classList.add('light-mode'); }
    else { document.body.classList.remove('light-mode'); }
};

window.toggleTheme = function (e) {
    if (e) e.preventDefault();
    const newTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
    localStorage.setItem('site-theme', newTheme);
    currentTheme = newTheme;
    applyTheme(newTheme);
    document.querySelectorAll('.theme-toggle').forEach(el => {
        el.innerHTML = newTheme === 'light' ? '🌙' : '☀️';
        if (window.gsap) gsap.fromTo(el, { rotation: -180, scale: 0.5 }, { rotation: 0, scale: 1, duration: 0.8, ease: "back.out(2)" });
    });
};

applyTheme(currentTheme);

// --- APP INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    injectUniversalHeader();
    initNexusCursor(); // Run this early!

    // Load Supabase SDK if missing
    if (typeof window.supabase === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        document.head.appendChild(s);
        s.onload = () => initializeSupabase();
    } else {
        initializeSupabase();
    }
});

function initializeSupabase() {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    checkGlobalAuth();
    initDatabaseSync();
}

// --- CURSOR ENGINE (FIXED) ---
function initNexusCursor() {
    if (document.querySelector('.custom-cursor')) return;

    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    cursor.appendChild(dot);
    document.body.appendChild(cursor);

    const style = document.createElement('style');
    style.innerHTML = `
        /* Hide real cursor on body, but only if custom cursor is active */
        body, html, a, button, .interactable { 
            cursor: none !important; 
        }
        
        .custom-cursor {
            position: fixed; width: 40px; height: 40px; border: 1.5px solid rgba(255,255,255,0.4);
            border-radius: 50%; pointer-events: none; z-index: 99999999;
            display: flex; align-items: center; justify-content: center;
            top: 0; left: 0; pointer-events: none;
            backdrop-filter: blur(4px); transition: width 0.3s, height 0.3s, background 0.3s, border-color 0.3s;
            mix-blend-mode: normal;
            box-shadow: 0 0 20px rgba(0, 162, 255, 0.1);
            transform: translate(-50%, -50%);
        }
        .cursor-dot { width: 5px; height: 5px; background: #fff; border-radius: 50%; }
        body.light-mode .custom-cursor { border-color: rgba(0,0,0,0.4); }
        body.light-mode .cursor-dot { background: #000; }
        
        .custom-cursor.active { 
            width: 80px; height: 80px; 
            background: rgba(255,255,255,0.1); 
            border-color: rgba(255,255,255,0.9); 
            backdrop-filter: blur(10px);
        }
    `;
    document.head.appendChild(style);

    window.addEventListener('mousemove', (e) => {
        if (window.gsap) {
            gsap.to(cursor, { x: e.clientX, y: e.clientY, duration: 0.1, ease: 'power2.out' });
        } else {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        }
    });

    document.addEventListener('mouseover', (e) => {
        if (e.target.closest('a, button, .interactable, input')) {
            cursor.classList.add('active');
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('a, button, .interactable, input')) {
            cursor.classList.remove('active');
        }
    });
}

// --- AUTH & SYNC ---
async function checkGlobalAuth() {
    const authNav = document.getElementById('auth-nav'); 
    if (!authNav) return;
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            const user = session.user;
            const name = user.user_metadata.full_name || user.email.split('@')[0];
            authNav.innerHTML = `<a href="profile.html?user=${name}" class="nav-item interactable" style="color:#00A2FF; font-weight:900;">@${name}</a>
                                 <a href="#" onclick="logoutNexus()" class="nav-item interactable" style="opacity:0.4; font-size:0.7rem;">LOGOUT</a>`;
        } else {
            authNav.innerHTML = `<a href="auth.html" class="nav-item interactable" style="background:#fff; color:#000; padding:8px 20px; border-radius:100px;">Login</a>`;
        }
    } catch (e) { console.log("Auth Error:", e); }
}

window.logoutNexus = async () => { 
    if (window.supabaseClient) await window.supabaseClient.auth.signOut(); 
    location.reload(); 
};

function injectUniversalHeader() {
    let header = document.querySelector('.header');
    if (!header) { header = document.createElement('header'); header.className = 'header'; document.body.prepend(header); }
    const path = window.location.pathname.split('/').pop() || 'index.html';
    header.innerHTML = `
        <a href="index.html" class="logo interactable">ADIYAN<span>.</span>NEXUS</a>
        <nav class="nav-links">
            <a href="index.html" class="nav-item ${path === 'index.html' ? 'active' : ''}">Nexus</a>
            <a href="threads.html" class="nav-item ${path === 'threads.html' ? 'active' : ''}">Threads</a>
            <a href="discuss.html" class="nav-item ${path === 'discuss.html' ? 'active' : ''}">Discuss</a>
            <button class="nav-item interactable theme-toggle" onclick="toggleTheme(event)">${currentTheme === 'light' ? '🌙' : '☀️'}</button>
            <div id="auth-nav"></div>
        </nav>
    `;
}

async function initDatabaseSync() {
    if (!window.supabaseClient) return;
    // Database logic here
}
