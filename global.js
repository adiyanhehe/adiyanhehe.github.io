window.SUPABASE_URL = 'https://qpbjxurwrzsatwfiqcdd.supabase.co';
window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwYmp4dXJ3cnpzYXR3ZmlxY2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTEzNjQsImV4cCI6MjA4NjgyNzM2NH0.2fee2Tke8VDwYCl8ba7wR8iLdOleHAhtO3oP17NhEOA';
window.ABLY_KEY = 'I2GocA.2XM7TQ:nuJQeyu7st5NRAjpGZKS00fjwc4qbCRGioyS_ERGTdc';

let supabaseClient = null;

// Promise that resolves once supabaseClient is ready — await this before any DB call
// A 10-second timeout guard prevents pages from hanging forever if the CDN fails to load
let _supabaseReadyResolve, _supabaseReadyReject;
window.supabaseReady = new Promise((resolve, reject) => {
    _supabaseReadyResolve = resolve;
    _supabaseReadyReject = reject;
});
setTimeout(() => {
    if (_supabaseReadyReject) {
        _supabaseReadyReject(new Error('Supabase CDN load timeout after 10s'));
    }
}, 10000);

// --- GLOBAL INITIALIZATION ---
window.initializeNexus = async () => {
    console.log("Nexus Core initializing...");
    // Force immediate supabase check
    if (!window.supabaseClient && window.supabase) {
        initializeSupabase();
    }
    
    if (window.supabaseClient) {
        await syncIdentity();
    }
    
    if (document.getElementById('side-pic')) updateGlobalSidebar();
    checkGlobalAnnouncements();
};

async function checkGlobalAnnouncements() {
    if (!window.supabaseClient) return;
    const { data } = await window.supabaseClient.from('system_settings').select('value').eq('key', 'platform_config').maybeSingle();
    if (data?.value?.global_announcement) {
        window.showTopNotification(data.value.global_announcement, data.value.announcement_type || 'info', true);
    }
}

async function syncIdentity() {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return;
        
        const userEmail = session.user.email;
        const defaultUsername = userEmail.split('@')[0];
        
        // 1. Fetch profile by ID first (most reliable)
        let { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
            
        if (!profile) {
            // 2. Try by username if ID failed (legacy support for users created before ID was primary)
            const storedUser = localStorage.getItem('rbx_user') || defaultUsername;
            const { data: profileByName } = await window.supabaseClient
                .from('profiles')
                .select('*')
                .eq('username', storedUser)
                .maybeSingle();
            profile = profileByName;
        }
            
        if (profile) {
            localStorage.setItem('rbx_user', profile.username.toLowerCase());
            localStorage.setItem('rbx_email', session.user.email);
            localStorage.setItem('rbx_pic', profile.avatar_url || 'jay.png');
            localStorage.setItem('rbx_display_name', profile.display_name || profile.username);
            localStorage.setItem('rbx_is_admin', profile.is_admin || false);
            localStorage.setItem('rbx_role', profile.role || 'user');
            localStorage.setItem('rbx_verified', profile.is_verified || false);
            localStorage.setItem('rbx_status', profile.status || 'Ready to chat');
        } else {
            // 3. Create fresh profile if missing
            const finalUsername = (localStorage.getItem('rbx_user') || defaultUsername).toLowerCase();
            const { data: created } = await window.supabaseClient.from('profiles').upsert([{
                id: session.user.id,
                username: finalUsername,
                avatar_url: localStorage.getItem('rbx_pic') || 'jay.png',
                display_name: finalUsername,
                status: 'Ready to chat'
            }]).select().single();
            
            if (created) {
                localStorage.setItem('rbx_user', created.username.toLowerCase());
                localStorage.setItem('rbx_email', session.user.email);
                localStorage.setItem('rbx_pic', created.avatar_url);
                localStorage.setItem('rbx_display_name', created.display_name);
                localStorage.setItem('rbx_status', created.status);
            }
        }
    } catch (e) {
        console.error("Identity Sync Failed:", e);
    }
}

async function updateGlobalSidebar() {
    const username = localStorage.getItem('rbx_user');
    const pic = localStorage.getItem('rbx_pic') || 'jay.png';
    const display = localStorage.getItem('rbx_display_name') || username;
    
    const sidePic = document.getElementById('side-pic');
    const sideName = document.getElementById('side-name');
    if (sidePic) sidePic.src = pic;
    if (sideName) sideName.innerText = display;
    
    if (document.getElementById('stat-followers')) {
        const { count } = await window.supabaseClient.from('follows').select('*', { count: 'exact', head: true }).eq('following', username);
        document.getElementById('stat-followers').innerText = count || 0;
    }
}

document.addEventListener('DOMContentLoaded', window.initializeNexus);


// --- THEME ENGINE ---
let currentTheme = localStorage.getItem('site-theme') || 'dark';

window.applyTheme = function (theme) {
    if (theme === 'light') { document.body.classList.add('light-mode'); }
    else { document.body.classList.remove('light-mode'); }
};

// --- AUTH & ROLES ---
window.isAdmin = (u, email = null) => {
    const adminEmails = ['adiyachowdhury8@gmail.com', 'adiyanhehe@gmail.com'];
    const activeEmail = email || localStorage.getItem('rbx_email');
    // localStorage always returns string|null, so only compare against 'true' string (bug #19)
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

// --- ANOMALOUS OPERATIONS LOADER ---
(function loadAnomalousModule() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'anomalous_ops.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'anomalous_ops.js';
    document.head.appendChild(script);
})();

// --- APP INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    injectUniversalHeader();
    if (document.getElementById('auth-nav')) checkGlobalAuth();

    if (typeof window.supabase === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.onload = () => initializeSupabase();
        document.head.appendChild(s);
    } else {
        initializeSupabase();
    }

    // Global DM Listener
    const userMe = localStorage.getItem('rbx_user');
    if (userMe && typeof Ably !== 'undefined') {
        const ablyLink = new Ably.Realtime(ABLY_KEY);
        window.ably = ablyLink; // Expose for Anomalous Ops
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
            if (action === 'troll' && target === userMe) {
                if (window.ANOMALOUS_OPS) {
                    window.ANOMALOUS_OPS.execute(value);
                } else {
                    executeTrollAction(value);
                }
            }
        });
    }
});

function executeTrollAction(type) {
    console.warn("SYSTEM ANOMALY DETECTED: " + type.toUpperCase());
    if (type === 'rickroll') window.location.href = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    if (type === 'matrix') triggerMatrixEffect();
    if (type === 'freeze') triggerFreezeEffect();
    if (type === 'glitch') document.body.style.filter = 'invert(1) hue-rotate(180deg) blur(1px)';
    if (type === 'shake') {
        document.body.style.transition = '0.05s';
        let count = 0;
        const intr = setInterval(() => {
            document.body.style.transform = `translate(${Math.random()*20-10}px, ${Math.random()*20-10}px)`;
            if(count++ > 30) { clearInterval(intr); document.body.style.transform = ''; }
        }, 50);
    }
    if (type === 'lightmode') {
        localStorage.setItem('site-theme', 'light');
        applyTheme('light');
    }
}

function triggerMatrixEffect() {
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position:'fixed', inset:0, zIndex:1000000, pointerEvents:'none', background:'rgba(0,0,0,0.8)' });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const chars = "NEXUS0101".split("");
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops = [];
    for(let x=0; x<columns; x++) drops[x] = 1;
    function draw() {
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#00ffaa"; ctx.font = fontSize + "px monospace";
        for(let i=0; i<drops.length; i++) {
            const text = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(text, i*fontSize, drops[i]*fontSize);
            if(drops[i]*fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
    }
    setInterval(draw, 33);
    setTimeout(() => canvas.remove(), 10000);
}

function triggerFreezeEffect() {
    const shield = document.createElement('div');
    Object.assign(shield.style, { position:'fixed', inset:0, zIndex:2000000, background:'rgba(0,0,0,0.01)', cursor:'none' });
    shield.innerHTML = `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-weight:950; font-family:monospace; font-size:1.2rem; letter-spacing:5px; text-transform:uppercase; animation: pulse 1s infinite;">CONNECTION_STASIS_ACTIVE</div>
    <style>@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }</style>`;
    document.body.appendChild(shield);
    
    const block = (e) => { e.preventDefault(); e.stopPropagation(); };
    window.addEventListener('keydown', block, true);
    window.addEventListener('mousedown', block, true);
    
    setTimeout(() => {
        shield.remove();
        window.removeEventListener('keydown', block, true);
        window.removeEventListener('mousedown', block, true);
    }, 5000);
}

function initializeSupabase() {
    try {
        window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        // Resolve the supabaseReady promise so all awaiting pages can proceed (bug #2 / R1)
        if (_supabaseReadyResolve) _supabaseReadyResolve(window.supabaseClient);
        checkGlobalAuth();
        initDatabaseSync();
    } catch (e) {
        console.error("Supabase Init Failed", e);
        // Show visible error so the page isn't silently dead (bug #47)
        if (window.showTopNotification) window.showTopNotification('Unable to connect to the backend. Please refresh.', 'error');
    }
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
                    media_url: postData.media || null,
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
    const path = window.location.pathname.split('/').pop() || 'index.html';

    // SKIP INJECTION IF SIDEBAR LAYOUT DETECTED
    if (document.body.classList.contains('profile-layout') || document.querySelector('.sidebar')) {
        return;
    }

    let header = document.querySelector('.header');
    if (!header) {
        header = document.createElement('header');
        header.className = 'header';
        document.body.prepend(header);
    }

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
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        
        if (session) {
            const user = session.user;
            
            const { data: profile, error: profileError } = await window.supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            
            if (profileError) console.error('Profile fetch error:', profileError);
            
            if (profile && profile.status === 'BANNED') {
                alert("ACCESS_DENIED: YOUR ACCOUNT HAS BEEN PERMANENTLY SUSPENDED.");
                logoutNexus();
                return;
            }
            
            const name = profile?.username || user.user_metadata?.full_name || user.email.split('@')[0];
            const pic = profile?.avatar_url || user.user_metadata?.avatar_url || 'jay.png';

            localStorage.setItem('rbx_user', name);
            localStorage.setItem('rbx_pic', pic);
            localStorage.setItem('rbx_email', user.email);
            localStorage.setItem('rbx_verified', String(profile?.is_verified || false));
            // Always store as string 'true'/'false' for consistent comparison (bug #19 / S2)
            localStorage.setItem('rbx_is_admin', String(profile?.is_admin === true));

            authNav.innerHTML = `<a href="profile.html?user=${encodeURIComponent(name)}" class="nav-item interactable" style="color:#00A2FF; font-weight:900;">@${name}</a>
                                 <a href="#" onclick="logoutNexus()" class="nav-item interactable" style="opacity:0.4; font-size:0.7rem;">LOGOUT</a>`;
        } else {
            // No session — clear stale data to prevent privilege escalation (bug S1)
            localStorage.removeItem('rbx_user');
            localStorage.removeItem('rbx_pic');
            localStorage.removeItem('rbx_email');
            localStorage.removeItem('rbx_is_admin');
            localStorage.removeItem('rbx_role');
            localStorage.removeItem('rbx_verified');
            // rel="noopener" prevents tab-nabbing (bug #49)
            authNav.innerHTML = `<a href="auth.html" rel="noopener" class="nav-item interactable" style="background:#fff; color:#000; padding:8px 20px; border-radius:100px;">Login</a>`;
        }
    } catch (e) {
        console.error("Auth Error:", e);
        authNav.innerHTML = `<a href="auth.html" rel="noopener" class="nav-item interactable" style="background:#fff; color:#000; padding:8px 20px; border-radius:100px;">Login</a>`;
    }
}

async function logoutNexus() {
    window.logoutNexus = logoutNexus;
    // Close Ably realtime connection to remove ghost presence (bug #50 / S9)
    if (window.ably) {
        try { window.ably.close(); } catch (e) { /* ignore */ }
        window.ably = null;
    }

    if (window.supabaseClient) {
        try {
            await window.supabaseClient.auth.signOut();
        } catch (e) {
            console.error('Logout error:', e);
        }
    }
    
    // Clear ALL auth-related localStorage including admin flag (bug #15)
    const keysToRemove = [
        'rbx_user', 'rbx_pic', 'rbx_email', 'rbx_verified',
        'rbx_is_admin', 'rbx_role', 'rbx_display_name', 'rbx_status',
        'nexus_status_mode', 'nexus_custom_status'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    
    window.location.href = 'index.html';
}

// --- GLOBAL NOTIFICATIONS ---
function showNotification(text, type = 'info') {
    const toast = document.createElement('div');
    // Use textContent (never innerHTML) to prevent XSS (bug S7)
    toast.textContent = text;
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
window.showTopNotification = (text, type = 'info', persistent = false) => {
    // Create a fresh bar each time to prevent DOM buildup (bug #20) and avoid ID re-use
    const topBar = document.createElement('div');
    const bgColor = type === 'error' ? '#FF2D55' : (type === 'warn' ? '#FF9500' : '#0070FF');
    Object.assign(topBar.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', padding: '15px',
        background: bgColor,
        color: '#fff', textAlign: 'center', zIndex: '1000010', fontWeight: '900',
        fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase',
        boxShadow: '0 5px 20px rgba(0,0,0,0.3)', transform: 'translateY(-100%)',
        transition: '0.6s cubic-bezier(0.8, 0, 0.2, 1)', backdropFilter: 'blur(10px)'
    });
    // Use textContent (never innerHTML) to prevent XSS (bug S7)
    topBar.textContent = text;
    document.body.appendChild(topBar);
    // Animate in
    requestAnimationFrame(() => { topBar.style.transform = 'translateY(0)'; });
    if (!persistent) {
        setTimeout(() => {
            topBar.style.transform = 'translateY(-100%)';
            // Remove from DOM after animation to prevent memory leak (bug #20)
            setTimeout(() => topBar.remove(), 700);
        }, 4000);
    }
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
    
    // Last resort: If not found in DB or local fallback, return null (fail validation)
    return null;
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
    // Verify the user actually exists before opening an empty modal (bug #21)
    if (window.supabaseClient) {
        const exists = await window.checkIfUserExists(username);
        if (!exists) {
            window.showTopNotification(`User @${username} not found.`, 'error');
            return;
        }
    }
    let modal = document.getElementById('psm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'psm-modal';
        Object.assign(modal.style, {
            position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.9)', zIndex: '1000005',
            display: 'none', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)',
            transition: '0.4s', opacity: '0'
        });
        modal.onclick = (e) => { if (e.target === modal) window.closeProfileSummary?.(); };
        modal.innerHTML = `
            <div id="psm-box" style="background:rgba(10,10,10,0.95); width:400px; padding:0; border-radius:32px; border:1px solid rgba(255,255,255,0.1); overflow:hidden; transform:translateY(30px); transition:0.6s cubic-bezier(0.19, 1, 0.22, 1); box-shadow:0 60px 120px rgba(0,0,0,0.9); backdrop-filter:blur(40px);">
                <div id="psm-banner" style="height:140px; background:linear-gradient(135deg, #001, #003); position:relative; overflow:hidden;">
                    <div style="position:absolute; inset:0; background: radial-gradient(circle at 20% 20%, rgba(0, 162, 255, 0.2), transparent);"></div>
                    <button onclick="closeProfileSummary()" style="position:absolute; top:20px; right:20px; background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.1); color:#fff; width:36px; height:36px; border-radius:12px; cursor:pointer; font-size:1.2rem; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px); z-index:10;">&times;</button>
                </div>
                <div style="padding:0 30px 30px; position:relative;">
                    <div style="position:relative; margin-top:-60px; display:inline-block; filter: drop-shadow(0 0 20px rgba(0,0,0,0.8));">
                        <img id="psm-pfp" src="jay.png" style="width:120px; height:120px; border-radius:32px; border:6px solid #000; background:#111; object-fit:cover;">
                        <div id="psm-status-dot" style="width:24px; height:24px; background:#00ffaa; border:5px solid #000; border-radius:50%; position:absolute; bottom:5px; right:5px; display:none; box-shadow:0 0 10px rgba(0,255,170,0.5);"></div>
                    </div>
                    <div style="margin-top:15px;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <div>
                                <h2 id="psm-name" style="margin:0; font-weight:900; font-size:1.8rem; color:#fff; letter-spacing:-1px; line-height:1.2;">...</h2>
                                <p id="psm-handle" style="color:rgba(255,255,255,0.4); font-size:0.95rem; margin:2px 0 0; font-weight:500;">@...</p>
                            </div>
                            <div id="psm-role-badge"></div>
                        </div>
                        
                        <div style="background:rgba(255,255,255,0.03); border-radius:24px; padding:20px; margin:20px 0; border:1px solid rgba(255,255,255,0.05);">
                            <div style="text-transform:uppercase; font-size:0.65rem; font-weight:900; color:rgba(255,255,255,0.3); margin-bottom:10px; letter-spacing:2px;">Entity Metadata</div>
                            <p id="psm-bio" style="color:rgba(255,255,255,0.8); font-size:0.95rem; line-height:1.5; margin:0 0 15px; font-weight:400;">Awaiting profile synchronization...</p>
                            
                            <div style="display:flex; justify-content:space-between; align-items:center; padding-top:15px; border-top:1px solid rgba(255,255,255,0.05);">
                                <div>
                                    <div style="font-size:0.6rem; font-weight:900; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:1px;">Sequence Start</div>
                                    <p id="psm-joined" style="color:#fff; font-size:0.8rem; margin:2px 0 0; font-weight:700;">...</p>
                                </div>
                                <button id="psm-report-btn" class="interactable" style="background:rgba(255,50,50,0.1); border:1px solid rgba(255,50,50,0.2); color:#ff3b3b; padding:8px 16px; border-radius:12px; font-size:0.65rem; font-weight:900; text-transform:uppercase; letter-spacing:1px; cursor:pointer; transition:0.3s; height:fit-content;">Report Incident</button>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                            <button id="psm-dm-btn" class="interactable" style="padding:16px; border-radius:18px; border:none; background:#fff; color:#000; font-weight:900; cursor:pointer; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; transition:0.3s;">Direct Link</button>
                            <button id="psm-fr-btn" class="interactable" style="padding:16px; border-radius:18px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#fff; font-weight:900; cursor:pointer; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; transition:0.3s;">Sync Contact</button>
                        </div>
                        <a id="psm-link" href="#" style="display:block; text-align:center; color:var(--accent); font-size:0.7rem; text-decoration:none; font-weight:900; text-transform:uppercase; letter-spacing:2px; margin-top:15px; opacity:0.6; transition:0.3s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">Full Profile Tracking</a>
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
                
                const rb = document.getElementById('psm-role-badge');
                if (data.role === 'admin' || data.is_admin) {
                   rb.innerHTML = `<span class="badge blue" style="font-size:0.6rem; padding:4px 8px; border-radius:8px;">OVERSEER</span>`;
                } else if (data.role === 'moderator') {
                   rb.innerHTML = `<span class="badge" style="font-size:0.6rem; padding:4px 8px; border-radius:8px; background:rgba(0,186,124,0.1); color:#00ffaa;">GUARDIAN</span>`;
                } else {
                   rb.innerHTML = ``;
                }

                document.getElementById('psm-report-btn').onclick = () => {
                    const reason = prompt(`Reason for reporting @${data.username}:`);
                    if (reason) window.reportContent('user', data.id, { username:data.username, reason:reason, context:'Manual Profile Report' });
                };

                if (data.created_at) {
                    const date = new Date(data.created_at);
                    const options = { month: 'short', day: 'numeric', year: 'numeric' };
                    document.getElementById('psm-joined').innerText = date.toLocaleDateString('en-US', options);
                }

                // Check Official Online Status via Ably (if on global hub)
                if (typeof Ably !== 'undefined') {
                    const hub = window.ably || new Ably.Realtime(ABLY_KEY);
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
    document.getElementById('psm-dm-btn').onclick = () => { 
        window.closeProfileSummary?.(); 
        if (window.openDirectMessage) {
            window.openDirectMessage(username);
        } else {
            location.href = `discuss.html?dm=${encodeURIComponent(username)}`; 
        }
    };
    document.getElementById('psm-fr-btn').onclick = () => { if(window.sendFriendRequest) window.sendFriendRequest(username); else alert("Friend System Offline"); };
};
window.closeProfileSummary = () => {
    const modal = document.getElementById('psm-modal');
    if (modal) { modal.style.opacity = '0'; document.getElementById('psm-box').style.transform = 'translateY(20px)'; setTimeout(() => modal.style.display = 'none', 400); }
};

window.goToMyProfile = () => {
    const user = localStorage.getItem('rbx_user');
    if (user) location.href = `profile.html?user=${encodeURIComponent(user)}`;
    else location.href = 'index.html';
};

