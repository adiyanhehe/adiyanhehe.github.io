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

    // Sidebar
    elements.sidePic = document.getElementById("side-pic");
    elements.sideName = document.getElementById("side-name");
}

// Ensure Supabase is fully loaded from global.js before running app logic
const initInterval = setInterval(() => {
    if (window.supabaseClient && !state.initialized) {
        state.initialized = true;
        clearInterval(initInterval);
        initializeThreads();
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

    const myPic = document.getElementById('my-pic');
    if (myPic) myPic.src = avatar;

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
        .select('*')
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
    content = content.replace(/@(\w+)/g, '<span class="accent-text" style="color: var(--accent); cursor: pointer;">@$1</span>');
    content = content.replace(/#(\w+)/g, '<span class="accent-text" style="color: var(--accent); cursor: pointer;">#$1</span>');

    return `
        <div class="glass-panel thread-item" id="thread-${id}">
            <div class="thread-user-side">
                <img src="${avatar}" class="thread-avatar" onclick="window.showProfileSummary('${author}')">
                <div class="thread-line"></div>
            </div>
            <div class="thread-content">
                <div class="thread-header" style="justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <h4 onclick="window.showProfileSummary('${author}')">${author}</h4>
                        ${author.toLowerCase() === 'adiyan' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="#1d9bf0" style="margin-top: 2px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' : ''}
                        <span class="thread-handle">@${author.toLowerCase()}</span>
                        <span class="thread-time">· ${time}</span>
                    </div>
                </div>
                <div class="thread-text">${content}</div>
                ${t.media_url ? `<div class="thread-media" style="margin-top: 12px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border);"><img src="${t.media_url}" style="width: 100%; display: block;" loading="lazy"></div>` : ''}
                <div class="thread-actions">
                    <button class="action-btn ${isReplied ? 'liked' : ''}" onclick="window.toggleReply('${id}')" style="display: flex; align-items: center; gap: 6px; transition: 0.2s; color: ${isReplied ? '#1d9bf0' : 'var(--text-soft)'};">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        <span>${t.replies || 0}</span>
                    </button>
                    <button class="action-btn ${isReposted ? 'liked' : ''}" onclick="window.toggleRepost('${id}')" style="display: flex; align-items: center; gap: 6px; transition: 0.2s; color: ${isReposted ? '#00ba7c' : 'var(--text-soft)'};">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2"><path d="M17 1l4 4-4 4m6 0l-4 4 4 4M2 13h15M2 5h19"/></svg>
                        <span>${t.reposts || 0}</span>
                    </button>
                    <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="window.toggleLike('${id}')" style="color: ${isLiked ? '#f91880' : 'var(--text-soft)'}; display: flex; align-items: center; gap: 6px; transition: 0.2s;">
                        <svg viewBox="0 0 24 24" fill="${isLiked ? '#f91880' : 'none'}" stroke="${isLiked ? '#f91880' : 'currentColor'}" width="20" height="20" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        <span>${t.likes || 0}</span>
                    </button>
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
            avatar: state.currentUser.avatar,
            avatar_url: state.currentUser.avatar  // write both so renderThreadHTML works on realtime & re-render
        };

        // Only include media_url if it's actually present to avoid schema errors
        if (state.mediaPreview) {
            threadData.media_url = state.mediaPreview;
        }

        const { data, error } = await window.supabaseClient.from('threads').insert([threadData]).select().single();

        if (error) {
            // Check for common schema errors and provide a helpful message
            if (error.message.includes('media_url')) {
                alert("Database Update Required: Please add the 'media_url' column to your 'threads' table in Supabase.");
            } else if (error.message.includes('avatar_url')) {
                // Retry without avatar_url if column doesn't exist yet
                delete threadData.avatar_url;
                const { data: retryData, error: retryError } = await window.supabaseClient.from('threads').insert([threadData]).select().single();
                if (retryError) {
                    alert("Broadcast Failed [Network Error]: " + retryError.message);
                    elements.postBtn.disabled = false;
                    elements.postBtn.innerText = "Broadcast";
                    return;
                }
                // Optimistic push on retry success
                if (retryData) {
                    const exists = state.threads.find(t => t.id === retryData.id);
                    if (!exists) { state.threads.unshift(retryData); renderFeed(); }
                }
            } else {
                alert("Broadcast Failed [Network Error]: " + error.message);
                elements.postBtn.disabled = false;
                elements.postBtn.innerText = "Broadcast";
                return;
            }
        } else {
            // Force optimistic render instantly in case Realtime API isn't catching it
            if (data) {
                const exists = state.threads.find(t => t.id === data.id);
                if (!exists) { state.threads.unshift(data); renderFeed(); }
            }
        }
    } catch(e) {
        alert("Broadcast Failed [Runtime Exception]: " + e.message);
        elements.postBtn.disabled = false;
        elements.postBtn.innerText = "Broadcast";
        return;
    }

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

// --- MEDIA & EXTRAS ---

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !window.supabaseClient) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `threads/${fileName}`;

    elements.postBtn.innerText = "Encrypting...";
    elements.postBtn.disabled = true;

    const { error } = await window.supabaseClient.storage
        .from('attachments')
        .upload(filePath, file);

    if (error) {
        alert("Upload Corrupted");
        elements.postBtn.innerText = "Broadcast";
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
    if (state.gifOpen) searchGifs('');
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
        <div class="trend-item" onclick="window.searchFor('${tag}')" style="padding: 12px; border-radius: var(--radius-lg); cursor: pointer; transition: 0.2s;">
            <div style="font-size: 0.75rem; color: var(--accent);">Trending #${idx + 1}</div>
            <div style="font-weight: 700; color: var(--text-main);">${tag}</div>
            <div style="font-size: 0.7rem; color: var(--text-soft);">${count} transmission${count > 1 ? 's' : ''}</div>
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
