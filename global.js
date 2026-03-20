const SUPABASE_URL = 'https://qpbjxurwrzsatwfiqcdd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwYmp4dXJ3cnpzYXR3ZmlxY2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTEzNjQsImV4cCI6MjA4NjgyNzM2NH0.2fee2Tke8VDwYCl8ba7wR8iLdOleHAhtO3oP17NhEOA';

let supabaseClient = null;

// --- THEME ENGINE ---
let currentTheme = localStorage.getItem('site-theme') || 'dark';

window.applyTheme = function (theme) {
    if (theme === 'light') { document.body.classList.add('light-mode'); }
    else { document.body.classList.remove('light-mode'); }
};

// --- AUTH & ROLES ---
window.isAdmin = (u) => u === 'adigusi';
window.isVerified = (u) => ['adigusi', 'Adiyan'].includes(u); // Added a few verified users for demo

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

// --- REPORTING SYSTEM ---
window.reportContent = async (type, id, data) => {
    console.log(`Reporting ${type} (${id}):`, data);
    // Store reports in localStorage as a fallback/demo
    let reports = JSON.parse(localStorage.getItem('nexus_reports') || '[]');
    reports.push({ type, id, data, timestamp: new Date().toISOString(), reporter: localStorage.getItem('rbx_user') });
    localStorage.setItem('nexus_reports', JSON.stringify(reports));
    
    // If Supabase is available, we could try to push to a 'reports' table
    if (window.supabaseClient) {
        try {
            await window.supabaseClient.from('reports').insert([{
                content_type: type,
                content_id: id,
                content_data: JSON.stringify(data),
                reporter: localStorage.getItem('rbx_user')
            }]);
        } catch (e) { console.error("Cloud Report Failed", e); }
    }

    if (window.showNotification) {
        showNotification(`Transmission reported to network security.`, 'info');
    }
};


// --- PROFILE SUMMARY SYSTEM ---
window.showProfileSummary = async (username) => {
    if (!username) return;
    let modal = document.getElementById('psm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'psm-modal';
        Object.assign(modal.style, {
            position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.9)', zIndex: '1000005',
            display: 'none', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)',
            transition: '0.4s', opacity: '0'
        });
        modal.onclick = (e) => { if (e.target === modal) closeProfileSummary(); };
        modal.innerHTML = `
            <div id="psm-box" style="background:#0a0a0a; width:360px; padding:35px; border-radius:32px; border:1px solid rgba(255,255,255,0.08); text-align:center; transform:translateY(20px); transition:0.5s cubic-bezier(0.2, 0.8, 0.2, 1); box-shadow:0 40px 80px rgba(0,0,0,0.6);">
                <div id="psm-banner" style="height:90px; background:linear-gradient(45deg, #111, #222); border-radius:24px; margin-bottom:-45px;"></div>
                <img id="psm-pfp" src="https://via.placeholder.com/100" style="width:100px; height:100px; border-radius:26px; border:6px solid #0a0a0a; position:relative; z-index:2; object-fit:cover; background:#111;">
                <h2 id="psm-name" style="margin-top:10px; font-weight:900; letter-spacing:-1.2px; font-size:1.6rem; color:#fff;">...</h2>
                <p id="psm-handle" style="color:#00A2FF; font-weight:800; font-size:0.8rem; margin-bottom:10px; opacity:0.8;">@...</p>
                <p id="psm-bio" style="color:#888; font-size:0.9rem; line-height:1.5; margin-bottom:20px; min-height:40px; padding:0 10px;">Syncing record...</p>
                <div style="display:flex; gap:10px;">
                    <button id="psm-dm-btn" style="flex:1; padding:12px; border-radius:12px; border:none; background:#fff; color:#000; font-weight:900; cursor:pointer;">Message</button>
                    <button id="psm-profile-btn" style="flex:1; padding:12px; border-radius:12px; border:1px solid #333; background:transparent; color:#fff; font-weight:900; cursor:pointer;">Profile</button>
                </div>
                <button onclick="closeProfileSummary()" style="margin-top:20px; background:none; border:none; color:#444; font-weight:900; cursor:pointer; font-size:0.7rem; letter-spacing:1px; text-transform:uppercase;">Dismiss</button>
            </div>`;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; document.getElementById('psm-box').style.transform = 'translateY(0)'; }, 10);
    document.getElementById('psm-name').innerText = username;
    document.getElementById('psm-handle').innerText = '@' + username.toLowerCase().replace(/\s/g, '');
    if (window.supabaseClient) { window.supabaseClient.from('profiles').select('*').eq('username', username).maybeSingle().then(({data}) => {
        if (data) {
            document.getElementById('psm-pfp').src = data.avatar_url || 'https://via.placeholder.com/100';
            document.getElementById('psm-bio').innerText = data.bio || 'New entity detected.';
            document.getElementById('psm-banner').style.background = data.banner_color || 'linear-gradient(45deg, #111, #222)';
        }
    }); }
    document.getElementById('psm-dm-btn').onclick = () => { closeProfileSummary(); location.href = `discuss.html?dm=${encodeURIComponent(username)}`; };
    document.getElementById('psm-profile-btn').onclick = () => { location.href = `profile.html?user=${encodeURIComponent(username)}`; };
};
window.closeProfileSummary = () => {
    const modal = document.getElementById('psm-modal');
    if (modal) { modal.style.opacity = '0'; document.getElementById('psm-box').style.transform = 'translateY(20px)'; setTimeout(() => modal.style.display = 'none', 400); }
};

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
