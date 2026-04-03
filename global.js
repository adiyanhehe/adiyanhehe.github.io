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
// --- AUTH & ROLES ---
window.isAdmin = (u, email = null) => {
    const adminEmails = ['adiyachowdhury8@gmail.com', 'adiyanhehe@gmail.com'];
    const activeEmail = email || localStorage.getItem('rbx_email');
    const dbAdmin = localStorage.getItem('rbx_is_admin') === 'true';
    return adminEmails.includes(activeEmail) || dbAdmin;
};
window.isVerified = (u) => {
    const defaultVerified = ['adigusi', 'Adiyan', 'adiyanhehe'];
    const dbVerified = localStorage.getItem('rbx_verified') === 'true';
    return defaultVerified.includes(u) || dbVerified;
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

    if (typeof window.supabase === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        document.head.appendChild(s);
        s.onload = () => initializeSupabase();
    } else {
        initializeSupabase();
    }

    // Global DM Listener
    const userMe = localStorage.getItem('rbx_user');
    if (userMe && typeof Ably !== 'undefined') {
        const ablyLink = new Ably.Realtime('I2GocA.2XM7TQ:nuJQeyu7st5NRAjpGZKS00fjwc4qbCRGioyS_ERGTdc');
        ablyLink.channels.get('dm-' + userMe).subscribe('ping', (m) => {
            if (!window.location.pathname.includes('discuss.html')) {
                if (window.showTopNotification) window.showTopNotification(`NEW DIRECT TRANSMISSION FROM @${m.data.user}`);
            }
        });

        // SITE-WIDE CONFIG & MODERATION SYNC
        const syncChan = ablyLink.channels.get('site-global-config');
        syncChan.subscribe('config_update', (m) => {
            const { action, value, target } = m.data;
            if (action === 'kick' && target === userMe) {
                alert("YOUR SESSION HAS BEEN TERMINATED BY SYSTEM_ADMIN.");
                logoutNexus();
            }
            if (action === 'set_theme') applyTheme(value);
            if (action === 'force_reload') location.reload();
            if (action === 'redirect' && value) location.href = value;
            if (action === 'announcement' && window.showTopNotification) window.showTopNotification(value, 'info');
            if (action === 'clear_chat' && window.location.pathname.includes('discuss.html')) {
                const logs = document.getElementById('chat-logs');
                if(logs) logs.innerHTML = '<div style="text-align:center; padding:20px; color:var(--accent); font-weight:900;">ADMIN: CHANNEL PURGED</div>';
            }
        });
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

    if (path === 'discuss.html') {
        header.innerHTML = `
            <a href="index.html" class="logo interactable" style="font-size: 1rem; opacity: 0.7;">&larr; EXIT CHAT</a>
            <nav class="nav-links">
                <div id="auth-nav"></div>
            </nav>
        `;
        header.style.setProperty('height', '48px', 'important'); // Enforce strict 48px height
        header.style.setProperty('padding', '0 20px', 'important');
        header.style.setProperty('background', '#111214', 'important');
    } else {
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
    }
    if (window.gsap) {
        gsap.to(header, { y: 0, opacity: 1, duration: 1, ease: 'power4.out', startAt: { y: -100, opacity: 0 } });
    }
}

// --- AUTH ENGINE ---
async function checkGlobalAuth() {
    const authNav = document.getElementById('auth-nav');
    if (!authNav) return;
    try {
        // First check if we have a valid session
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        
        if (session) {
            const user = session.user;
            console.log('User session found:', user.email);
            
            // Fetch profile
            const { data: profile, error: profileError } = await window.supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            
            if (profileError) {
                console.error('Profile fetch error:', profileError);
            }
            
            if (profile && profile.status === 'BANNED') {
                alert("ACCESS_DENIED: YOUR ACCOUNT HAS BEEN PERMANENTLY SUSPENDED.");
                logoutNexus();
                return;
            }
            
            const name = profile?.username || user.user_metadata?.full_name || user.email.split('@')[0];
            const pic = user.user_metadata.avatar_url || 'https://via.placeholder.com/100';

            // Sync to legacy storage for older components
            localStorage.setItem('rbx_user', name);
            localStorage.setItem('rbx_pic', pic);
            localStorage.setItem('rbx_email', user.email);
            localStorage.setItem('rbx_verified', profile?.is_verified || false);
            localStorage.setItem('rbx_is_admin', profile?.is_admin || false);

            authNav.innerHTML = `<a href="profile.html?user=${name}" class="nav-item interactable" style="color:#00A2FF; font-weight:900;">@${name}</a>
                                 <a href="#" onclick="logoutNexus()" class="nav-item interactable" style="opacity:0.4; font-size:0.7rem;">LOGOUT</a>`;
        } else {
            // No active session - check if we have stored user data (fallback for demo)
            const storedUser = localStorage.getItem('rbx_user');
            if (storedUser) {
                // User has stored data but no session - they need to re-login
                console.log('Stored user found but no session - requiring re-auth');
                localStorage.removeItem('rbx_user');
                localStorage.removeItem('rbx_pic');
                localStorage.removeItem('rbx_email');
            }
            authNav.innerHTML = `<a href="auth.html" class="nav-item interactable" style="background:#fff; color:#000; padding:8px 20px; border-radius:100px;">Login</a>`;
        }
    } catch (e) {
        console.error("Auth Error:", e);
        authNav.innerHTML = `<a href="auth.html" class="nav-item interactable" style="background:#fff; color:#000; padding:8px 20px; border-radius:100px;">Login</a>`;
    }
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

// --- TOP NOTIFICATIONS ---
window.showTopNotification = (text, type = 'info') => {
    let topBar = document.getElementById('top-notification-bar');
    if (!topBar) {
        topBar = document.createElement('div');
        topBar.id = 'top-notification-bar';
        Object.assign(topBar.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', padding: '15px',
            background: type === 'info' ? '#0070FF' : (type === 'error' ? '#FF2D55' : '#00D1FF'),
            color: '#fff', textAlign: 'center', zIndex: '1000010', fontWeight: '900',
            fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase',
            boxShadow: '0 5px 20px rgba(0,0,0,0.3)', transform: 'translateY(-100%)',
            transition: '0.6s cubic-bezier(0.8, 0, 0.2, 1)', backdropFilter: 'blur(10px)'
        });
        document.body.appendChild(topBar);
    }
    topBar.innerText = text;
    topBar.style.transform = 'translateY(0)';
    setTimeout(() => topBar.style.transform = 'translateY(-100%)', 4000);
};

// --- USER VALIDATION ---
window.checkIfUserExists = async (username) => {
    if (!window.supabaseClient) return username; // Fail safe - allow if Supabase not available
    
    // First try exact match (case-insensitive)
    const { data } = await window.supabaseClient
        .from('profiles')
        .select('username')
        .ilike('username', username.trim())
        .maybeSingle();
    
    if (data) return data.username;
    
    // If not found in profiles, also check if user is currently logged in anywhere
    // by checking localStorage users (for demo/testing purposes)
    const allUsers = JSON.parse(localStorage.getItem('nexus_all_users') || '[]');
    const foundUser = allUsers.find(u => u.toLowerCase() === username.trim().toLowerCase());
    if (foundUser) return foundUser;
    
    // Last resort: just return the username they entered
    // This allows adding friends even if they haven't registered in Supabase yet
    return username.trim();
};

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
            <div id="psm-box" style="background:#0a0a0a; width:400px; padding:0; border-radius:18px; border:1px solid #333; overflow:hidden; transform:translateY(20px); transition:0.5s cubic-bezier(0.2, 0.8, 0.2, 1); box-shadow:0 40px 80px rgba(0,0,0,0.8);">
                <div id="psm-banner" style="height:120px; background:linear-gradient(45deg, #111, #222); position:relative;">
                    <button onclick="closeProfileSummary()" style="position:absolute; top:15px; right:15px; background:rgba(0,0,0,0.5); border:none; color:#fff; width:30px; height:30px; border-radius:50%; cursor:pointer;">×</button>
                </div>
                <div style="padding:0 20px 20px; position:relative;">
                    <div style="position:relative; margin-top:-45px; display:inline-block;">
                        <img id="psm-pfp" src="https://via.placeholder.com/100" style="width:100px; height:100px; border-radius:50%; border:8px solid #0a0a0a; background:#111; object-fit:cover;">
                        <div id="psm-status-dot" style="width:24px; height:24px; background:#43b581; border:5px solid #0a0a0a; border-radius:50%; position:absolute; bottom:5px; right:5px; display:none;"></div>
                    </div>
                    <div style="margin-top:10px;">
                        <h2 id="psm-name" style="margin:0; font-weight:900; font-size:1.4rem; color:#fff; display:flex; align-items:center; gap:8px;">...</h2>
                        <p id="psm-handle" style="color:#b9bbbe; font-size:0.85rem; margin:2px 0 15px;">@...</p>
                        
                        <div style="background:#18191c; border-radius:8px; padding:15px; margin-bottom:15px;">
                            <div style="text-transform:uppercase; font-size:0.7rem; font-weight:800; color:#b9bbbe; margin-bottom:8px;">About Me</div>
                            <p id="psm-bio" style="color:#dcddde; font-size:0.85rem; line-height:1.4; margin:0;">New entity detected.</p>
                            
                            <div style="text-transform:uppercase; font-size:0.7rem; font-weight:800; color:#b9bbbe; margin:15px 0 8px;">Nexus Member Since</div>
                            <p id="psm-joined" style="color:#dcddde; font-size:0.85rem; margin:0;">Calculating...</p>
                        </div>

                        <div style="display:flex; gap:10px; margin-bottom:10px;">
                            <button id="psm-dm-btn" style="flex:1; padding:10px; border-radius:4px; border:none; background:#5865f2; color:#fff; font-weight:700; cursor:pointer; font-size:0.85rem;">Send Message</button>
                            <button id="psm-fr-btn" style="flex:1; padding:10px; border-radius:4px; border:1px solid #4f545c; background:transparent; color:#fff; font-weight:700; cursor:pointer; font-size:0.85rem;">Add Friend</button>
                        </div>
                        <a id="psm-link" href="#" style="display:block; text-align:center; color:#00A2FF; font-size:0.75rem; text-decoration:none; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-top:5px;">Full Profile Tracking</a>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; document.getElementById('psm-box').style.transform = 'translateY(0)'; }, 10);
    document.getElementById('psm-name').innerText = username;
    document.getElementById('psm-handle').innerText = '@' + username.toLowerCase().replace(/\s/g, '');
    if (window.supabaseClient) { 
        window.supabaseClient.from('profiles').select('*').eq('username', username).maybeSingle().then(({data}) => {
            if (data) {
                document.getElementById('psm-name').innerText = data.display_name || data.username;
                document.getElementById('psm-pfp').src = data.avatar_url || 'https://via.placeholder.com/100';
                document.getElementById('psm-bio').innerText = data.bio || 'New entity detected.';
                if(data.banner_url) document.getElementById('psm-banner').style.background = `url(${data.banner_url}) center/cover`;
                
                if (data.created_at) {
                    const date = new Date(data.created_at);
                    const options = { month: 'short', day: 'numeric', year: 'numeric' };
                    document.getElementById('psm-joined').innerText = date.toLocaleDateString('en-US', options);
                }

                // Check Official Online Status via Ably (if on global hub)
                if (typeof Ably !== 'undefined') {
                    const hub = new Ably.Realtime('I2GocA.2XM7TQ:nuJQeyu7st5NRAjpGZKS00fjwc4qbCRGioyS_ERGTdc');
                    hub.channels.get('global-hub').presence.get((err, members) => {
                        if (!err && members.some(m => m.data.user === username)) {
                            document.getElementById('psm-status-dot').style.display = 'block';
                        }
                    });
                }
            }
        }); 
    }
    document.getElementById('psm-link').href = `profile.html?user=${encodeURIComponent(username)}`;
    document.getElementById('psm-dm-btn').onclick = () => { closeProfileSummary(); if(window.location.pathname.includes('discuss.html')) setMode('dm', username); else location.href = `discuss.html?dm=${encodeURIComponent(username)}`; };
    document.getElementById('psm-fr-btn').onclick = () => { if(window.sendFriendRequest) window.sendFriendRequest(username); else alert("Friend System Offline"); };
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
