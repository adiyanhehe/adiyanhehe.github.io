const STORAGE_KEY = "pulse-messenger-ui-v1";
const THEME_KEY = "pulse-messenger-theme";
const GIPHY_API_KEY = "GlVGYHqcVGW7OkyKUjbQTKxWHcpVkKQd";
const MAX_MESSAGE_LENGTH = 400;
const QUICK_REACTIONS = ["👍", "❤️", "🔥", "😂", "🎉"];
const EMOJI_GROUPS = [
    { label: "Smileys", items: ["😀", "😄", "😁", "🙂", "😎", "🤩", "🥳", "😴", "🤝", "🙏"] },
    { label: "Signals", items: ["👋", "👍", "👏", "🙌", "🤌", "✌️", "🫶", "💡", "✅", "⚡"] },
    { label: "Mood", items: ["🔥", "💜", "🎉", "🚀", "📌", "🧠", "☕", "🌙", "🎧", "🛠️"] }
];
const AVATAR_TONES = [
    ["#7b8cff", "#64d9ff"],
    ["#ff8fa2", "#ffc46b"],
    ["#6bd6a5", "#56b3ff"],
    ["#a883ff", "#ff88bf"],
    ["#45d483", "#91de5b"],
    ["#ff8b5f", "#ffd166"]
];
const REPLY_BANK = {
    selene: [
        "I tightened the motion on the card hover just now.",
        "That works. I can push the visual polish next.",
        "Nice. I will review the responsive pass after lunch."
    ],
    ronan: [
        "I am cleaning up the edge cases on the group state.",
        "Looks good from my side. I only want one more empty-state pass.",
        "I can take the unread flow after this review."
    ],
    maya: [
        "I added launch copy options in the draft doc.",
        "That tone feels right. We should keep it crisp.",
        "I can help tighten the onboarding text next."
    ],
    zara: [
        "Mobile layout still needs one tighter spacing pass.",
        "I just tested it on a smaller viewport and it feels much better.",
        "The typing indicator animation reads clearly now."
    ],
    noah: [
        "The direct message flow feels solid now.",
        "I like the updated header. It feels more product-ready.",
        "We should keep the light mode subtle like this."
    ],
    theo: [
        "I am back online later, but the group thread is looking clean.",
        "Can you pin the product notes after you send them?",
        "That reaction UI is simple, but it reads well."
    ]
};

const state = {
    theme: "dark",
    currentUser: null,
    people: {},
    friends: [],
    chats: [],
    messages: {},
    nav: "home",
    chatFilter: "all",
    friendFilter: "all",
    search: "",
    activeChatId: null,
    drawer: null,
    emojiOpen: false,
    gifOpen: false,
    settingsOpen: false,
    membersOpen: false,
    modalOpen: false,
    modalMode: "direct",
    reactionMenu: null,
    typing: null,
    messageSubscription: null
};

const elements = {};

document.addEventListener("DOMContentLoaded", async () => {
    cacheElements();

    // Wait for Supabase to be ready from global.js
    const waitForSupabase = setInterval(async () => {
        if (window.supabaseClient) {
            clearInterval(waitForSupabase);
            await initializeState();
            bindEvents();
            renderApp();
            setupRealtimeSubscriptions();
        }
    }, 100);
});

window.addEventListener("beforeunload", () => {
    if (state.messageSubscription) {
        state.messageSubscription.unsubscribe();
    }
});

function cacheElements() {
    elements.app = document.getElementById("app");
    elements.sidebar = document.getElementById("sidebar");
    elements.directoryPanel = document.getElementById("directoryPanel");
    elements.pageOverlay = document.getElementById("pageOverlay");
    elements.homeViewButton = document.getElementById("homeViewButton");
    elements.friendsViewButton = document.getElementById("friendsViewButton");
    elements.homeUnreadBadge = document.getElementById("homeUnreadBadge");
    elements.friendsOnlineBadge = document.getElementById("friendsOnlineBadge");
    elements.themeToggleButton = document.getElementById("themeToggleButton");
    elements.settingsButton = document.getElementById("settingsButton");
    elements.settingsMenu = document.getElementById("settingsMenu");
    elements.changeStatusButton = document.getElementById("changeStatusButton");
    elements.clearUnreadButton = document.getElementById("clearUnreadButton");
    elements.resetDemoButton = document.getElementById("resetDemoButton");
    elements.currentUserAvatar = document.getElementById("currentUserAvatar");
    elements.currentUserName = document.getElementById("currentUserName");
    elements.currentUserStatus = document.getElementById("currentUserStatus");
    elements.closeSidebarButton = document.getElementById("closeSidebarButton");
    elements.openSidebarButton = document.getElementById("openSidebarButton");
    elements.openDirectoryButton = document.getElementById("openDirectoryButton");
    elements.directoryEyebrow = document.getElementById("directoryEyebrow");
    elements.directoryTitle = document.getElementById("directoryTitle");
    elements.directorySubtitle = document.getElementById("directorySubtitle");
    elements.searchInput = document.getElementById("searchInput");
    elements.filterBar = document.getElementById("filterBar");
    elements.directoryContent = document.getElementById("directoryContent");
    elements.newConversationButton = document.getElementById("newConversationButton");
    elements.workspaceIdentity = document.getElementById("workspaceIdentity");
    elements.membersToggleButton = document.getElementById("membersToggleButton");
    elements.jumpLatestButton = document.getElementById("jumpLatestButton");
    elements.friendsStage = document.getElementById("friendsStage");
    elements.chatStage = document.getElementById("chatStage");
    elements.messageStream = document.getElementById("messageStream");
    elements.typingIndicator = document.getElementById("typingIndicator");
    elements.typingLabel = document.getElementById("typingLabel");
    elements.membersSheet = document.getElementById("membersSheet");
    elements.composer = document.getElementById("composer");
    elements.emojiPicker = document.getElementById("emojiPicker");
    elements.emojiToggleButton = document.getElementById("emojiToggleButton");
    elements.gifPicker = document.getElementById("gifPicker");
    elements.gifGrid = document.getElementById("gifGrid");
    elements.gifSearchInput = document.getElementById("gifSearchInput");
    elements.gifToggleButton = document.getElementById("gifToggleButton");
    elements.messageInput = document.getElementById("messageInput");
    elements.sendButton = document.getElementById("sendButton");
    elements.characterCount = document.getElementById("characterCount");
    elements.composerHint = document.getElementById("composerHint");
    elements.conversationModal = document.getElementById("conversationModal");
    elements.closeModalButton = document.getElementById("closeModalButton");
    elements.cancelModalButton = document.getElementById("cancelModalButton");
    elements.createConversationButton = document.getElementById("createConversationButton");
    elements.directRecipientInput = document.getElementById("directRecipientInput");
    elements.groupFields = document.getElementById("groupFields");
    elements.groupNameInput = document.getElementById("groupNameInput");
    elements.groupParticipantsInput = document.getElementById("groupParticipantsInput");
    elements.conversationMessageInput = document.getElementById("conversationMessageInput");
}

async function initializeState() {
    state.theme = localStorage.getItem(THEME_KEY) || "dark";

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'auth.html';
        return;
    }

    const user = session.user;
    const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    state.currentUser = {
        id: profile?.username || user.email.split('@')[0],
        name: profile?.display_name || profile?.username || user.email.split('@')[0],
        avatarUrl: profile?.avatar_url || 'jay.png',
        presence: "online",
        statusText: profile?.status || "Shipping polished interfaces",
        initials: getInitials(profile?.display_name || user.email.split('@')[0]),
        toneA: "#7b8cff",
        toneB: "#64d9ff",
        role: "You"
    };

    // Load all people/profiles
    const { data: allProfiles } = await window.supabaseClient
        .from('profiles')
        .select('*');

    if (allProfiles) {
        allProfiles.forEach(p => {
            const id = p.username;
            const [toneA, toneB] = pickTone(id);
            state.people[id] = {
                id,
                name: p.display_name || p.username,
                avatarUrl: p.avatar_url || "",
                presence: "online", // Simple for now
                statusText: p.status || "Ready to chat",
                initials: getInitials(p.display_name || p.username),
                toneA,
                toneB,
                role: p.is_admin ? "Admin" : "Member"
            };
        });
    }

    // Always ensure current user is in people
    state.people[state.currentUser.id] = state.currentUser;

    // Load chats and messages
    await syncChatsWithDatabase();
}

async function syncChatsWithDatabase() {
    // Fetch all messages where the current user is sender or receiver
    const { data: messages, error: msgError } = await window.supabaseClient
        .from('messages')
        .select('*')
        .or(`sender.eq.${state.currentUser.id},receiver.eq.${state.currentUser.id}`)
        .order('created_at', { ascending: true });

    if (msgError) {
        console.error('[Pulse] Failed to load messages:', msgError);
        if (window.showTopNotification) window.showTopNotification('Could not load messages. Check your connection.', 'error');
        return;
    }

    const chatsMap = new Map();

    // Process DM messages to build chat list
    messages?.forEach(msg => {
        if (msg.channel_type === 'group') return; // Groups handled separately below

        const otherUser = msg.sender === state.currentUser.id ? msg.receiver : msg.sender;
        const chatId = `dm-${otherUser}`;

        if (!chatsMap.has(chatId)) {
            chatsMap.set(chatId, {
                id: chatId,
                type: 'direct',
                participantIds: [state.currentUser.id, otherUser],
                name: state.people[otherUser]?.name || otherUser,
                unread: 0,
                lastTimestamp: new Date(msg.created_at).getTime()
            });
            state.messages[chatId] = [];
        }

        const chat = chatsMap.get(chatId);
        const ts = new Date(msg.created_at).getTime();
        if (ts > chat.lastTimestamp) chat.lastTimestamp = ts;

        // Prevent duplicates on re-sync
        if (!state.messages[chatId].some(m => String(m.id) === String(msg.id))) {
            state.messages[chatId].push({
                id: String(msg.id),
                senderId: msg.sender,
                text: msg.content,
                gifUrl: msg.gif_url || null,
                timestamp: ts,
                reactions: []
            });
        }
    });

    state.chats = Array.from(chatsMap.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);

    // Restore activeChatId from localStorage if still valid
    const savedState = readStorage(STORAGE_KEY);
    const savedChatId = savedState?.activeChatId;
    if (savedChatId && state.chats.some(c => c.id === savedChatId)) {
        state.activeChatId = savedChatId;
    } else {
        state.activeChatId = state.chats[0]?.id || null;
    }

    // Fetch groups where the current user is a member
    const { data: memberRows } = await window.supabaseClient
        .from('group_members')
        .select('group_id')
        .eq('user_name', state.currentUser.id);

    const myGroupIds = memberRows?.map(r => r.group_id) || [];

    if (myGroupIds.length > 0) {
        const { data: groups } = await window.supabaseClient
            .from('groups')
            .select(`*, group_members(user_name)`)
            .in('id', myGroupIds);

        // Also fetch group messages
        const { data: groupMsgs } = await window.supabaseClient
            .from('messages')
            .select('*')
            .in('receiver', myGroupIds)
            .order('created_at', { ascending: true });

        groups?.forEach(grp => {
            const chatId = grp.id;
            if (!state.messages[chatId]) state.messages[chatId] = [];

            groupMsgs?.filter(m => m.receiver === chatId).forEach(msg => {
                if (!state.messages[chatId].some(m => String(m.id) === String(msg.id))) {
                    state.messages[chatId].push({
                        id: String(msg.id),
                        senderId: msg.sender,
                        text: msg.content,
                        gifUrl: msg.gif_url || null,
                        timestamp: new Date(msg.created_at).getTime(),
                        reactions: []
                    });
                }
            });

            if (!state.chats.some(c => c.id === chatId)) {
                state.chats.push({
                    id: chatId,
                    type: 'group',
                    name: grp.name,
                    participantIds: grp.group_members.map(m => m.user_name),
                    unread: 0,
                    lastTimestamp: state.messages[chatId][state.messages[chatId].length - 1]?.timestamp || 0
                });
            }
        });
    }

    // Build friends list from all known people except self
    state.friends = Object.keys(state.people).filter(id => id !== state.currentUser.id);
}

function setupRealtimeSubscriptions() {
    if (state.messageSubscription) state.messageSubscription.unsubscribe();

    // Listen to all inserts; filter relevance in the handler
    state.messageSubscription = window.supabaseClient
        .channel('realtime-messages-' + state.currentUser.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
        }, payload => {
            handleIncomingMessage(payload.new);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('[Pulse] Realtime connected for', state.currentUser.id);
            }
        });
}

function handleIncomingMessage(msg) {
    if (!state.currentUser) return;

    // Determine if this message is relevant to the current user
    const knownGroupIds = state.chats.filter(c => c.type === 'group').map(c => c.id);
    const isDM = msg.channel_type === 'direct' || !msg.channel_type;
    const isGroupForMe = msg.channel_type === 'group' && knownGroupIds.includes(msg.receiver);
    const isDMForMe = isDM && (msg.sender === state.currentUser.id || msg.receiver === state.currentUser.id);

    if (!isDMForMe && !isGroupForMe) return;

    let chatId;
    if (msg.channel_type === 'group') {
        chatId = msg.receiver;
    } else {
        const otherUser = msg.sender === state.currentUser.id ? msg.receiver : msg.sender;
        chatId = `dm-${otherUser}`;
    }

    const newMessage = {
        id: String(msg.id),
        senderId: msg.sender,
        text: msg.content,
        gifUrl: msg.gif_url || null,
        timestamp: new Date(msg.created_at).getTime(),
        reactions: []
    };

    // If this chat is new to us, create it
    if (!state.messages[chatId]) {
        state.messages[chatId] = [];
        if (isDM) {
            const otherUser = msg.sender === state.currentUser.id ? msg.receiver : msg.sender;
            // Ensure the other person is in state.people
            if (!state.people[otherUser]) {
                window.supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('username', otherUser)
                    .maybeSingle()
                    .then(({ data }) => {
                        const [toneA, toneB] = pickTone(otherUser);
                        state.people[otherUser] = data ? {
                            id: data.username,
                            name: data.display_name || data.username,
                            avatarUrl: data.avatar_url || '',
                            presence: 'online',
                            statusText: data.status || 'Ready to chat',
                            initials: getInitials(data.display_name || data.username),
                            toneA,
                            toneB,
                            role: 'Member'
                        } : createFallbackPerson(otherUser);
                        if (!state.friends.includes(otherUser)) state.friends.unshift(otherUser);
                        renderApp();
                    });
            }
            if (!state.friends.includes(otherUser)) state.friends.unshift(otherUser);
            state.chats.unshift({
                id: chatId,
                type: 'direct',
                participantIds: [state.currentUser.id, otherUser],
                name: state.people[otherUser]?.name || otherUser,
                unread: 0,
                lastTimestamp: newMessage.timestamp
            });
        }
    }

    // Deduplicate: skip if already present (e.g. optimistic message was confirmed)
    if (state.messages[chatId].some(m => m.id === newMessage.id)) return;

    // Remove any optimistic placeholder for the same text from same sender
    if (msg.sender === state.currentUser.id) {
        state.messages[chatId] = state.messages[chatId].filter(
            m => !(String(m.id).startsWith('opt-') && m.text === newMessage.text)
        );
    }

    state.messages[chatId].push(newMessage);

    // Update chat's lastTimestamp
    const chat = getChatById(chatId);
    if (chat) {
        chat.lastTimestamp = newMessage.timestamp;
        if (chatId !== state.activeChatId) {
            chat.unread = (chat.unread || 0) + 1;
        }
    }

    renderApp();
    if (chatId === state.activeChatId) {
        scrollToLatest(true);
    }
}

// Legacy seed logic removed. Using database instead.


function bindEvents() {
    elements.homeViewButton.addEventListener("click", () => setNavView("home"));
    elements.friendsViewButton.addEventListener("click", () => setNavView("friends"));
    elements.themeToggleButton.addEventListener("click", toggleTheme);
    elements.settingsButton.addEventListener("click", toggleSettingsMenu);
    elements.changeStatusButton.addEventListener("click", handleCustomStatus);
    elements.clearUnreadButton.addEventListener("click", clearUnreadBadges);
    elements.resetDemoButton.addEventListener("click", resetDemoData);
    elements.openSidebarButton.addEventListener("click", () => openDrawer("sidebar"));
    elements.openDirectoryButton.addEventListener("click", () => openDrawer("directory"));
    elements.closeSidebarButton.addEventListener("click", closeDrawers);
    elements.pageOverlay.addEventListener("click", closeTransientUi);
    elements.searchInput.addEventListener("input", handleSearch);
    elements.filterBar.addEventListener("click", handleFilterClick);
    elements.directoryContent.addEventListener("click", handleDirectoryClick);
    elements.newConversationButton.addEventListener("click", () => openConversationModal("direct"));
    elements.closeModalButton.addEventListener("click", closeConversationModal);
    elements.cancelModalButton.addEventListener("click", closeConversationModal);
    elements.createConversationButton.addEventListener("click", createConversationFromModal);
    elements.conversationModal.addEventListener("click", (event) => {
        if (event.target === elements.conversationModal) closeConversationModal();
    });

    document.querySelectorAll(".mode-button").forEach((button) => {
        button.addEventListener("click", () => {
            state.modalMode = button.dataset.mode;
            renderModalMode();
        });
    });

    elements.membersToggleButton.addEventListener("click", toggleMembersSheet);
    elements.emojiToggleButton.addEventListener("click", toggleEmojiPicker);
    elements.emojiPicker.addEventListener("click", handleEmojiPickerClick);
    elements.gifToggleButton?.addEventListener("click", toggleGifPicker);
    elements.gifSearchInput?.addEventListener("input", handleGifSearch);
    elements.gifGrid?.addEventListener("click", handleGifSelection);
    elements.messageInput.addEventListener("input", handleComposerInput);
    elements.messageInput.addEventListener("keydown", handleComposerKeydown);
    elements.sendButton.addEventListener("click", sendMessage);
    elements.messageStream.addEventListener("scroll", updateJumpButton);
    elements.messageStream.addEventListener("click", handleMessageActions);
    elements.jumpLatestButton.addEventListener("click", () => scrollToLatest(true));

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeydown);
    window.addEventListener("resize", handleResize);
}

function renderApp() {
    document.body.dataset.theme = state.theme;
    elements.app.classList.toggle("sidebar-open", state.drawer === "sidebar");
    elements.app.classList.toggle("directory-open", state.drawer === "directory");
    elements.pageOverlay.classList.toggle("hidden", !shouldShowOverlay());

    renderSidebar();
    renderDirectory();
    renderWorkspace();
    renderModalMode();
    renderEmojiPicker();
    renderGifPicker();
    updateComposerMetrics();
}

function renderSidebar() {
    const homeUnread = state.chats.reduce((total, chat) => total + (chat.unread || 0), 0);
    const onlineFriends = state.friends.filter((friendId) => state.people[friendId]?.presence === "online").length;

    elements.homeViewButton.classList.toggle("active", state.nav === "home");
    elements.homeViewButton.setAttribute("aria-pressed", String(state.nav === "home"));
    elements.friendsViewButton.classList.toggle("active", state.nav === "friends");
    elements.friendsViewButton.setAttribute("aria-pressed", String(state.nav === "friends"));

    elements.homeUnreadBadge.textContent = String(homeUnread);
    elements.homeUnreadBadge.classList.toggle("hidden", homeUnread === 0);
    elements.friendsOnlineBadge.textContent = String(onlineFriends);
    elements.friendsOnlineBadge.classList.toggle("hidden", onlineFriends === 0);

    elements.currentUserAvatar.innerHTML = renderAvatarContent(state.currentUser, true);
    elements.currentUserName.textContent = state.currentUser.name;
    elements.currentUserStatus.textContent = state.currentUser.statusText;
    elements.settingsMenu.classList.toggle("hidden", !state.settingsOpen);
}

function renderDirectory() {
    if (state.nav === "home") {
        elements.directoryEyebrow.textContent = "Inbox";
        elements.directoryTitle.textContent = "Direct messages";
        elements.directorySubtitle.textContent = "Keep up with the people building alongside you.";
        elements.searchInput.placeholder = "Search conversations";
        elements.newConversationButton.textContent = "New chat";
        renderFilterBar([
            { id: "all", label: "All" },
            { id: "direct", label: "Direct" },
            { id: "group", label: "Groups" }
        ], state.chatFilter);
        elements.directoryContent.innerHTML = renderChatDirectory();
        return;
    }

    elements.directoryEyebrow.textContent = "People";
    elements.directoryTitle.textContent = "Friends";
    elements.directorySubtitle.textContent = "Start a conversation with someone available right now.";
    elements.searchInput.placeholder = "Search friends";
    elements.newConversationButton.textContent = "New group";
    renderFilterBar([
        { id: "all", label: "All friends" },
        { id: "online", label: "Online now" }
    ], state.friendFilter);
    elements.directoryContent.innerHTML = renderFriendsDirectory();
}

function renderFilterBar(filters, activeFilter) {
    elements.filterBar.innerHTML = filters.map((filter) => `
        <button class="filter-chip ${filter.id === activeFilter ? "active" : ""}" type="button" data-filter="${filter.id}">
            ${escapeHtml(filter.label)}
        </button>
    `).join("");
}

function renderChatDirectory() {
    const visibleChats = getVisibleChats();
    if (!visibleChats.length) return renderEmptyStateCard("No conversations found", "Try a different search term or create a new chat.");

    return `
        <div class="directory-list">
            ${visibleChats.map((chat) => {
        const active = chat.id === state.activeChatId;
        const lastMessage = getLastMessage(chat.id);
        const preview = lastMessage ? formatPreviewText(lastMessage) : "No messages yet";
        const timestamp = lastMessage ? formatConversationTime(lastMessage.timestamp) : "";
        return `
                    <button class="directory-item ${active ? "active" : ""}" type="button" data-chat-id="${chat.id}">
                        ${renderChatAvatar(chat)}
                        <div class="directory-item-meta">
                            <span class="directory-item-title">${escapeHtml(getChatTitle(chat))}</span>
                            <span class="directory-item-preview">${escapeHtml(preview)}</span>
                        </div>
                        <div class="directory-item-meta" style="text-align:right;">
                            <span class="directory-item-time">${escapeHtml(timestamp)}</span>
                            ${chat.unread ? `<span class="directory-item-badge">${chat.unread}</span>` : ""}
                        </div>
                    </button>
                `;
    }).join("")}
        </div>
    `;
}

function renderFriendsDirectory() {
    const visibleFriends = getVisibleFriends();
    if (!visibleFriends.length) return renderEmptyStateCard("Nobody matches that search", "Try another teammate name or switch the filter.");

    return `
        <div class="friend-list">
            ${visibleFriends.map((person) => `
                <button class="friend-row" type="button" data-friend-id="${person.id}">
                    ${renderPersonAvatar(person, "friend-avatar", true)}
                    <div class="friend-row-meta">
                        <strong>${escapeHtml(person.name)}</strong>
                        <span>${escapeHtml(person.statusText)}</span>
                    </div>
                    <span class="friend-row-action">Message</span>
                </button>
            `).join("")}
        </div>
    `;
}

function renderWorkspace() {
    if (state.nav === "friends") {
        elements.friendsStage.classList.remove("hidden");
        elements.chatStage.classList.add("hidden");
        elements.composer.classList.add("hidden");
        elements.membersToggleButton.classList.add("hidden");
        elements.jumpLatestButton.classList.add("hidden");
        elements.workspaceIdentity.innerHTML = renderWorkspaceSectionIdentity("Friends", "See who is online and jump straight into a conversation.");
        elements.friendsStage.innerHTML = renderFriendsStage();
        return;
    }

    const activeChat = getActiveChat();
    elements.friendsStage.classList.add("hidden");
    elements.chatStage.classList.remove("hidden");
    elements.composer.classList.remove("hidden");
    elements.membersToggleButton.classList.remove("hidden");

    if (!activeChat) {
        elements.workspaceIdentity.innerHTML = renderWorkspaceSectionIdentity("Select a chat", "Choose a conversation from the list to start messaging.");
        elements.membersToggleButton.classList.add("hidden");
        elements.messageStream.innerHTML = renderEmptyStateCard("Nothing selected yet", "Pick a direct message or a group chat to start.");
        elements.typingIndicator.classList.add("hidden");
        elements.membersSheet.classList.add("hidden");
        return;
    }

    elements.workspaceIdentity.innerHTML = renderWorkspaceChatIdentity(activeChat);
    elements.membersToggleButton.textContent = activeChat.type === "group" ? "Members" : "Profile";
    elements.membersSheet.classList.toggle("hidden", !state.membersOpen);
    elements.membersSheet.innerHTML = renderMembersSheet(activeChat);
    renderMessages(activeChat);
    elements.messageInput.placeholder = `Message ${getChatTitle(activeChat)}`;
}

function renderWorkspaceSectionIdentity(title, copy) {
    return `
        <div class="workspace-identity">
            <div class="workspace-avatar avatar-token" style="--avatar-a:${state.currentUser.toneA}; --avatar-b:${state.currentUser.toneB};">
                <span>${escapeHtml(title.charAt(0).toUpperCase())}</span>
            </div>
            <div class="workspace-avatar-copy">
                <h2>${escapeHtml(title)}</h2>
                <p>${escapeHtml(copy)}</p>
            </div>
        </div>
    `;
}

function renderWorkspaceChatIdentity(chat) {
    if (chat.type === "group") {
        const participants = getChatParticipants(chat).filter((person) => person.id !== state.currentUser.id);
        const onlineCount = participants.filter((person) => person.presence === "online").length;
        return `
            <div class="workspace-identity">
                <div class="workspace-avatar-wrap">
                    ${renderChatAvatar(chat)}
                </div>
                <div class="workspace-avatar-copy">
                    <h2>${escapeHtml(getChatTitle(chat))}</h2>
                    <p>${participants.length + 1} members, ${onlineCount} online right now</p>
                </div>
            </div>
        `;
    }

    const person = getDirectPeer(chat);
    return `
        <div class="workspace-identity">
            ${renderPersonAvatar(person, "workspace-avatar", true)}
            <div class="workspace-avatar-copy">
                <h2>${escapeHtml(person.name)}</h2>
                <p>${escapeHtml(buildPresenceCopy(person))}</p>
            </div>
        </div>
    `;
}

function renderFriendsStage() {
    const onlineFriends = state.friends.filter((friendId) => state.people[friendId]?.presence === "online");
    const groupCount = state.chats.filter((chat) => chat.type === "group").length;
    const unreadCount = state.chats.reduce((total, chat) => total + chat.unread, 0);

    return `
        <div class="friends-hero">
            <div class="stats-grid">
                <div class="stat-card">
                    <strong>${onlineFriends.length}</strong>
                    <p>Friends online now</p>
                </div>
                <div class="stat-card">
                    <strong>${groupCount}</strong>
                    <p>Active group chats</p>
                </div>
                <div class="stat-card">
                    <strong>${unreadCount}</strong>
                    <p>Unread notifications</p>
                </div>
            </div>

            <div>
                <h2>Stay close to the people moving the work forward.</h2>
                <p style="color:var(--text-muted); margin:0 0 18px;">Use friends as a quick launchpad into direct messages, then jump back into the inbox once the conversation is rolling.</p>
            </div>

            <div class="friend-highlight-grid">
                ${onlineFriends.slice(0, 4).map((personId) => {
        const person = state.people[personId];
        return `
                        <div class="friend-highlight">
                            ${renderPersonAvatar(person, "friend-avatar", true)}
                            <div>
                                <strong>${escapeHtml(person.name)}</strong>
                                <p style="margin:6px 0 0; color:var(--text-muted);">${escapeHtml(person.statusText)}</p>
                            </div>
                            <button class="create-button" type="button" data-friend-id="${person.id}" data-start-chat="true">Message ${escapeHtml(person.name.split(" ")[0])}</button>
                        </div>
                    `;
    }).join("")}
            </div>
        </div>
    `;
}

function renderMessages(chat) {
    const messages = getMessages(chat.id);
    const stickToBottom = isNearBottom(elements.messageStream);
    let currentDayLabel = "";

    elements.messageStream.innerHTML = messages.map((message) => {
        const sender = state.people[message.senderId] || createFallbackPerson(message.senderId);
        const dayLabel = formatDayLabel(message.timestamp);
        const divider = dayLabel !== currentDayLabel ? `<div class="message-day-divider">${escapeHtml(dayLabel)}</div>` : "";
        currentDayLabel = dayLabel;
        const isOwn = message.senderId === state.currentUser.id;
        const reactions = renderMessageReactions(chat.id, message);
        const reactionMenu = state.reactionMenu && state.reactionMenu.chatId === chat.id && state.reactionMenu.messageId === message.id
            ? `<div class="message-reaction-menu">${QUICK_REACTIONS.map((emoji) => `
                <button class="reaction-choice" type="button" data-action="add-reaction" data-chat-id="${chat.id}" data-message-id="${message.id}" data-emoji="${emoji}">
                    ${emoji}
                </button>
            `).join("")}</div>`
            : "";

        return `
            ${divider}
            <article class="message-item ${isOwn ? "sent" : "received"}" data-message-id="${message.id}">
                ${isOwn ? "" : renderPersonAvatar(sender, "member-avatar", true)}
                <div class="message-shell">
                    <div class="message-meta">
                        <strong>${escapeHtml(sender.name)}</strong>
                        <span>${escapeHtml(formatMessageTimestamp(message.timestamp))}</span>
                    </div>
                    ${message.gifUrl ? `<div class="message-attachment"><img src="${escapeHtml(message.gifUrl)}" alt="GIF attachment" loading="lazy"></div>` : ""}
                    ${message.text ? `<div class="message-bubble">${formatMessageText(message.text)}</div>` : ""}
                    ${reactionMenu}
                    ${reactions}
                </div>
                <div class="message-toolbar ${state.reactionMenu && state.reactionMenu.messageId === message.id ? "active" : ""}">
                    <button class="message-action-button" type="button" title="React" data-action="toggle-reaction-menu" data-chat-id="${chat.id}" data-message-id="${message.id}">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="8.5"></circle>
                            <path d="M8.5 10.5h.01"></path>
                            <path d="M15.5 10.5h.01"></path>
                            <path d="M8.5 14.5c.8 1.1 2 1.7 3.5 1.7s2.7-.6 3.5-1.7"></path>
                        </svg>
                    </button>
                    <button class="message-action-button delete" type="button" title="Delete" data-action="delete-message" data-chat-id="${chat.id}" data-message-id="${message.id}">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 7h16"></path>
                            <path d="M10 11v6"></path>
                            <path d="M14 11v6"></path>
                            <path d="M6 7l1 12h10l1-12"></path>
                            <path d="M9 7V4h6v3"></path>
                        </svg>
                    </button>
                </div>
            </article>
        `;
    }).join("");

    if (stickToBottom) {
        scrollToLatest(false);
    }

    renderTypingIndicator();
    updateJumpButton();
}

function renderMessageReactions(chatId, message) {
    if (!Array.isArray(message.reactions) || !message.reactions.length) return "";

    return `
        <div class="message-reactions">
            ${message.reactions.map((reaction) => {
        const active = reaction.users.includes(state.currentUser.id);
        return `
                    <button class="reaction-pill ${active ? "active" : ""}" type="button" data-action="add-reaction" data-chat-id="${chatId}" data-message-id="${message.id}" data-emoji="${reaction.emoji}">
                        <span>${reaction.emoji}</span>
                        <span>${reaction.users.length}</span>
                    </button>
                `;
    }).join("")}
        </div>
    `;
}

function renderTypingIndicator() {
    const activeChat = getActiveChat();
    const shouldShow = Boolean(state.typing && activeChat && state.typing.chatId === activeChat.id);
    elements.typingIndicator.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) return;
    elements.typingLabel.textContent = `${state.typing.senderName} is typing...`;
}

function renderMembersSheet(chat) {
    const participants = getChatParticipants(chat);
    return `
        <div class="members-sheet-header">
            <p class="eyebrow">${chat.type === "group" ? "Group details" : "Profile"}</p>
            <h3>${escapeHtml(getChatTitle(chat))}</h3>
            <p>${chat.type === "group" ? `${participants.length} people in this conversation.` : buildPresenceCopy(getDirectPeer(chat))}</p>
        </div>
        <div class="members-list">
            ${participants.map((person) => `
                <div class="member-row">
                    ${renderPersonAvatar(person, "member-avatar", true)}
                    <div>
                        <strong>${escapeHtml(person.name)}</strong>
                        <span>${escapeHtml(person.role || person.statusText)}</span>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

function renderModalMode() {
    const isGroup = state.modalMode === "group";
    elements.groupFields.classList.toggle("hidden", !isGroup);
    document.querySelectorAll(".mode-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.mode === state.modalMode);
    });
    elements.conversationModal.classList.toggle("hidden", !state.modalOpen);
}

function toggleGifPicker() {
    state.gifOpen = !state.gifOpen;
    if (state.gifOpen) {
        state.emojiOpen = false;
        renderEmojiPicker();
        elements.gifSearchInput.value = "";
        fetchGifs("");
        // Focus the search field only when newly opening
        setTimeout(() => elements.gifSearchInput?.focus(), 50);
    }
    renderGifPicker();
}

function renderGifPicker() {
    elements.gifPicker.classList.toggle("hidden", !state.gifOpen);
}

async function fetchGifs(query) {
    elements.gifGrid.innerHTML = '<p class="text-muted" style="padding: 12px; text-align: center;">Loading GIFs...</p>';
    const url = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20`;

    try {
        const response = await fetch(url);
        const json = await response.json();

        elements.gifGrid.innerHTML = json.data.map(gif => `
            <img class="gif-item" src="${gif.images.fixed_height_small.url}" data-full-url="${gif.images.fixed_height.url}" alt="${escapeHtml(gif.title || 'GIF')}" loading="lazy">
        `).join("");
    } catch (e) {
        elements.gifGrid.innerHTML = '<p class="text-danger" style="padding: 12px; text-align: center;">Failed to load GIFs.</p>';
    }
}

let gifSearchTimeout;
function handleGifSearch(event) {
    clearTimeout(gifSearchTimeout);
    gifSearchTimeout = setTimeout(() => {
        fetchGifs(event.target.value.trim());
    }, 400);
}

function handleGifSelection(event) {
    const item = event.target.closest(".gif-item");
    if (!item) return;
    const url = item.dataset.fullUrl;
    sendGif(url);
}

function renderEmojiPicker() {
    elements.emojiPicker.classList.toggle("hidden", !state.emojiOpen);
    if (!state.emojiOpen) return;

    elements.emojiPicker.innerHTML = EMOJI_GROUPS.map((group) => `
        <section class="emoji-group">
            <h4>${escapeHtml(group.label)}</h4>
            <div class="emoji-grid">
                ${group.items.map((emoji) => `
                    <button class="emoji-choice" type="button" data-emoji="${emoji}">
                        ${emoji}
                    </button>
                `).join("")}
            </div>
        </section>
    `).join("");
}

function setNavView(view) {
    state.nav = view;
    state.search = "";
    elements.searchInput.value = "";
    state.emojiOpen = false;
    state.gifOpen = false;
    state.settingsOpen = false;
    state.reactionMenu = null;
    state.membersOpen = false;
    closeDrawers();
    renderApp();
}

function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    persistState();
    renderApp();
}

function toggleSettingsMenu() {
    state.settingsOpen = !state.settingsOpen;
    renderSidebar();
}

function handleCustomStatus() {
    const nextStatus = window.prompt("Set a custom status", state.currentUser.statusText);
    if (!nextStatus) return;
    state.currentUser.statusText = nextStatus.trim() || state.currentUser.statusText;
    state.people[state.currentUser.id] = {
        ...state.people[state.currentUser.id],
        statusText: state.currentUser.statusText
    };
    persistState();
    renderSidebar();
}

function clearUnreadBadges() {
    state.chats = state.chats.map((chat) => ({ ...chat, unread: 0 }));
    persistState();
    renderApp();
}

function resetDemoData() {
    const confirmed = window.confirm("Reload all data from the server? Unsaved local state will be cleared.");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
}

function handleSearch(event) {
    state.search = event.target.value.trim().toLowerCase();
    renderDirectory();
}

function handleFilterClick(event) {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    if (state.nav === "home") {
        state.chatFilter = button.dataset.filter;
    } else {
        state.friendFilter = button.dataset.filter;
    }

    renderDirectory();
}

function handleDirectoryClick(event) {
    const friendAction = event.target.closest("[data-start-chat]");
    if (friendAction) {
        const friendId = friendAction.dataset.friendId;
        const chat = ensureDirectChat(friendId);
        selectChat(chat.id);
        return;
    }

    const friendRow = event.target.closest("[data-friend-id]");
    if (friendRow) {
        const chat = ensureDirectChat(friendRow.dataset.friendId);
        selectChat(chat.id);
        return;
    }

    const chatItem = event.target.closest("[data-chat-id]");
    if (!chatItem) return;
    selectChat(chatItem.dataset.chatId);
}

function handleMessageActions(event) {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    const chatId = actionButton.dataset.chatId;
    const messageId = actionButton.dataset.messageId;

    if (action === "toggle-reaction-menu") {
        state.reactionMenu = state.reactionMenu && state.reactionMenu.messageId === messageId ? null : { chatId, messageId };
        renderWorkspace();
        return;
    }

    if (action === "add-reaction") {
        toggleReaction(chatId, messageId, actionButton.dataset.emoji);
        return;
    }

    if (action === "delete-message") {
        deleteMessage(chatId, messageId);
    }
}

function handleEmojiPickerClick(event) {
    const emojiButton = event.target.closest("[data-emoji]");
    if (!emojiButton) return;
    insertEmoji(emojiButton.dataset.emoji);
}

function handleComposerInput() {
    autoResizeComposer();
    updateComposerMetrics();
    // Typing indicators intentionally omitted (no simulation)
}

function handleComposerKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function handleDocumentClick(event) {
    const insideSettings = event.target.closest("#settingsMenu") || event.target.closest("#settingsButton");
    if (!insideSettings && state.settingsOpen) {
        state.settingsOpen = false;
        renderSidebar();
    }

    const insideEmoji = event.target.closest("#emojiPicker") || event.target.closest("#emojiToggleButton");
    if (!insideEmoji && state.emojiOpen) {
        state.emojiOpen = false;
        renderEmojiPicker();
    }

    const insideGif = event.target.closest("#gifPicker") || event.target.closest("#gifToggleButton");
    if (!insideGif && state.gifOpen) {
        state.gifOpen = false;
        renderGifPicker();
    }

    const insideMessageActions = event.target.closest("[data-action]");
    if (!insideMessageActions && state.reactionMenu) {
        state.reactionMenu = null;
        renderWorkspace();
    }
}

function handleDocumentKeydown(event) {
    if (event.key !== "Escape") return;
    closeTransientUi();
}

function handleResize() {
    if (window.innerWidth > 1180) {
        state.drawer = null;
        elements.pageOverlay.classList.add("hidden");
        elements.app.classList.remove("sidebar-open", "directory-open");
    }
}

function openDrawer(drawer) {
    state.drawer = drawer;
    renderApp();
}

function closeDrawers() {
    state.drawer = null;
    elements.app.classList.remove("sidebar-open", "directory-open");
    elements.pageOverlay.classList.add("hidden");
}

function shouldShowOverlay() {
    return Boolean(state.drawer);
}

function closeTransientUi() {
    state.drawer = null;
    state.modalOpen = false;
    state.emojiOpen = false;
    state.gifOpen = false;
    state.settingsOpen = false;
    state.membersOpen = false;
    state.reactionMenu = null;
    renderApp();
}

function openConversationModal(mode) {
    state.modalMode = mode;
    state.modalOpen = true;
    elements.directRecipientInput.value = "";
    elements.groupNameInput.value = "";
    elements.groupParticipantsInput.value = "";
    elements.conversationMessageInput.value = "";
    renderModalMode();
}

function closeConversationModal() {
    state.modalOpen = false;
    renderModalMode();
}

async function createConversationFromModal() {
    const firstMessage = elements.conversationMessageInput.value.trim();

    if (state.modalMode === "direct") {
        const recipientName = elements.directRecipientInput.value.trim();
        if (!recipientName) {
            window.alert("Add a recipient name first.");
            return;
        }

        const friend = await ensurePersonInDB(recipientName);
        if (!friend) {
            window.alert("User not found.");
            return;
        }

        const chatId = `dm-${friend.id}`;
        if (firstMessage) {
            await window.supabaseClient.from('messages').insert([{
                sender: state.currentUser.id,
                receiver: friend.id,
                content: firstMessage,
                channel_type: 'direct'
            }]);
        }
        closeConversationModal();
        selectChat(chatId);
        return;
    }

    const groupName = elements.groupNameInput.value.trim();
    const participantNames = elements.groupParticipantsInput.value.split(",").map((name) => name.trim()).filter(Boolean);

    if (!groupName || !participantNames.length) {
        window.alert("Add a group name and at least one participant.");
        return;
    }

    // Create group in Supabase
    const { data: grp, error } = await window.supabaseClient
        .from('groups')
        .insert([{ name: groupName, owner: state.currentUser.id }])
        .select()
        .single();

    if (error) {
        window.alert("Failed to create group.");
        return;
    }

    const chatId = grp.id;

    // Add members
    const members = [state.currentUser.id];
    for (const name of participantNames) {
        const person = await ensurePersonInDB(name);
        if (person) members.push(person.id);
    }

    await window.supabaseClient.from('group_members').insert(
        members.map(m => ({ group_id: chatId, user_name: m }))
    );

    if (firstMessage) {
        await window.supabaseClient.from('messages').insert([{
            sender: state.currentUser.id,
            receiver: chatId,
            content: firstMessage,
            channel_type: 'group'
        }]);
    }

    closeConversationModal();
    selectChat(chatId);
}

async function ensurePersonInDB(name) {
    const { data } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .or(`username.eq.${name},display_name.eq.${name}`)
        .maybeSingle();

    if (data) {
        const id = data.username;
        if (!state.people[id]) {
            const [toneA, toneB] = pickTone(id);
            state.people[id] = {
                id,
                name: data.display_name || data.username,
                avatarUrl: data.avatar_url || "",
                presence: "online",
                statusText: data.status || "Ready to chat",
                initials: getInitials(data.display_name || data.username),
                toneA,
                toneB,
                role: "Member"
            };
        }
        return state.people[id];
    }
    return null;
}

function toggleMembersSheet() {
    state.membersOpen = !state.membersOpen;
    renderWorkspace();
}

function toggleEmojiPicker() {
    state.emojiOpen = !state.emojiOpen;
    renderEmojiPicker();
}

function updateComposerMetrics() {
    const length = elements.messageInput.value.length;
    elements.characterCount.textContent = `${length} / ${MAX_MESSAGE_LENGTH}`;
    // Disable send when: no text, wrong nav view, or no chat selected
    elements.sendButton.disabled = length === 0 || state.nav !== "home" || !state.activeChatId;
}

function autoResizeComposer() {
    elements.messageInput.style.height = "auto";
    elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 140)}px`;
}

async function sendGif(gifUrl) {
    const activeChat = getActiveChat();
    if (!activeChat) return;

    const receiver = activeChat.type === 'group'
        ? activeChat.id
        : activeChat.participantIds.find(id => id !== state.currentUser.id);

    const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (!state.messages[activeChat.id]) state.messages[activeChat.id] = [];
    state.messages[activeChat.id].push({
        id: optimisticId,
        senderId: state.currentUser.id,
        text: '',
        gifUrl: gifUrl,
        timestamp: Date.now(),
        reactions: [],
        pending: true
    });

    const chat = getChatById(activeChat.id);
    if (chat) chat.lastTimestamp = Date.now();

    state.gifOpen = false;
    renderGifPicker();
    renderApp();
    scrollToLatest(true);

    const { data, error } = await window.supabaseClient
        .from('messages')
        .insert([{
            sender: state.currentUser.id,
            receiver,
            content: '[GIF]',
            gif_url: gifUrl,
            channel_type: activeChat.type
        }])
        .select()
        .single();

    if (error) {
        console.error('GIF send failed:', error);
        state.messages[activeChat.id] = state.messages[activeChat.id].filter(m => m.id !== optimisticId);
        renderApp();
        return;
    }

    const confirmed = {
        id: String(data.id),
        senderId: data.sender,
        text: data.content,
        gifUrl: data.gif_url,
        timestamp: new Date(data.created_at).getTime(),
        reactions: []
    };
    state.messages[activeChat.id] = state.messages[activeChat.id].filter(m => m.id !== optimisticId);
    if (!state.messages[activeChat.id].some(m => m.id === confirmed.id)) {
        state.messages[activeChat.id].push(confirmed);
    }
    if (chat) chat.lastTimestamp = confirmed.timestamp;
    renderApp();
    scrollToLatest(false);
}

function insertEmoji(emoji) {
    const nextValue = elements.messageInput.value + emoji;
    if (nextValue.length > MAX_MESSAGE_LENGTH) return;
    elements.messageInput.value = nextValue;
    state.emojiOpen = false;
    renderEmojiPicker();
    handleComposerInput();
    elements.messageInput.focus();
}

async function sendMessage() {
    const activeChat = getActiveChat();
    const text = elements.messageInput.value.trim();
    if (!activeChat || !text) return;

    const receiver = activeChat.type === 'group'
        ? activeChat.id
        : activeChat.participantIds.find(id => id !== state.currentUser.id);

    // Optimistic UI: show message immediately before DB confirms
    const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (!state.messages[activeChat.id]) state.messages[activeChat.id] = [];
    state.messages[activeChat.id].push({
        id: optimisticId,
        senderId: state.currentUser.id,
        text,
        timestamp: Date.now(),
        reactions: [],
        pending: true
    });

    // Update chat lastTimestamp so it floats to top
    const chat = getChatById(activeChat.id);
    if (chat) chat.lastTimestamp = Date.now();

    elements.messageInput.value = '';
    autoResizeComposer();
    updateComposerMetrics();
    renderApp();
    scrollToLatest(true);

    const { data, error } = await window.supabaseClient
        .from('messages')
        .insert([{
            sender: state.currentUser.id,
            receiver,
            content: text,
            channel_type: activeChat.type
        }])
        .select()
        .single();

    if (error) {
        console.error('Message send failed:', error);
        // Roll back the optimistic message
        state.messages[activeChat.id] = state.messages[activeChat.id].filter(m => m.id !== optimisticId);
        renderApp();
        if (window.showTopNotification) window.showTopNotification('Failed to send message. Try again.', 'error');
        return;
    }

    // Replace optimistic placeholder with the confirmed DB message
    // (realtime will also fire, but handleIncomingMessage deduplicates by id)
    const confirmed = {
        id: String(data.id),
        senderId: data.sender,
        text: data.content,
        gifUrl: data.gif_url || null,
        timestamp: new Date(data.created_at).getTime(),
        reactions: []
    };
    state.messages[activeChat.id] = state.messages[activeChat.id].filter(m => m.id !== optimisticId);
    if (!state.messages[activeChat.id].some(m => m.id === confirmed.id)) {
        state.messages[activeChat.id].push(confirmed);
    }
    if (chat) chat.lastTimestamp = confirmed.timestamp;
    renderApp();
    scrollToLatest(false);
}

function createMessage(chatId, senderId, text) {
    return {
        id: `msg-${chatId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        senderId,
        text,
        timestamp: Date.now(),
        reactions: []
    };
}

function appendMessage(chatId, message) {
    if (!state.messages[chatId]) state.messages[chatId] = [];
    state.messages[chatId].push(message);

    const chat = getChatById(chatId);
    if (chat && chatId !== state.activeChatId) {
        chat.unread = (chat.unread || 0) + 1;
    }

    persistState();
    renderApp();
}

async function deleteMessage(chatId, messageId) {
    // Only allow deleting real (non-optimistic) messages
    if (String(messageId).startsWith('opt-')) {
        state.messages[chatId] = (state.messages[chatId] || []).filter(m => m.id !== messageId);
        state.reactionMenu = null;
        renderApp();
        return;
    }

    const { error } = await window.supabaseClient
        .from('messages')
        .delete()
        .eq('id', messageId);

    if (error) {
        console.error('Delete failed:', error);
        if (window.showTopNotification) window.showTopNotification('Could not delete message.', 'error');
        return;
    }

    state.messages[chatId] = (state.messages[chatId] || []).filter(m => String(m.id) !== String(messageId));
    state.reactionMenu = null;
    renderApp();
}

function toggleReaction(chatId, messageId, emoji) {
    // Reactions are stored in local state only (add a 'reactions JSONB' column
    // to the messages table in Supabase if you want them to persist across sessions).
    const message = (state.messages[chatId] || []).find(entry => String(entry.id) === String(messageId));
    if (!message) return;

    if (!Array.isArray(message.reactions)) message.reactions = [];
    let reactions = [...message.reactions];
    let reaction = reactions.find(entry => entry.emoji === emoji);

    if (!reaction) {
        reaction = { emoji, users: [] };
        reactions.push(reaction);
    }

    if (reaction.users.includes(state.currentUser.id)) {
        reaction.users = reaction.users.filter(userId => userId !== state.currentUser.id);
    } else {
        reaction.users.push(state.currentUser.id);
    }

    reactions = reactions.filter(entry => entry.users.length > 0);
    message.reactions = reactions;
    state.reactionMenu = null;
    renderWorkspace();
}

function selectChat(chatId) {
    state.nav = "home";
    state.activeChatId = chatId;
    state.search = "";
    state.chatFilter = "all";
    state.membersOpen = false;
    state.emojiOpen = false;
    state.settingsOpen = false;
    state.reactionMenu = null;
    closeDrawers();

    const chat = getChatById(chatId);
    if (chat) chat.unread = 0;

    persistState();
    renderApp();
    scrollToLatest(false);
}

// Mock simulation removed as requested.


function renderEmptyStateCard(title, copy) {
    return `
        <div class="empty-state">
            <div class="empty-state-card">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(copy)}</p>
            </div>
        </div>
    `;
}

function getVisibleChats() {
    return [...state.chats]
        .filter((chat) => {
            if (state.chatFilter === "direct") return chat.type === "direct";
            if (state.chatFilter === "group") return chat.type === "group";
            return true;
        })
        .filter((chat) => {
            if (!state.search) return true;
            const haystack = `${getChatTitle(chat)} ${formatPreviewText(getLastMessage(chat.id))}`.toLowerCase();
            return haystack.includes(state.search);
        })
        .sort((left, right) => getLastTimestamp(right.id) - getLastTimestamp(left.id));
}

function getVisibleFriends() {
    return state.friends
        .map((friendId) => state.people[friendId])
        .filter(Boolean)
        .filter((person) => {
            if (state.friendFilter === "online") return person.presence === "online";
            return true;
        })
        .filter((person) => {
            if (!state.search) return true;
            const haystack = `${person.name} ${person.statusText}`.toLowerCase();
            return haystack.includes(state.search);
        });
}

function getChatById(chatId) {
    return state.chats.find((chat) => chat.id === chatId) || null;
}

function getActiveChat() {
    return getChatById(state.activeChatId);
}

function getMessages(chatId) {
    return [...(state.messages[chatId] || [])].sort((left, right) => left.timestamp - right.timestamp);
}

function getLastMessage(chatId) {
    const messages = getMessages(chatId);
    return messages[messages.length - 1] || null;
}

function getLastTimestamp(chatId) {
    return getLastMessage(chatId)?.timestamp || 0;
}

function getChatParticipants(chat) {
    return chat.participantIds.map((participantId) => state.people[participantId]).filter(Boolean);
}

function getDirectPeer(chat) {
    return getChatParticipants(chat).find((person) => person.id !== state.currentUser.id) || state.currentUser;
}

function getChatTitle(chat) {
    return chat.type === "group" ? chat.name : getDirectPeer(chat).name;
}

function buildPresenceCopy(person) {
    if (person.presence === "online") return `${person.statusText} · online now`;
    if (person.presence === "away") return `${person.statusText} · away`;
    return `${person.statusText} · offline`;
}

function renderChatAvatar(chat) {
    if (chat.type === "direct") {
        return renderPersonAvatar(getDirectPeer(chat), "directory-avatar", true);
    }

    const otherPeople = getChatParticipants(chat).filter((person) => person.id !== state.currentUser.id).slice(0, 3);
    return `
        <div class="avatar-stack">
            ${otherPeople.map((person) => `
                <div class="avatar-token" style="--avatar-a:${person.toneA}; --avatar-b:${person.toneB};">
                    <span>${escapeHtml(person.initials)}</span>
                </div>
            `).join("")}
        </div>
    `;
}

function renderPersonAvatar(person, className, withPresence) {
    const presence = withPresence ? `<span class="presence-dot ${escapeHtml(person.presence)}"></span>` : "";
    return `
        <div class="${className} avatar-token" style="--avatar-a:${person.toneA}; --avatar-b:${person.toneB};">
            ${person.avatarUrl ? `<img src="${escapeHtml(person.avatarUrl)}" alt="${escapeHtml(person.name)}">` : `<span>${escapeHtml(person.initials)}</span>`}
            ${presence}
        </div>
    `;
}

function ensureDirectChat(friendId) {
    const chatId = `dm-${friendId}`;
    let chat = state.chats.find((c) => c.id === chatId);
    if (chat) return chat;

    chat = {
        id: chatId,
        type: "direct",
        participantIds: [state.currentUser.id, friendId],
        unread: 0
    };
    state.chats.unshift(chat);
    state.messages[chatId] = [];
    if (!state.friends.includes(friendId)) state.friends.unshift(friendId);
    return chat;
}

function ensurePerson(name) {
    const id = toId(name);
    if (state.people[id]) return state.people[id];

    const [toneA, toneB] = pickTone(id);
    state.people[id] = {
        id,
        name,
        avatarUrl: '',
        presence: 'online',
        statusText: 'Ready to collaborate',
        initials: getInitials(name),
        toneA,
        toneB,
        role: 'Guest'
    };
    if (!state.friends.includes(id)) state.friends.unshift(id);
    return state.people[id];
}

function createFallbackPerson(id) {
    const safeId = id || 'guest';
    const [toneA, toneB] = pickTone(safeId);
    return {
        id: safeId,
        name: safeId,
        avatarUrl: '',
        presence: 'offline',
        statusText: '',
        initials: getInitials(safeId),
        toneA,
        toneB,
        role: 'Member'
    };
}

// Helper pick logic removed.


function renderAvatarContent(person, withPresence) {
    const presence = withPresence ? `<span class="presence-dot ${escapeHtml(person.presence)}"></span>` : "";
    return `
        <div class="avatar-token" style="--avatar-a:${person.toneA}; --avatar-b:${person.toneB}; width:100%; height:100%; border-radius:16px;">
            ${person.avatarUrl ? `<img src="${escapeHtml(person.avatarUrl)}" alt="${escapeHtml(person.name)}">` : `<span>${escapeHtml(person.initials)}</span>`}
        </div>
        ${presence}
    `;
}

function formatPreviewText(message) {
    if (!message) return "";
    const sender = state.people[message.senderId];
    const prefix = message.senderId === state.currentUser.id ? "You: " : sender ? `${sender.name.split(" ")[0]}: ` : "";
    if (message.gifUrl) return `${prefix}Sent a GIF`;
    return `${prefix}${message.text}`;
}

function formatConversationTime(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTimestamp(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function formatMessageText(text) {
    const escaped = escapeHtml(text).replace(/\n/g, "<br>");
    return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function scrollToLatest(smooth) {
    elements.messageStream.scrollTo({
        top: elements.messageStream.scrollHeight,
        behavior: smooth ? "smooth" : "auto"
    });
    updateJumpButton();
}

function updateJumpButton() {
    const hidden = isNearBottom(elements.messageStream);
    elements.jumpLatestButton.classList.toggle("hidden", hidden || state.nav !== "home");
}

function isNearBottom(container) {
    return container.scrollHeight - container.scrollTop - container.clientHeight < 110;
}

function persistState() {
    // Only persist lightweight UI state — messages/chats/people come from Supabase
    localStorage.setItem(THEME_KEY, state.theme);
    if (state.currentUser) {
        localStorage.setItem('nexus_custom_status', state.currentUser.statusText);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activeChatId: state.activeChatId,
        currentUserStatus: state.currentUser?.statusText
    }));
}

function readStorage(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error("Unable to parse stored data", error);
        return null;
    }
}

function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function getInitials(name) {
    return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "PX";
}

function pickTone(seed) {
    let total = 0;
    for (let index = 0; index < seed.length; index += 1) {
        total += seed.charCodeAt(index);
    }
    return AVATAR_TONES[total % AVATAR_TONES.length];
}

function toId(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
}

function unique(items) {
    return [...new Set(items)];
}

function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
