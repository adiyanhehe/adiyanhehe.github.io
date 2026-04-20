const GIPHY_API_KEY = "dc6zaTOxFJmzC";

const state = {
    currentUser: null,
    threads: [],
    mediaPreview: null,
    gifOpen: false,
    loading: false
};

const elements = {};

function cacheElements() {
    elements.feed = document.getElementById("feed");
    elements.composerInput = document.getElementById("post-in");
    elements.postBtn = document.getElementById("post-btn");
    elements.sidePic = document.getElementById("side-pic");
    elements.sideName = document.getElementById("side-name");
    
    // New Pulse-style Elements
    elements.mediaPreview = document.getElementById("media-preview");
    elements.mediaPreviewContent = document.getElementById("media-preview-content");
    elements.fileInput = document.getElementById("fileInput");
    elements.gifPicker = document.getElementById("gif-picker");
    elements.gifGrid = document.getElementById("gif-grid");
    elements.gifSearchInput = document.getElementById("gif-search-in");
    elements.trendList = document.getElementById("trend-list");
}

async function initialize() {
    cacheElements();
    
    // Auth Check
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        document.getElementById('login-gate').style.display = 'flex';
        return;
    }

    const user = session.user;
    const username = localStorage.getItem('rbx_user') || user.email.split('@')[0];
    const avatar = localStorage.getItem('rbx_pic') || 'jay.png';
    
    state.currentUser = { id: username, name: username, avatar: avatar };

    // Update UI
    if (elements.sidePic) elements.sidePic.src = avatar;
    if (elements.sideName) elements.sideName.innerText = username;
    if (elements.sideHandle) elements.sideHandle.innerText = '@' + username.toLowerCase();
    const myPic = document.getElementById('my-pic');
    if (myPic) myPic.src = avatar;

    bindEvents();
    await loadThreads();
    await updateStats();
    setupSubscriptions();
}

function bindEvents() {
    elements.composerInput.addEventListener("input", () => {
        elements.postBtn.disabled = !elements.composerInput.value.trim() && !state.mediaPreview;
    });

    elements.postBtn.addEventListener("click", postThread);
    elements.fileInput.addEventListener("change", handleFileUpload);
}

async function loadThreads() {
    state.loading = true;
    const { data, error } = await window.supabaseClient
        .from('threads')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

    if (error) {
        console.error("Load error:", error);
        return;
    }

    state.threads = data || [];
    renderFeed();
}

function setupSubscriptions() {
    window.supabaseClient
        .channel('threads-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threads' }, payload => {
            state.threads.unshift(payload.new);
            renderFeed();
        })
        .subscribe();
}

function renderFeed() {
    if (!elements.feed) return;
    elements.feed.innerHTML = state.threads.map(t => renderThread(t)).join('');
    // Scroll to top on new posts if it was just posted
    updateTrends();
}

function updateTrends() {
    if (!elements.trendList) return;
    const tags = {};
    state.threads.forEach(t => {
        const matches = t.content.match(/#\w+/g);
        if (matches) matches.forEach(m => tags[m] = (tags[m] || 0) + 1);
    });
    
    const sorted = Object.entries(tags).sort((a,b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) {
        elements.trendList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-soft); font-size: 0.8rem;">Awaiting metadata...</div>';
        return;
    }

    elements.trendList.innerHTML = sorted.map(([tag, count], idx) => `
        <div class="trend-item" onclick="window.searchFor('${tag}')">
            <div style="font-size: 0.75rem; color: var(--accent);">Trending #${idx + 1}</div>
            <div style="font-weight: 700;">${tag}</div>
            <div style="font-size: 0.7rem; color: var(--text-soft);">${count} transmission${count > 1 ? 's' : ''}</div>
        </div>
    `).join('');
}

window.searchFor = (q) => {
    const query = q.replace('#', '').toLowerCase();
    const items = document.querySelectorAll('.thread-item');
    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(query) ? 'flex' : 'none';
    });
};

function renderThread(t) {
    const time = formatTime(t.timestamp);
    const isLiked = localStorage.getItem(`liked_${t.id}`);
    const isMe = state.currentUser && t.author === state.currentUser.id;
    
    // Parse text for hashtags/mentions
    let content = escapeHtml(t.content);
    content = content.replace(/@(\w+)/g, '<span class="accent-text" style="color: var(--accent); cursor: pointer;">@$1</span>');
    content = content.replace(/#(\w+)/g, '<span class="accent-text" style="color: var(--accent); cursor: pointer;">#$1</span>');

    return `
        <div class="glass-panel thread-item">
            <div class="thread-user-side">
                <img src="${t.avatar || 'jay.png'}" class="thread-avatar" onclick="window.showProfileSummary('${t.author}')">
                <div class="thread-line"></div>
            </div>
            <div class="thread-content">
                <div class="thread-header" style="justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <h4 onclick="window.showProfileSummary('${t.author}')">${t.author}</h4>
                        ${t.author === 'adiyan' || t.author === 'Adigusi' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="#1d9bf0" style="margin-top: 2px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' : ''}
                        <span class="thread-handle">@${t.author.toLowerCase()}</span>
                        <span class="thread-time">· ${time}</span>
                    </div>
                    ${!isMe ? `
                        <button class="action-btn" onclick="window.toggleFollow('${t.author}')" style="background: var(--bg-panel-soft); padding: 4px 12px; border-radius: 99px; font-size: 0.75rem; font-weight: 700; color: var(--text-main);">Follow</button>
                    ` : ''}
                </div>
                <div class="thread-text">${content}</div>
                ${t.media_url ? `<div class="thread-media" style="margin-top: 12px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border);"><img src="${t.media_url}" loading="lazy" style="width: 100%; display: block;"></div>` : ''}
                <div class="thread-actions">
                    <button class="action-btn" style="color: var(--text-soft); display: flex; align-items: center; gap: 6px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        <span>${t.replies || 0}</span>
                    </button>
                    <button class="action-btn" style="color: var(--text-soft); display: flex; align-items: center; gap: 6px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2"><path d="M17 1l4 4-4 4m6 0l-4 4 4 4M2 13h15M2 5h19"/></svg>
                        <span>${t.reposts || 0}</span>
                    </button>
                    <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="window.toggleLike('${t.id}')" style="display: flex; align-items: center; gap: 6px; transition: 0.2s;">
                        <svg viewBox="0 0 24 24" fill="${isLiked ? '#f91880' : 'none'}" stroke="${isLiked ? '#f91880' : 'currentColor'}" width="20" height="20" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        <span>${t.likes || 0}</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function postThread() {
    const content = elements.composerInput.value.trim();
    if (!content && !state.mediaPreview) return;

    elements.postBtn.disabled = true;
    
    const threadData = {
        author: state.currentUser.id,
        content: content,
        avatar: state.currentUser.avatar,
        media_url: state.mediaPreview,
        timestamp: new Date().toISOString()
    };

    const { error } = await window.supabaseClient.from('threads').insert([threadData]);
    
    if (error) {
        alert("Failed to post: " + error.message);
        elements.postBtn.disabled = false;
        return;
    }

    elements.composerInput.value = '';
    removePreview();
    updateStats();
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `threads/${fileName}`;

    const { error: uploadError } = await window.supabaseClient.storage
        .from('attachments')
        .upload(filePath, file);

    if (uploadError) {
        alert("Upload failed");
        return;
    }

    const { data: { publicUrl } } = window.supabaseClient.storage
        .from('attachments')
        .getPublicUrl(filePath);

    setPreview(publicUrl);
}

window.removePreview = () => {
    state.mediaPreview = null;
    elements.mediaPreviewContent.innerHTML = '';
    elements.mediaPreview.classList.add('hidden');
    elements.postBtn.disabled = !elements.composerInput.value.trim();
};

function setPreview(url) {
    state.mediaPreview = url;
    elements.mediaPreviewContent.innerHTML = `<img src="${url}" style="width: 100%; border-radius: 12px; display: block;">`;
    elements.mediaPreview.classList.remove('hidden');
    elements.postBtn.disabled = false;
}

// GIF PICKER logic
window.toggleGifPicker = () => {
    state.gifOpen = !state.gifOpen;
    elements.gifPicker.classList.toggle('active', state.gifOpen);
    if (state.gifOpen) searchGifs('');
};

async function searchGifs(query) {
    const url = query 
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=15`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=15`;
    
    try {
        const resp = await fetch(url);
        const json = await resp.json();
        elements.gifGrid.innerHTML = json.data.map(g => `
            <img src="${g.images.fixed_height_small.url}" onclick="selectGif('${g.images.fixed_height.url}')">
        `).join('');
    } catch (e) {}
}

window.selectGif = (url) => {
    setPreview(url);
    window.toggleGifPicker();
};

window.toggleLike = async (id) => {
    // ... same as before but for brevity I'll just keep the existing block ...
    // Wait, I should implement the REAL toggleLike with DB updates.
    const thread = state.threads.find(t => t.id === id);
    if (!thread) return;

    const likedKey = `liked_${id}`;
    const isLiked = localStorage.getItem(likedKey);
    
    const delta = isLiked ? -1 : 1;
    thread.likes = (thread.likes || 0) + delta;
    if (isLiked) localStorage.removeItem(likedKey);
    else localStorage.setItem(likedKey, 'true');
    renderFeed();

    await window.supabaseClient
        .from('threads')
        .update({ likes: thread.likes })
        .eq('id', id);
};

window.toggleFollow = async (username) => {
    if (!state.currentUser || username === state.currentUser.id) return;

    const { data: existing } = await window.supabaseClient
        .from('follows')
        .select('*')
        .eq('follower', state.currentUser.id)
        .eq('following', username)
        .maybeSingle();

    if (existing) {
        await window.supabaseClient.from('follows').delete().eq('id', existing.id);
        if (window.showTopNotification) window.showTopNotification(`Unfollowed @${username}`, 'info');
    } else {
        await window.supabaseClient.from('follows').insert([{
            follower: state.currentUser.id,
            following: username
        }]);
        if (window.showTopNotification) window.showTopNotification(`Following @${username}`, 'success');
    }
    await updateStats();
};

async function updateStats() {
    if (!state.currentUser) return;
    
    const { count: followers } = await window.supabaseClient
        .from('follows').select('*', { count: 'exact', head: true }).eq('following', state.currentUser.id);
        
    const { count: following } = await window.supabaseClient
        .from('follows').select('*', { count: 'exact', head: true }).eq('follower', state.currentUser.id);

    const { count: posts } = await window.supabaseClient
        .from('threads').select('*', { count: 'exact', head: true }).eq('author', state.currentUser.id);

    document.getElementById('stat-followers').innerText = followers || 0;
    document.getElementById('stat-following').innerText = following || 0;
    document.getElementById('stat-posts').innerText = posts || 0;
}

function formatTime(ts) {
    const date = new Date(ts);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm';
    if (diff < 86400) return Math.floor(diff/3600) + 'h';
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", initialize);
