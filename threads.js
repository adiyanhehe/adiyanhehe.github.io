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
    elements.headerName = document.getElementById("header-user-name");
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
            console.error('[Threads] initializeThreads failed:', e);
            cacheElements();
            bindEvents();
        }
        return;
    }

    if (!state.initialized && bootTicks > 60) {
        clearInterval(initInterval);
        cacheElements();
        bindEvents();
        if (elements.feed) {
            elements.feed.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-zinc-500 text-center opacity-40">
                    <span class="material-symbols-outlined text-5xl mb-4">wifi_off</span>
                    <p class="font-label-caps text-xs uppercase tracking-widest">Network Isolated</p>
                </div>`;
        }
    }
}, 100);

async function initializeThreads() {
    cacheElements();

    let session = null;
    try {
        const { data } = await window.supabaseClient.auth.getSession();
        session = data.session;
    } catch (e) { }

    let username = 'Anonymous';
    let displayName = 'Neural User';
    let avatar = 'jay.png';

    if (session) {
        const emailPrefix = session.user.email.split('@')[0];
        username = (localStorage.getItem('rbx_user') || emailPrefix).toLowerCase();
        avatar = localStorage.getItem('rbx_pic') || 'jay.png';
        displayName = localStorage.getItem('rbx_display_name') || username;
        
        // Final fallback to DB if localStorage is missing
        const { data: profile } = await window.supabaseClient.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (profile) {
            username = profile.username || username;
            displayName = profile.display_name || displayName;
            avatar = profile.avatar_url || avatar;
        }
    }

    state.currentUser = { id: username, name: displayName, avatar: avatar };

    // Update UI
    if (elements.sidePic) elements.sidePic.src = avatar;
    if (elements.sideName) elements.sideName.innerText = displayName;
    if (elements.headerName) elements.headerName.innerText = displayName.toUpperCase();

    elements.myPics.forEach(pic => {
        if (pic) pic.src = avatar;
    });

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

async function fetchCloudThreads() {
    if (!elements.feed) return;
    
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
        console.error("Sync Error:", error);
        return;
    }

    state.threads = data || [];
    renderFeed();
}

function setupRealtime() {
    window.supabaseClient
        .channel('public:threads')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threads' }, async payload => {
            // Fetch profile for the new post to maintain badge logic
            const { data: prof } = await window.supabaseClient.from('profiles').select('role,is_admin,display_name,avatar_url').eq('username', payload.new.author).maybeSingle();
            const newThread = { ...payload.new, profiles: prof };
            state.threads.unshift(newThread);
            renderFeed();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'threads' }, payload => {
            const idx = state.threads.findIndex(t => t.id === payload.new.id);
            if (idx !== -1) {
                // Merge new counts but preserve existing profile data
                state.threads[idx] = { ...state.threads[idx], ...payload.new };
                const node = document.getElementById(`thread-${payload.new.id}`);
                if (node) node.outerHTML = renderThreadHTML(state.threads[idx]);
            }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'threads' }, payload => {
            state.threads = state.threads.filter(t => t.id !== payload.old.id);
            renderFeed();
        })
        .subscribe();
}

function renderFeed() {
    if (!elements.feed) return;

    if (state.threads.length === 0) {
        elements.feed.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-zinc-500 text-center opacity-40">
                <span class="material-symbols-outlined text-5xl mb-4">sensors_off</span>
                <p class="font-label-caps text-xs uppercase tracking-widest">No Signals Detected</p>
            </div>`;
        return;
    }

    elements.feed.innerHTML = state.threads.map(t => renderThreadHTML(t)).join('');
    updateTrendsEngine();
}

function esc(s) { return s?String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])):""; }

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
    const avatar = t.profiles?.avatar_url || t.avatar || 'jay.png';
    const isLiked = localStorage.getItem(`liked_${id}`);
    const isReposted = localStorage.getItem(`reposted_${id}`);

    let content = esc(t.content || '');
    content = content.replace(/@(\w+)/g, '<span class="text-primary font-bold cursor-pointer hover:underline">@$1</span>');
    content = content.replace(/#(\w+)/g, '<span class="text-tertiary font-bold cursor-pointer hover:underline">#$1</span>');

    const isAdmin = t.profiles?.role === 'admin' || t.profiles?.is_admin;
    const isMod = t.profiles?.role === 'moderator';
    const isOwner = author.toLowerCase() === 'adiyan';

    return `
        <article class="glass-panel p-md rounded-xl space-y-4 relative group hover:border-white/20 transition-all" id="thread-${id}">
            <div class="flex items-start gap-4">
                <div class="relative">
                    <img src="${avatar}" class="w-12 h-12 rounded-lg border border-purple-500/20 object-cover cursor-pointer hover:scale-105 transition-transform" onclick="window.location.href='profile.html?user=${author}'">
                    ${isOwner ? '<div class="absolute -bottom-1 -right-1 bg-primary text-black rounded-full p-0.5"><span class="material-symbols-outlined text-[10px] block" style="font-variation-settings: \'FILL\' 1;">verified</span></div>' : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-1">
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span class="text-white font-bold text-sm tracking-tighter uppercase cursor-pointer hover:text-primary transition-colors" onclick="window.location.href='profile.html?user=${author}'">${esc(t.profiles?.display_name || author)}</span>
                            <span class="text-zinc-500 text-[10px] font-mono">@${author.toLowerCase()}</span>
                            <span class="text-zinc-600 text-[10px] font-mono">· ${time}</span>
                            ${isAdmin ? `<span class="bg-primary/10 text-primary text-[8px] font-bold px-1.5 py-0.5 rounded border border-primary/30 uppercase tracking-widest">OVERSEER</span>` : ""}
                        </div>
                        <button class="material-symbols-outlined text-zinc-600 hover:text-white transition-colors" onclick="window.reportThread('${id}')">more_vert</button>
                    </div>
                    <p class="text-on-surface-variant font-body-md leading-relaxed whitespace-pre-wrap mb-4">${content}</p>
                    
                    ${t.media_url ? `
                        <div class="rounded-lg overflow-hidden border border-white/5 bg-black/20 mb-4">
                            <img src="${t.media_url}" class="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity" loading="lazy">
                        </div>
                    ` : ''}

                    <div class="flex items-center gap-6">
                        <button class="flex items-center gap-2 text-zinc-500 hover:text-primary transition-colors group/btn" onclick="window.toggleReply('${id}')">
                            <span class="material-symbols-outlined text-[18px]">chat_bubble</span>
                            <span class="text-[10px] font-mono">${t.replies || 0}</span>
                        </button>
                        <button class="flex items-center gap-2 ${isReposted ? 'text-tertiary' : 'text-zinc-500'} hover:text-tertiary transition-colors group/btn" onclick="window.toggleRepost('${id}')">
                            <span class="material-symbols-outlined text-[18px]">repeat</span>
                            <span class="text-[10px] font-mono">${t.reposts || 0}</span>
                        </button>
                        <button class="flex items-center gap-2 ${isLiked ? 'text-primary' : 'text-zinc-500'} hover:text-primary transition-colors group/btn" onclick="window.toggleLike('${id}')">
                            <span class="material-symbols-outlined text-[18px]" style="${isLiked ? 'font-variation-settings: \'FILL\' 1;' : ''}">favorite</span>
                            <span class="text-[10px] font-mono">${t.likes || 0}</span>
                        </button>
                        
                        ${(author === state.currentUser?.id || localStorage.getItem('rbx_role') === 'admin') ? `
                            <button class="ml-auto material-symbols-outlined text-zinc-800 hover:text-error transition-colors text-lg" onclick="window.deleteThread('${id}')">delete</button>
                        ` : ""}
                    </div>
                </div>
            </div>
        </article>
    `;
}

async function publishTransmission() {
    const content = elements.composerInput.value.trim();
    if (!content && !state.mediaPreview) return;
    if (!state.currentUser) {
        alert("CRITICAL ERROR: Neural ID not found. Re-syncing...");
        location.reload();
        return;
    }

    elements.postBtn.disabled = true;
    const originalText = elements.postBtn.innerText;
    elements.postBtn.innerText = "SYNCING...";

    try {
        const threadData = {
            author: state.currentUser.id,
            content: content,
            avatar: state.currentUser.avatar
        };

        if (state.mediaPreview) threadData.media_url = state.mediaPreview;

        const { data, error } = await window.supabaseClient.from('threads').insert([threadData]).select().single();

        if (error) {
            console.error("Broadcast Fail:", error);
            alert("Broadcast Interrupted: " + error.message);
            elements.postBtn.disabled = false;
            elements.postBtn.innerText = originalText;
            return;
        }

        if (data && !state.threads.find(t => t.id === data.id)) {
            state.threads.unshift(data);
            renderFeed();
        }

        finishPublishing();
    } catch (e) {
        console.error("Runtime Exception:", e);
        elements.postBtn.disabled = false;
        elements.postBtn.innerText = originalText;
    }
}

function finishPublishing() {
    elements.composerInput.value = '';
    elements.postBtn.disabled = true;
    elements.postBtn.innerText = "BROADCAST";
    window.removePreview();
    updateSideStats();
}

window.toggleLike = async (id) => {
    const thread = state.threads.find(t => t.id === id);
    if (!thread) return;

    const likedKey = `liked_${id}`;
    const isLiked = localStorage.getItem(likedKey);
    const newLikes = Math.max(0, (thread.likes || 0) + (isLiked ? -1 : 1));

    if (isLiked) localStorage.removeItem(likedKey);
    else localStorage.setItem(likedKey, 'true');

    thread.likes = newLikes;
    const node = document.getElementById(`thread-${id}`);
    if (node) node.outerHTML = renderThreadHTML(thread);

    await window.supabaseClient.from('threads').update({ likes: newLikes }).eq('id', id);
};

window.toggleRepost = async (id) => {
    const thread = state.threads.find(t => t.id === id);
    if (!thread) return;

    const repostedKey = `reposted_${id}`;
    const isReposted = localStorage.getItem(repostedKey);
    const newReposts = Math.max(0, (thread.reposts || 0) + (isReposted ? -1 : 1));

    if (isReposted) localStorage.removeItem(repostedKey);
    else localStorage.setItem(repostedKey, 'true');

    thread.reposts = newReposts;
    const node = document.getElementById(`thread-${id}`);
    if (node) node.outerHTML = renderThreadHTML(thread);

    await window.supabaseClient.from('threads').update({ reposts: newReposts }).eq('id', id);
};

window.toggleReply = async (id) => {
    const thread = state.threads.find(t => t.id === id);
    if (!thread) return;
    elements.composerInput.value = `@${thread.author} `;
    elements.composerInput.focus();
};

window.deleteThread = async (id) => {
    if (!confirm("Purge this signal from the network?")) return;
    const { error } = await window.supabaseClient.from('threads').delete().eq('id', id);
    if (error) alert("Clearance denied.");
};

window.reportThread = async (id) => {
    const reason = prompt("Query abnormality reason:");
    if (reason) alert("Signal flagged for Overseer review.");
};

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !window.supabaseClient) return;

    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
        alert("PROTOCOL ERROR: Invalid file type.");
        return;
    }

    const fileName = `${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`;
    const filePath = `threads/${fileName}`;

    elements.postBtn.innerText = "UPLOADING...";
    elements.postBtn.disabled = true;

    const { error } = await window.supabaseClient.storage.from('attachments').upload(filePath, file);

    if (error) {
        alert("Upload Failed: " + error.message);
        elements.postBtn.innerText = "BROADCAST";
        elements.postBtn.disabled = false;
        return;
    }

    const { data: { publicUrl } } = window.supabaseClient.storage.from('attachments').getPublicUrl(filePath);
    setPreview(publicUrl);
    elements.postBtn.innerText = "BROADCAST";
}

function setPreview(url) {
    state.mediaPreview = url;
    if (elements.mediaPreviewContent) elements.mediaPreviewContent.innerHTML = `<img src="${url}" class="w-full block">`;
    if (elements.mediaPreview) elements.mediaPreview.classList.remove('hidden');
    if (elements.postBtn) elements.postBtn.disabled = false;
}

window.removePreview = () => {
    state.mediaPreview = null;
    if (elements.mediaPreviewContent) elements.mediaPreviewContent.innerHTML = '';
    if (elements.mediaPreview) elements.mediaPreview.classList.add('hidden');
    if (elements.postBtn && elements.composerInput) elements.postBtn.disabled = !elements.composerInput.value.trim();
};

window.toggleGifPicker = () => {
    state.gifOpen = !state.gifOpen;
    if (elements.gifPicker) elements.gifPicker.classList.toggle('hidden', !state.gifOpen);
    if (state.gifOpen) searchGifs('');
};

async function searchGifs(query) {
    if (!elements.gifGrid) return;
    elements.gifGrid.innerHTML = '<div class="col-span-2 py-8 text-center text-zinc-600 animate-pulse font-label-caps text-xs">Accessing Klipy Matrix...</div>';

    const url = query
        ? `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/search?q=${encodeURIComponent(query.trim())}&limit=20`
        : `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/trending?limit=20`;

    try {
        const resp = await fetch(url);
        const json = await resp.json();
        const results = json.data?.data || [];

        elements.gifGrid.innerHTML = results.map(g => `
            <img src="${g.file.gif}" class="w-full h-auto rounded-lg cursor-pointer hover:scale-105 transition-transform" onclick="selectGif('${g.file.gif}')">
        `).join('') || '<div class="col-span-2 py-8 text-center text-zinc-600">No signals found.</div>';
    } catch (e) {
        elements.gifGrid.innerHTML = '<div class="col-span-2 py-8 text-center text-error">Signal lost.</div>';
    }
}

window.selectGif = (url) => {
    setPreview(url);
    window.toggleGifPicker();
};

function updateTrendsEngine() {
    if (!elements.trendList) return;
    const tags = {};
    state.threads.forEach(t => {
        const matches = (t.content || '').match(/#\w+/g);
        if (matches) matches.forEach(m => tags[m] = (tags[m] || 0) + 1);
    });

    const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 5);
    elements.trendList.innerHTML = sorted.map(([tag, count], idx) => `
        <div class="group cursor-pointer p-4 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10" onclick="alert('Querying: ${tag}')">
            <div class="flex justify-between items-start mb-1">
                <p class="text-primary text-sm font-bold tracking-tight">${tag.toUpperCase()}</p>
                <span class="text-[10px] font-mono text-zinc-600">#${idx + 1}</span>
            </div>
            <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">${count} TRANSMISSIONS</p>
        </div>
    `).join('') || '<div class="p-4 text-center text-zinc-600 text-xs">No active trends.</div>';
}

async function updateSideStats() {
    if (!state.currentUser || !window.supabaseClient) return;
    try {
        const { count: followers } = await window.supabaseClient.from('follows').select('*', { count: 'exact', head: true }).eq('following', state.currentUser.id);
        const { count: posts } = await window.supabaseClient.from('threads').select('*', { count: 'exact', head: true }).eq('author', state.currentUser.id);
        if (document.getElementById('stat-followers')) document.getElementById('stat-followers').innerText = followers || 0;
        if (document.getElementById('stat-posts')) document.getElementById('stat-posts').innerText = posts || 0;
    } catch (e) { }
}
 (e) { }
}
