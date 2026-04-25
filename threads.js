const KLIPY_API_KEY = "4o9v8SiiAWDJy8Dq2Q4mHfV35hQtFswJpH3NTRckha7dG5MmGzXdgfk94XEE8gUQ";

const state = {
    currentUser: null,
    threads: [],
    initialized: false,
    mediaPreview: null,
    gifOpen: false
};

const elements = {};

function cacheElements() {
    elements.feed = document.getElementById("feed");
    elements.composerInput = document.getElementById("post-in");
    elements.postBtn = document.getElementById("post-btn");
    elements.trendList = document.getElementById("trend-list");

    // Media & Modals
    elements.mediaPreview = document.getElementById("media-preview");
    elements.mediaPreviewContent = document.getElementById("media-preview-content");
    elements.fileInput = document.getElementById("fileInput");
    elements.gifPicker = document.getElementById("gif-picker");
    elements.gifGrid = document.getElementById("gif-grid");
    elements.gifSearchInput = document.getElementById("gif-search-in");

    // Sidebar & Profile
    elements.sidePic = document.getElementById("side-pic");
    elements.sideName = document.getElementById("side-name");
    elements.myPics = [
        document.getElementById('my-pic'),
        document.getElementById('my-pic-composer')
    ].filter(Boolean);
}

// Ensure Supabase is fully loaded from global.js before running app logic
let bootTicks = 0;
const initInterval = setInterval(async () => {
    bootTicks++;

    if (window.supabaseClient && !state.initialized) {
        state.initialized = true;
        clearInterval(initInterval);
        try {
            await initializeThreads();
        } catch (e) {
            console.error('[Threads] initializeThreads failed — degraded boot:', e);
            // Still attempt a basic render so the page isn't dead
            cacheElements();
            bindEvents();
        }
        return;
    }

    // Safety: if Supabase never initializes, don't leave the page stuck forever.
    if (!state.initialized && bootTicks > 60) { // ~6s
        clearInterval(initInterval);
        cacheElements();
        bindEvents();
        if (elements.feed) {
            elements.feed.innerHTML = `
                <div style="padding: 60px; text-align: center; color: var(--text-soft);">
                    <div style="font-weight: 900; color: var(--text-main); margin-bottom: 10px;">Offline mode</div>
                    <div style="max-width: 520px; margin: 0 auto; line-height: 1.6;">
                        Threads couldn’t connect to the network right now. Refresh the page or try again later.
                    </div>
                </div>`;
        }
        if (elements.postBtn) {
            elements.postBtn.disabled = true;
            elements.postBtn.innerText = 'Offline';
        }
        if (window.showTopNotification) {
            window.showTopNotification('Threads is offline (Supabase not ready).', 'error');
        }
    }
}, 100);

async function initializeThreads() {
    cacheElements();

    let session = null;
    try {
        const { data } = await window.supabaseClient.auth.getSession();
        session = data.session;
    } catch(e) {
        console.warn("Auth check bypassed:", e);
    }

    // 1. Resolve Current User gracefully
    let username = 'Anonymous';
    let emailPrefix = 'Guest';
    
    if (session) {
        emailPrefix = session.user.email.split('@')[0];
    }
    
    username = (localStorage.getItem('rbx_user') || emailPrefix).toLowerCase();
    const avatar = localStorage.getItem('rbx_pic') || 'jay.png';
    const displayName = localStorage.getItem('rbx_display_name') || username;

    state.currentUser = { id: username, name: displayName, avatar: avatar };

    // 2. Setup Top-Left and Composer UI
    if (elements.sidePic) elements.sidePic.src = avatar;
    if (elements.sideName) elements.sideName.innerText = displayName;

    elements.myPics.forEach(pic => {
        if (pic) pic.src = avatar;
    });

    // 3. Boot Engines unconditionally
    bindEvents();
    await fetchCloudThreads();
    await updateSideStats();
    setupRealtime();
}

function bindEvents() {
    if (elements.postBtn) elements.postBtn.addEventListener("click", publishTransmission);

    if (elements.composerInput) {
        elements.composerInput.addEventListener("input", () => {
            const hasText = !!elements.composerInput.value.trim();
            const hasMedia = !!state.mediaPreview;
            elements.postBtn.disabled = !hasText && !hasMedia;
        });
    }

    if (elements.fileInput) {
        elements.fileInput.addEventListener("change", handleFileUpload);
    }
}

// --- CLOUD SYNC & REALTIME ---

async function fetchCloudThreads() {
    if (!elements.feed) return;
    elements.feed.innerHTML = '<div style="padding: 60px; text-align: center; color: var(--text-soft);"><div class="loader" style="width: 24px; height: 24px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; margin: 0 auto 16px; animation: spin 1s linear infinite;"></div>Synchronizing network array...</div>';

    const { data, error } = await window.supabaseClient
        .from('threads')
        .select(`
            *,
            profiles:author (
                role,
                is_admin,
                display_name,
                avatar_url
            )
        `)
        .order('timestamp', { ascending: false })
        .limit(100);

    if (error) {
        console.error("Transmission Error:", error);
        return;
    }

    state.threads = data || [];
    renderFeed();
}

function setupRealtime() {
    window.supabaseClient
        .channel('public:threads')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threads' }, payload => {
            // Unshift pushes new post to top of array safely
            state.threads.unshift(payload.new);
            renderFeed();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'threads' }, payload => {
            // Handle like/repost count updates instantly
            const idx = state.threads.findIndex(t => t.id === payload.new.id);
            if (idx !== -1) {
                state.threads[idx] = payload.new;
                const node = document.getElementById(`thread-${payload.new.id}`);
                if (node) node.outerHTML = renderThreadHTML(payload.new);
            }
        })
        .subscribe();
}

// --- RENDER PIPELINE ---

function renderFeed() {
    if (!elements.feed) return;

    if (state.threads.length === 0) {
        elements.feed.innerHTML = '<div style="padding: 60px; text-align: center; color: var(--text-soft);">Sensors detect no transmissions yet.</div>';
        return;
    }

    elements.feed.innerHTML = state.threads.map(t => renderThreadHTML(t)).join('');
    updateTrendsEngine();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(ts) {
    const date = new Date(ts);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return date.toLocaleDateString();
}

function renderThreadHTML(t) {
    const time = formatTime(t.timestamp || t.created_at);
    const id = t.id;
    const author = t.author || 'Anonymous';
    const avatar = t.avatar || t.avatar_url || 'jay.png';
    const isLiked = localStorage.getItem(`liked_${id}`);
    const isReposted = localStorage.getItem(`reposted_${id}`);
    const isReplied = localStorage.getItem(`replied_${id}`);
    
    let content = escapeHtml(t.content || '');
    // Wrap mentions and hashtags in primary color spans
    content = content.replace(/@(\w+)/g, '<span class="text-primary font-bold cursor-pointer hover:underline">@$1</span>');
    content = content.replace(/#(\w+)/g, '<span class="text-secondary font-bold cursor-pointer hover:underline">#$1</span>');

    const isAdmin = t.profiles?.role === 'admin' || t.profiles?.is_admin;
    const isMod = t.profiles?.role === 'moderator';
    const isOwner = author.toLowerCase() === 'adiyan';

    return `
        <div class="relative group" id="thread-${id}">
            <div class="flex gap-4">
                <div class="flex flex-col items-center gap-2">
                    <img src="${avatar}" class="w-10 h-10 md:w-12 md:h-12 rounded-xl ring-1 ring-white/10 hover:ring-primary/50 transition-all cursor-pointer object-cover flex-shrink-0" onclick="window.showProfileSummary('${author}')">
                    <div class="flex-1 w-0.5 thread-rail opacity-20 rounded-full"></div>
                </div>
                <div class="flex-1 pb-4">
                    <div class="flex justify-between items-start mb-1">
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span class="text-sm font-black text-white tracking-tight cursor-pointer hover:text-primary transition-colors" onclick="window.showProfileSummary('${author}')">${author.toUpperCase()}</span>
                            ${isAdmin ? `<span class="bg-primary/20 text-primary text-[8px] font-black px-1.5 py-0.5 rounded border border-primary/30 uppercase tracking-tighter shadow-[0_0_10px_rgba(139,92,246,0.2)]">OVERSEER</span>` : ""}
                            ${isMod ? `<span class="bg-secondary/20 text-secondary text-[8px] font-black px-1.5 py-0.5 rounded border border-secondary/30 uppercase tracking-tighter">GUARDIAN</span>` : ""}
                            ${isOwner ? '<span class="material-symbols-outlined text-[#1d9bf0] text-sm" style="font-variation-settings: \'FILL\' 1;">verified</span>' : ''}
                            <span class="text-[10px] font-mono text-white/30 lowercase">@${author.toLowerCase()}</span>
                            <span class="text-[10px] font-mono text-white/20">· ${time}</span>
                        </div>
                        <div class="flex items-center gap-2">
                             <div class="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span class="text-[9px] font-mono text-primary/50 uppercase tracking-tighter">Signal</span>
                                <div class="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div class="h-full bg-primary" style="width: ${Math.floor(Math.random() * 40) + 60}%"></div>
                                </div>
                            </div>
                            <button class="material-symbols-outlined text-white/20 hover:text-white transition-colors text-sm">more_horiz</button>
                        </div>
                    </div>
                    
                    <p class="text-white/80 text-sm md:text-base leading-relaxed mb-4">${content}</p>
                    
                    ${t.media_url ? `
                        <div class="rounded-2xl overflow-hidden border border-white/10 glass-panel mb-4 shadow-2xl">
                            <img src="${t.media_url}" class="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity" loading="lazy">
                        </div>
                    ` : ''}

                    <div class="flex items-center gap-6">
                        <button class="flex items-center gap-2 group/btn ${isReplied ? 'text-primary' : 'text-white/30'} hover:text-primary transition-all" onclick="window.toggleReply('${id}')">
                            <span class="material-symbols-outlined text-lg group-hover/btn:scale-110 transition-transform">chat_bubble</span>
                            <span class="text-[10px] font-mono uppercase tracking-widest">${t.replies || 0}</span>
                        </button>
                        <button class="flex items-center gap-2 group/btn ${isReposted ? 'text-green-400' : 'text-white/30'} hover:text-green-400 transition-all" onclick="window.toggleRepost('${id}')">
                            <span class="material-symbols-outlined text-lg group-hover/btn:scale-110 transition-transform">repeat</span>
                            <span class="text-[10px] font-mono uppercase tracking-widest">${t.reposts || 0}</span>
                        </button>
                        <button class="flex items-center gap-2 group/btn ${isLiked ? 'text-pink-500' : 'text-white/30'} hover:text-pink-500 transition-all" onclick="window.toggleLike('${id}')">
                            <span class="material-symbols-outlined text-lg group-hover/btn:scale-110 transition-transform" style="${isLiked ? 'font-variation-settings: \'FILL\' 1;' : ''}">favorite</span>
                            <span class="text-[10px] font-mono uppercase tracking-widest">${t.likes || 0}</span>
                        </button>
                        
                        <div class="ml-auto flex gap-2">
                             ${(author === state.currentUser?.id || localStorage.getItem('rbx_role') === 'admin' || localStorage.getItem('rbx_role') === 'moderator') ? `
                                <button class="material-symbols-outlined text-white/10 hover:text-error transition-colors text-lg" onclick="window.deleteThread('${id}')">delete</button>
                            ` : ""}
                            <button class="material-symbols-outlined text-white/10 hover:text-white transition-colors text-lg" onclick="window.reportThread('${id}')">flag</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- ACTIONS & PUBLISHING ---

async function publishTransmission() {
    const content = elements.composerInput.value.trim();
    if (!content && !state.mediaPreview) return;

    elements.postBtn.disabled = true;
    elements.postBtn.innerText = "Broadcasting...";

    try {
        const threadData = {
            author: state.currentUser.id,
            content: content,
            avatar: state.currentUser.avatar
        };

        if (state.mediaPreview) {
            threadData.media_url = state.mediaPreview;
        }

        const { data, error } = await window.supabaseClient.from('threads').insert([threadData]).select().single();

        if (error) {
            console.error("Broadcast Error:", error);
            // If media_url failed, try one more time without it as a safety fallback
            if (error.message.includes('media_url')) {
                delete threadData.media_url;
                const retry = await window.supabaseClient.from('threads').insert([threadData]).select().single();
                if (!retry.error) {
                    if (retry.data) {
                        const exists = state.threads.find(t => t.id === retry.data.id);
                        if (!exists) { state.threads.unshift(retry.data); renderFeed(); }
                    }
                    // Success on retry
                    finishPublishing();
                    return;
                }
            }
            alert("Broadcast Failed [Network Error]: " + error.message);
            elements.postBtn.disabled = false;
            elements.postBtn.innerText = "Broadcast";
            return;
        }

        if (data) {
            const exists = state.threads.find(t => t.id === data.id);
            if (!exists) { state.threads.unshift(data); renderFeed(); }
        }
        finishPublishing();
    } catch (e) {
        alert("Broadcast Failed [Runtime Exception]: " + e.message);
        elements.postBtn.disabled = false;
        elements.postBtn.innerText = "Broadcast";
    }
}

function finishPublishing() {
    // Clear Composer and re-enable button
    elements.composerInput.value = '';
    elements.postBtn.disabled = true;  // stays disabled until user types
    elements.postBtn.innerText = "Broadcast";
    window.removePreview();
    updateSideStats();
}

window.toggleLike = async (id) => {
    if (!window.supabaseClient) return;

    const thread = state.threads.find(t => t.id === id);
    if (!thread) return;

    const likedKey = `liked_${id}`;
    const isLiked = localStorage.getItem(likedKey);
    const newLikes = (thread.likes || 0) + (isLiked ? -1 : 1);

    // Optimistic Update
    if (isLiked) localStorage.removeItem(likedKey);
    else localStorage.setItem(likedKey, 'true');

    thread.likes = newLikes;
    const node = document.getElementById(`thread-${id}`);
    if (node) node.outerHTML = renderThreadHTML(thread);

    // Sync DB
    await window.supabaseClient
        .from('threads')
        .update({ likes: newLikes })
        .eq('id', id);
};

window.toggleRepost = async (id) => {
    if (!window.supabaseClient) return;
    
    const thread = state.threads.find(t => t.id === id);
    if (!thread) return;

    const repostedKey = `reposted_${id}`;
    const isReposted = localStorage.getItem(repostedKey);
    const newReposts = (thread.reposts || 0) + (isReposted ? -1 : 1);
    
    if (isReposted) localStorage.removeItem(repostedKey);
    else localStorage.setItem(repostedKey, 'true');
    
    thread.reposts = newReposts;
    const node = document.getElementById(`thread-${id}`);
    if (node) node.outerHTML = renderThreadHTML(thread);

    await window.supabaseClient.from('threads').update({ reposts: newReposts }).eq('id', id);
};

window.toggleReply = async (id) => {
    if (!window.supabaseClient) return;
    
    const thread = state.threads.find(t => t.id === id);
    if (!thread) return;

    const repliedKey = `replied_${id}`;
    const isReplied = localStorage.getItem(repliedKey);
    const newReplies = (thread.replies || 0) + (isReplied ? -1 : 1);
    
    if (isReplied) localStorage.removeItem(repliedKey);
    else localStorage.setItem(repliedKey, 'true');
    
    thread.replies = newReplies;
    const node = document.getElementById(`thread-${id}`);
    if (node) node.outerHTML = renderThreadHTML(thread);

    await window.supabaseClient.from('threads').update({ replies: newReplies }).eq('id', id);
};

window.deleteThread = async (id) => {
    if (!confirm("Are you sure you want to purge this transmission from the matrix?")) return;
    const { error } = await window.supabaseClient.from('threads').delete().eq('id', id);
    if (!error) {
        state.threads = state.threads.filter(t => t.id !== id);
        renderFeed();
    } else {
        alert("Delete failed: Insufficient clearance or network error.");
    }
};

window.reportThread = async (id) => {
    const thread = state.threads.find(t => t.id === id);
    if (!thread) return;
    
    const reason = prompt("Enter reason for reporting this transmission:");
    if (reason) {
        window.reportContent('threads', id, {
            author: thread.author,
            content: thread.content,
            reason: reason
        });
    }
};

// --- MEDIA & EXTRAS ---

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !window.supabaseClient) return;

    // Reset the input so the same file can be re-selected after an error
    event.target.value = '';

    // MIME type whitelist — reject SVG and executables to prevent XSS (bug #28 / S4)
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`File type "${file.type}" is not allowed. Please upload PNG, JPEG, WEBP, or GIF images.`);
        elements.postBtn.disabled = !elements.composerInput.value.trim();
        return;
    }

    // File size check — Supabase default limit is 5 MB (bug #69)
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_SIZE_MB} MB.`);
        elements.postBtn.disabled = !elements.composerInput.value.trim();
        return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `threads/${fileName}`;

    elements.postBtn.innerText = "Uploading...";
    elements.postBtn.disabled = true;

    const { error } = await window.supabaseClient.storage
        .from('attachments')
        .upload(filePath, file);

    if (error) {
        alert("Upload failed: " + error.message);
        elements.postBtn.innerText = "Broadcast";
        // Always re-enable the button after upload failure (bug #29)
        elements.postBtn.disabled = false;
        return;
    }

    const { data: { publicUrl } } = window.supabaseClient.storage
        .from('attachments')
        .getPublicUrl(filePath);

    setPreview(publicUrl);
    elements.postBtn.innerText = "Broadcast";
}

function setPreview(url) {
    state.mediaPreview = url;
    elements.mediaPreviewContent.innerHTML = `<img src="${url}" style="width: 100%; border-radius: 12px; display: block;">`;
    elements.mediaPreview.classList.remove('hidden');
    elements.postBtn.disabled = false;
}

window.removePreview = () => {
    state.mediaPreview = null;
    if (elements.mediaPreviewContent) elements.mediaPreviewContent.innerHTML = '';
    if (elements.mediaPreview) elements.mediaPreview.classList.add('hidden');
    if (elements.postBtn && elements.composerInput) elements.postBtn.disabled = !elements.composerInput.value.trim();
};

window.toggleGifPicker = () => {
    state.gifOpen = !state.gifOpen;
    elements.gifPicker.classList.toggle('hidden', !state.gifOpen);
    if (state.gifOpen) {
        // Reset search state so stale text doesn't show while trending loads
        if (elements.gifSearchInput) elements.gifSearchInput.value = '';
        searchGifs('');
    }
};

async function searchGifs(query) {
    if (!elements.gifGrid) return;
    elements.gifGrid.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-soft);">Loading GIFs...</p>';

    const url = query
        ? `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/search?q=${encodeURIComponent(query.trim())}&limit=20`
        : `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/trending?limit=20`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Klipy API responded with status ${resp.status}`);

        const json = await resp.json();
        const results = (json.data && Array.isArray(json.data.data)) ? json.data.data : [];

        if (results.length === 0) {
            elements.gifGrid.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-soft);">No GIFs found.</p>';
            return;
        }

        elements.gifGrid.innerHTML = results.map(g => {
            const gifUrl = g?.file?.gif || '';
            if (!gifUrl) return '';
            return `<img src="${gifUrl}" style="width:100%; border-radius:8px; cursor:pointer;" onclick="selectGif('${gifUrl}')">`;
        }).join('');
    } catch (e) {
        console.error('[Threads] Klipy Fetch Fail:', e);
        elements.gifGrid.innerHTML = '<p style="padding: 12px; text-align: center; color: #f91880;">GIF service is currently unavailable.</p>';
    }
}

window.selectGif = (url) => {
    setPreview(url);
    window.toggleGifPicker();
};

if (document.getElementById("gif-search-in")) {
    let timeout = null;
    document.getElementById("gif-search-in").addEventListener("input", (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => searchGifs(e.target.value), 400);
    });
}

// --- INTELLIGENCE PANEL (Trends & Stats) ---

function updateTrendsEngine() {
    if (!elements.trendList) return;
    const tags = {};
    state.threads.forEach(t => {
        const matches = (t.content || '').match(/#\w+/g);
        if (matches) matches.forEach(m => tags[m] = (tags[m] || 0) + 1);
    });

    const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) {
        elements.trendList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-soft); font-size: 0.8rem;">Awaiting metadata...</div>';
        return;
    }

    elements.trendList.innerHTML = sorted.map(([tag, count], idx) => `
        <div class="group cursor-pointer p-3 hover:bg-white/5 rounded-2xl transition-all" onclick="window.searchFor('${tag}')">
            <div class="flex justify-between items-start mb-1">
                <p class="text-primary text-sm font-bold tracking-tight">${tag}</p>
                <span class="text-[10px] font-mono text-white/20">#${idx + 1}</span>
            </div>
            <p class="text-[10px] font-mono text-white/40 uppercase tracking-tighter">${count} transmissions • ${count > 5 ? 'Rising' : 'Active'}</p>
        </div>
    `).join('');
}

window.searchFor = (query) => {
    query = query.toLowerCase();
    const items = document.querySelectorAll('.thread-item');
    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(query) ? 'flex' : 'none';
    });
};

async function updateSideStats() {
    if (!state.currentUser || !window.supabaseClient) return;
    try {
        const { count: followers } = await window.supabaseClient.from('follows').select('*', { count: 'exact', head: true }).eq('following', state.currentUser.id);
        const { count: posts } = await window.supabaseClient.from('threads').select('*', { count: 'exact', head: true }).eq('author', state.currentUser.id);

        if (document.getElementById('stat-followers')) document.getElementById('stat-followers').innerText = followers || 0;
        if (document.getElementById('stat-posts')) document.getElementById('stat-posts').innerText = posts || 0;
    } catch (e) { }
}
