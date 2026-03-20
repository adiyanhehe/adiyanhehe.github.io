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
    if(typeof window.supabase === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        document.head.appendChild(s);
        s.onload = () => {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            checkGlobalAuth();
        };
    } else {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        checkGlobalAuth();
    }

    // Theme Toggle Injection
    const hasToggle = document.querySelector('.theme-toggle');
    const navLinks = document.querySelector('.nav-links');
    const container = navLinks || document.body;
    const toggler = document.createElement('button');
    toggler.className = 'nav-item interactable theme-toggle';
    toggler.innerHTML = currentTheme === 'light' ? '🌙' : '☀️';
    toggler.onclick = window.toggleTheme;
    if(!hasToggle) container.appendChild(toggler);
});

async function checkGlobalAuth() {
    const authNav = document.getElementById('auth-nav');
    if(!authNav) return;
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) {
        const user = session.user;
        const name = user.user_metadata.full_name || user.email.split('@')[0];
        const pic = user.user_metadata.avatar_url || 'https://via.placeholder.com/100';
        localStorage.setItem('rbx_user', name);
        localStorage.setItem('rbx_pic', pic);

        // Fetch Extended Profile from Supabase 'profiles' table
        const { data: profile } = await window.supabaseClient.from('profiles').select('*').eq('id', user.id).single();
        if(profile) {
            localStorage.setItem('rbx_pic', profile.avatar_url || pic);
            localStorage.setItem('rbx_bio', profile.bio || '');
        }

        authNav.innerHTML = `<a href="profile.html?user=${name}" class="nav-item interactable">@${name}</a>
                             <a href="#" onclick="logoutNexus()" class="nav-item interactable" style="opacity:0.6;">Logout</a>`;
    } else {
        authNav.innerHTML = `<a href="auth.html?mode=register&redirect=${window.location.pathname.split('/').pop()}" class="nav-item interactable" style="background:var(--text-main); color:var(--bg); padding:5px 15px; border-radius:100px;">Join Nexus</a>`;
    }
}

window.logoutNexus = async () => {
    if(window.supabaseClient) await window.supabaseClient.auth.signOut();
    localStorage.removeItem('rbx_user');
    localStorage.removeItem('rbx_pic');
    location.reload();
};

// --- GLOBAL TOASTS ---
function showNotification(text, type='info') {
    const toast = document.createElement('div');
    toast.innerText = text;
    Object.assign(toast.style, {
        position: 'fixed', bottom: '40px', right: '40px', background: type==='info'?'#00A2FF':'#ff3366',
        color: '#fff', padding: '18px 40px', borderRadius: '100px', fontWeight: '900',
        zIndex: '999999', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', pointerEvents: 'none'
    });
    document.body.appendChild(toast);
    if(window.gsap) {
        gsap.from(toast, { x: 100, opacity: 0, duration: 1, ease: "expo.out" });
        setTimeout(() => gsap.to(toast, { opacity: 0, y: 50, duration: 1, onComplete: () => toast.remove() }), 4000);
    } else setTimeout(() => toast.remove(), 4000);
}

// --- REALTIME ABLY SYNC ---
try {
    if (typeof Ably !== 'undefined') {
        const ablyClient = new Ably.Realtime('I2GocA.2XM7TQ:nuJQeyu7st5NRAjpGZKS00fjwc4qbCRGioyS_ERGTdc');
        const globalSync = ablyClient.channels.get('site-global-config');
        globalSync.subscribe('config_update', (msg) => {
            const d = msg.data;
            if (d.action === 'set_theme') toggleTheme();
            if (d.action === 'announcement') showNotification(d.value);
        });
    }
} catch (e) {}
