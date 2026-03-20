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

    // Safety reveal for mouse if cursor failed
    document.body.style.cursor = 'auto';

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
    try {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        checkGlobalAuth();
        initDatabaseSync();
    } catch (e) { console.error("Supabase Init Failed", e); }
}

// --- DATABASE ARCHIVE LOGIC ---
async function initDatabaseSync() {
    if (!window.supabaseClient) return;

    // GLOBAL CLOUD SAVE FUNCTION
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
            if (error) console.error("Archive Error:", error);
        } catch (e) { console.error("Cloud Push Failed", e); }
    };

    // GLOBAL CLOUD LOAD FUNCTION
    window.loadCloudThreads = async () => {
        try {
            const { data, error } = await window.supabaseClient
                .from('threads')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(50);
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error("Cloud Fetch Failed", e);
            return [];
        }
    };
}

// --- HEADER ENGINE ---
function injectUniversalHeader() {
    let header = document.querySelector('.header');
    if (!header) {
        header = document.createElement('header');
        header.className = 'header';
        document.body.prepend(header);
    }
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
    if (window.gsap) {
        gsap.to(header, { y: 0, opacity: 1, duration: 1, ease: 'power4.out', startAt: { y: -100, opacity: 0 } });
    }
}

// --- AUTH ENGINE ---
async function checkGlobalAuth() {
    const authNav = document.getElementById('auth-nav');
    if (!authNav) return;
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            const user = session.user;
            const name = user.user_metadata.full_name || user.email.split('@')[0];
            const pic = user.user_metadata.avatar_url || 'https://via.placeholder.com/100';

            // Sync to legacy storage for older components
            localStorage.setItem('rbx_user', name);
            localStorage.setItem('rbx_pic', pic);

            authNav.innerHTML = `<a href="profile.html?user=${name}" class="nav-item interactable" style="color:#00A2FF; font-weight:900;">@${name}</a>
                                 <a href="#" onclick="logoutNexus()" class="nav-item interactable" style="opacity:0.4; font-size:0.7rem;">LOGOUT</a>`;
        } else {
            authNav.innerHTML = `<a href="auth.html" class="nav-item interactable" style="background:#fff; color:#000; padding:8px 20px; border-radius:100px;">Login</a>`;
        }
    } catch (e) { console.log("Auth Error:", e); }
}

async function logoutNexus() {
    if (window.supabaseClient) await window.supabaseClient.auth.signOut();
    localStorage.removeItem('rbx_user');
    localStorage.removeItem('rbx_pic');
    location.reload();
}

// --- GLOBAL NOTIFICATIONS ---
function showNotification(text, type = 'info') {
    const toast = document.createElement('div');
    toast.innerText = text;
    Object.assign(toast.style, {
        position: 'fixed', bottom: '40px', right: '40px', background: type === 'info' ? '#00A2FF' : '#ff3366',
        color: '#fff', padding: '18px 40px', borderRadius: '100px', fontWeight: '900', zIndex: '999999'
    });
    document.body.appendChild(toast);
    if (window.gsap) {
        gsap.from(toast, { x: 100, opacity: 0, duration: 1 });
        setTimeout(() => gsap.to(toast, { opacity: 0, y: 50, duration: 1, onComplete: () => toast.remove() }), 4000);
    } else {
        setTimeout(() => toast.remove(), 4000);
    }
}


window.addEventListener('DOMContentLoaded', () => {
    injectUniversalHeader();

    // FORCED REVEAL: This kills any "cursor: none" from CSS
    const cursorReset = document.createElement('style');
    cursorReset.innerHTML = `
        * { cursor: auto !important; } 
        a, button, .interactable { cursor: pointer !important; }
    `;
    document.head.appendChild(cursorReset);

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
