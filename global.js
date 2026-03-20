const SUPABASE_URL = 'https://qpbjxurwrzsatwfiqcdd.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwYmp4dXJ3cnpzYXR3ZmlxY2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTEzNjQsImV4cCI6MjA4NjgyNzM2NH0.2fee2Tke8VDwYCl8ba7wR8iLdOleHAhtO3oP17NhEOA'; 

let supabaseClient = null;

// --- THEME INITIALIZATION ---
let currentTheme = localStorage.getItem('site-theme') || 'dark';

window.applyTheme = function(theme) {
    if (theme === 'light') { document.body.classList.add('light-mode'); } 
    else { document.body.classList.remove('light-mode'); }
};

window.toggleTheme = function(e) {
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

// --- GLOBAL INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    injectUniversalHeader();
    
    const headerCheck = setInterval(() => {
        if (!document.querySelector('.header')) injectUniversalHeader();
    }, 2000);
    setTimeout(() => clearInterval(headerCheck), 10000);

    if(typeof window.supabase === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        document.head.appendChild(s);
        s.onload = () => {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            checkGlobalAuth();
            initDatabaseSync();
        };
    } else {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        checkGlobalAuth();
        initDatabaseSync();
    }
    
    // Safety: Initialize cursor as early as possible
    initNexusCursor();
});

// --- PERSISTENCE ENGINE (SUPABASE SYNC) ---
async function initDatabaseSync() {
    if(!window.supabaseClient) return;
    
    window.saveThreadToCloud = async (postData) => {
        try {
            const { error } = await window.supabaseClient
                .from('threads')
                .insert([{ 
                    content: postData.text, 
                    author: postData.user, 
                    avatar: postData.pic,
                    timestamp: new Date().toISOString()
                }]);
            if(error) console.error("Cloud Error:", error);
        } catch(e) {}
    };

    window.loadCloudThreads = async () => {
        try {
            const { data, error } = await window.supabaseClient
                .from('threads')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(50);
            return data || [];
        } catch(e) { return []; }
    };
}

function injectUniversalHeader() {
    let header = document.querySelector('.header');
    if(!header) { header = document.createElement('header'); header.className = 'header'; document.body.prepend(header); }
    const path = window.location.pathname.split('/').pop() || 'index.html';
    header.innerHTML = `
        <a href="index.html" class="logo interactable">ADIYAN<span>.</span>NEXUS</a>
        <nav class="nav-links">
            <a href="index.html" class="nav-item ${path === 'index.html' ? 'active' : ''}">Nexus</a>
            <a href="threads.html" class="nav-item ${path === 'threads.html' ? 'active' : ''}">Threads</a>
            <a href="discuss.html" class="nav-item ${path === 'discuss.html' ? 'active' : ''}">Discuss</a>
            <a href="roblox.html" class="nav-item ${path === 'roblox.html' ? 'active' : ''}">Roblox</a>
            <div id="auth-nav"></div>
            <button class="nav-item interactable theme-toggle" onclick="toggleTheme(event)">${currentTheme === 'light' ? '🌙' : '☀️'}</button>
        </nav>
    `;
    if(window.gsap) gsap.to(header, { y: 0, opacity: 1, duration: 1, ease: 'power4.out', startAt: {y: -100, opacity: 0} });
}

function initNexusCursor() {
    // If a cursor already exists, don't double up
    if(document.querySelector('.custom-cursor')) return;

    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    cursor.appendChild(dot);
    document.body.appendChild(cursor);

    // GLASS ZOOM EFFECT CSS
    const style = document.createElement('style');
    style.innerHTML = `
        .custom-cursor {
            position: fixed; width: 40px; height: 40px; border: 1.5px solid rgba(255,255,255,0.4);
            border-radius: 50%; pointer-events: none; z-index: 9999999;
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(4px); transition: width 0.3s, height 0.3s, background 0.3s, border-color 0.3s, backdrop-filter 0.3s;
            mix-blend-mode: normal; transform: translate(-50%, -50%);
            box-shadow: 0 0 20px rgba(0, 162, 255, 0.1);
        }
        .cursor-dot { width: 5px; height: 5px; background: #fff; border-radius: 50%; box-shadow: 0 0 10px rgba(255,255,255,0.8); }
        body.light-mode .custom-cursor { border-color: rgba(0,0,0,0.4); backdrop-filter: blur(8px) contrast(0.8); }
        body.light-mode .cursor-dot { background: #000; }
        
        /* HOVER / GLASS ZOOM STATE */
        .custom-cursor.active { 
            width: 90px; height: 90px; 
            background: rgba(255,255,255,0.05); 
            border-color: rgba(255,255,255,0.8); 
            backdrop-filter: blur(15px) brightness(1.2); 
            box-shadow: 0 0 40px rgba(0, 162, 255, 0.3);
        }
        
        * { cursor: none !important; }
        @media (max-width: 1024px) { .custom-cursor { display: none; } * { cursor: auto !important; } }
    `;
    document.head.appendChild(style);

    window.addEventListener('mousemove', (e) => {
        if(window.gsap) {
            gsap.to(cursor, { x: e.clientX, y: e.clientY, duration: 0.15, ease: 'power2.out' });
        } else {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        }
    });

    // Delegated Hover Listener for better performance
    document.addEventListener('mouseenter', (e) => {
        const target = e.target;
        if(target.classList.contains('interactable') || target.tagName === 'A' || target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('.user-card')) {
            cursor.classList.add('active');
            gsap.to(dot, { scale: 1.5, duration: 0.3 });
        }
    }, true);
    
    document.addEventListener('mouseleave', (e) => {
        const target = e.target;
        if(target.classList.contains('interactable') || target.tagName === 'A' || target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('.user-card')) {
            cursor.classList.remove('active');
            gsap.to(dot, { scale: 1, duration: 0.3 });
        }
    }, true);
}

async function checkGlobalAuth() {
    const authNav = document.getElementById('auth-nav'); if(!authNav) return;
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
    } catch(e) {}
}

window.logoutNexus = async () => { if(window.supabaseClient) await window.supabaseClient.auth.signOut(); localStorage.removeItem('rbx_user'); location.reload(); };

function showNotification(text, type='info') {
    const toast = document.createElement('div'); toast.innerText = text;
    Object.assign(toast.style, { position: 'fixed', bottom: '40px', right: '40px', background: type==='info'?'#00A2FF':'#ff3366', color: '#fff', padding: '18px 40px', borderRadius: '100px', fontWeight: '900', zIndex: '999999' });
    document.body.appendChild(toast);
    if(window.gsap) { gsap.from(toast, { x: 100, opacity: 0, duration: 1 }); setTimeout(() => gsap.to(toast, { opacity: 0, y: 50, duration: 1, onComplete: () => toast.remove() }), 4000); } else setTimeout(() => toast.remove(), 4000);
}

try {
    if (typeof Ably !== 'undefined') {
        const ablyClient = new Ably.Realtime('I2GocA.2XM7TQ:nuJQeyu7st5NRAjpGZKS00fjwc4qbCRGioyS_ERGTdc');
        const globalSync = ablyClient.channels.get('site-global-config');
        globalSync.subscribe('config_update', (msg) => { if (msg.data.action === 'announcement') showNotification(msg.data.value); });
    }
} catch (e) {}
