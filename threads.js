// Threads 2.0 - Powered by Supabase
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
    elements.sideHandle = document.getElementById("side-handle");
    elements.mediaPreview = document.getElementById("media-preview");
    elements.mediaPreviewContent = document.getElementById("media-preview-content");
    elements.fileInput = document.getElementById("fileInput");
    elements.gifPicker = document.getElementById("gif-picker");
    elements.gifGrid = document.getElementById("gif-grid");
    elements.gifSearchInput = document.getElementById("gif-search-in");
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
    elements.feed.innerHTML = state.threads.map(t => renderThread(t)).join('');
}

function renderThread(t) {
    const time = formatTime(t.timestamp);
    const hasMedia = t.image_url || t.gif_url;
    
    // Parse text for hashtags/mentions
    let content = escapeHtml(t.content);
    content = content.replace(/@(\w+)/g, '<span class="accent-text">@$1</span>');
    content = content.replace(/#(\w+)/g, '<span class="accent-text">#$1</span>');

    return `
        <div class="glass-panel thread-item">
            <div class="thread-user-side">
                <img src="${t.avatar || 'jay.png'}" class="thread-avatar" onclick="window.showProfileSummary('${t.author}')">
                <div class="thread-line"></div>
            </div>
            <div class="thread-content">
                <div class="thread-header">
                    <h4 onclick="window.showProfileSummary('${t.author}')">${t.author}</h4>
                    <span class="thread-handle">@${t.author.toLowerCase()}</span>
                    <span class="thread-time">· ${time}</span>
                </div>
                <div class="thread-text">${content}</div>
                ${t.media_url ? `<div class="thread-media"><img src="${t.media_url}" loading="lazy"></div>` : ''}
                <div class="thread-actions">
                    <button class="action-btn" onclick="toggleLike('${t.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        <span>${t.likes || 0}</span>
                    </button>
                    <button class="action-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        <span>0</span>
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

function setPreview(url) {
    state.mediaPreview = url;
    elements.mediaPreviewContent.innerHTML = `<img src="${url}">`;
    elements.mediaPreview.classList.add('active');
    elements.postBtn.disabled = false;
}

function removePreview() {
    state.mediaPreview = null;
    elements.mediaPreviewContent.innerHTML = '';
    elements.mediaPreview.classList.remove('active');
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
    const thread = state.threads.find(t => t.id === id);
    if (!thread) return;

    const likedKey = `liked_${id}`;
    const isLiked = localStorage.getItem(likedKey);
    
    // Optimistic UI
    const delta = isLiked ? -1 : 1;
    thread.likes = (thread.likes || 0) + delta;
    if (isLiked) localStorage.removeItem(likedKey);
    else localStorage.setItem(likedKey, 'true');
    renderFeed();

    // DB Update
    await window.supabaseClient.rpc('increment_likes', { thread_id: id, delta: delta });
    
    // Fallback if RPC fails:
    const { error } = await window.supabaseClient
        .from('threads')
        .update({ likes: thread.likes })
        .eq('id', id);
};

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
