const GIPHY_API_KEY = "dc6zaTOxFJmzC";

// --- CORE UTILITIES (Matching Old Logic) ---
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
    if (diff < 3600) return Math.floor(diff/60) + 'm';
    if (diff < 86400) return Math.floor(diff/3600) + 'h';
    return date.toLocaleDateString();
}

// --- THREAD ENGINE (Design Maintained, Logic Reverted) ---
async function loadThreads() {
    const feed = document.getElementById("feed");
    if (!feed) return;

    // Use the verified global load function
    if (!window.loadCloudThreads) {
        setTimeout(loadThreads, 500);
        return;
    }

    const threads = await window.loadCloudThreads();
    feed.innerHTML = '';
    
    if (threads.length === 0) {
        feed.innerHTML = '<div style="padding: 60px; text-align: center; color: var(--text-soft);">No transmissions found in archive.</div>';
        return;
    }

    threads.forEach(t => {
        feed.innerHTML += renderThreadUI(t);
    });

    updateTrends(threads);
}

function renderThreadUI(t) {
    const time = formatTime(t.timestamp || t.created_at);
    const id = t.id;
    const isLiked = localStorage.getItem(`liked_${id}`);
    const author = t.author || 'Anonymous';
    const avatar = t.avatar || t.avatar_url || 'jay.png';
    const contentText = t.content || '';
    
    let content = escapeHtml(contentText);
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
                ${t.media_url ? `<div class="thread-media" style="margin-top: 12px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border);"><img src="${t.media_url}" style="width: 100%; display: block;"></div>` : ''}
                <div class="thread-actions">
                    <button class="action-btn" style="color: var(--text-soft); display: flex; align-items: center; gap: 6px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        <span>${t.replies || 0}</span>
                    </button>
                    <button class="action-btn" style="color: var(--text-soft); display: flex; align-items: center; gap: 6px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2"><path d="M17 1l4 4-4 4m6 0l-4 4 4 4M2 13h15M2 5h19"/></svg>
                        <span>${t.reposts || 0}</span>
                    </button>
                    <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="window.toggleLike('${id}')" style="display: flex; align-items: center; gap: 6px; transition: 0.2s;">
                        <svg viewBox="0 0 24 24" fill="${isLiked ? '#f91880' : 'none'}" stroke="${isLiked ? '#f91880' : 'currentColor'}" width="20" height="20" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        <span>${t.likes || 0}</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function postThread() {
    const input = document.getElementById("post-in");
    const btn = document.getElementById("post-btn");
    const content = input.value.trim();
    const mediaUrl = window.currentMediaPreview; // Assigned by upload handler

    if (!content && !mediaUrl) return;
    btn.disabled = true;

    const postData = {
        text: content,
        user: localStorage.getItem('rbx_user'),
        pic: localStorage.getItem('rbx_pic') || 'jay.png',
        media: mediaUrl
    };

    // Use the verified global save function
    if (window.saveThreadToCloud) {
        await window.saveThreadToCloud(postData);
    }

    input.value = '';
    window.removePreview();
    loadThreads();
    btn.disabled = false;
}

// Stats and Trends
function updateTrends(threads) {
    const trendList = document.getElementById("trend-list");
    if (!trendList) return;
    
    const tags = {};
    threads.forEach(t => {
        const matches = t.content.match(/#\w+/g);
        if (matches) matches.forEach(m => tags[m] = (tags[m] || 0) + 1);
    });
    
    const sorted = Object.entries(tags).sort((a,b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) {
        trendList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-soft); font-size: 0.8rem;">Tracing hashtags...</div>';
        return;
    }

    trendList.innerHTML = sorted.map(([tag, count], idx) => `
        <div class="trend-item" onclick="window.searchFor('${tag}')">
            <div style="font-size: 0.75rem; color: var(--accent);">Trending #${idx + 1}</div>
            <div style="font-weight: 700;">${tag}</div>
            <div style="font-size: 0.7rem; color: var(--text-soft);">${count} transmission${count > 1 ? 's' : ''}</div>
        </div>
    `).join('');
}

// MEDIA UPLOAD (Logic simplified but maintained)
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !window.supabaseClient) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `threads/${fileName}`;

    const { error } = await window.supabaseClient.storage
        .from('attachments')
        .upload(filePath, file);

    if (!error) {
        const { data: { publicUrl } } = window.supabaseClient.storage
            .from('attachments')
            .getPublicUrl(filePath);
        setPreview(publicUrl);
    }
}

function setPreview(url) {
    window.currentMediaPreview = url;
    const preview = document.getElementById("media-preview");
    const content = document.getElementById("media-preview-content");
    content.innerHTML = `<img src="${url}" style="width:100%; border-radius:12px;">`;
    preview.classList.remove("hidden");
}

window.removePreview = () => {
    window.currentMediaPreview = null;
    document.getElementById("media-preview").classList.add("hidden");
};

// INITIALIZE
document.addEventListener("DOMContentLoaded", () => {
    const postBtn = document.getElementById("post-btn");
    const fileInput = document.getElementById("fileInput");
    
    if (postBtn) postBtn.onclick = postThread;
    if (fileInput) fileInput.onchange = handleFileUpload;

    // Load initial feed
    const waitForGlobal = setInterval(() => {
        if (window.loadCloudThreads) {
            clearInterval(waitForGlobal);
            loadThreads();
            updateSidebarInfo();
        }
    }, 100);
});

function updateSidebarInfo() {
    const sidePic = document.getElementById('side-pic');
    const sideName = document.getElementById('side-name');
    const myPic = document.getElementById('my-pic');
    
    const user = localStorage.getItem('rbx_user');
    const pic = localStorage.getItem('rbx_pic') || 'jay.png';
    
    if (sidePic) sidePic.src = pic;
    if (sideName) sideName.innerText = user || 'Guest';
    if (myPic) myPic.src = pic;
}

// Global functions for UI actions
window.toggleLike = async (id) => {
    const likedKey = `liked_${id}`;
    const isLiked = localStorage.getItem(likedKey);
    if (isLiked) localStorage.removeItem(likedKey);
    else localStorage.setItem(likedKey, 'true');
    loadThreads(); // Simple re-fetch logic
};
