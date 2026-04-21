const STORAGE_KEY = "pulse-messenger-ui-v1";
const THEME_KEY = "site-theme";
const KLIPY_API_KEY = "4o9v8SiiAWDJy8Dq2Q4mHfV35hQtFswJpH3NTRckha7dG5MmGzXdgfk94XEE8gUQ";

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
    messageSubscription: null,
    threadAvatars: {},
    requests: [],
    // Mention state
    mentionQuery: null,
    mentionPeople: [],
    mentionIndex: 0,
    // Search state
    searchQuery: "",
    searchActive: false,
    // Advanced messaging
    replyingTo: null,
    editingMessage: null,
    currentSheetTab: "members" 
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
    cacheElements();

    // Polling bootloader: ensures we don't proceed until Supabase is ready
    let bootAttempts = 0;
    const bootInterval = setInterval(async () => {
        bootAttempts++;
        if (window.supabaseClient) {
            clearInterval(bootInterval);
            console.log(`[Pulse] Booting with Supabase after ${bootAttempts * 100}ms`);
            
            try {
                await initializeState();
            } catch (error) {
                console.error('[Pulse] Critical initialization failure:', error);
            }

            // Always attempt to bind and render, even if state is partial
            bindEvents();
            renderApp();
            setupRealtimeSubscriptions();
            startPresenceHeartbeat();

            // Handle deep-linking via query params (?dm=username)
            const params = new URLSearchParams(window.location.search);
            const dmUser = params.get('dm');
            if (dmUser) {
                window.openDirectMessage(dmUser);
            }
        } else if (bootAttempts > 50) { 
            // Safety timeout after 5s - attempt to render whatever we can
            clearInterval(bootInterval);
            console.warn('[Pulse] Supabase took too long. Booting in offline mode.');
            bindEvents();
            renderApp();
        }
    }, 100);
});

// Global helper for profile summary & other pages
window.openDirectMessage = (username) => {
    if (!username) return;
    const person = ensurePersonInDB(username);
    const chat = ensureDirectChat(person.id);
    selectChat(chat.id);
};

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
    elements.globalViewButton = document.getElementById("globalViewButton");
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
    elements.workspace = document.getElementById("workspace");
    elements.friendsStage = document.getElementById("friendsStage");
    elements.requestsStage = document.getElementById("requestsStage");
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
    elements.userSearchResults = document.getElementById("userSearchResults");
    elements.requestsViewButton = document.getElementById("requestsViewButton");
    elements.requestsBadge = document.getElementById("requestsBadge");
    
    // These are the remaining elements not yet cached above
    elements.membersToggleButton = document.getElementById("membersToggleButton");
    elements.jumpLatestButton = document.getElementById("jumpLatestButton");
    elements.uploadButton = document.getElementById("uploadButton");
    elements.fileInput = document.getElementById("fileInput");

    // New elements
    elements.mentionDropdown = document.getElementById("mentionDropdown");
    elements.openSearchButton = document.getElementById("openSearchButton");
    elements.workspaceSearchField = document.getElementById("workspaceSearchField");
    elements.workspaceSearchInput = document.getElementById("workspaceSearchInput");
    elements.closeWorkspaceSearch = document.getElementById("closeWorkspaceSearch");

    elements.replyPreview = document.getElementById("replyPreview");
    elements.replyToName = document.getElementById("replyToName");
    elements.replyToText = document.getElementById("replyToText");
    elements.cancelReplyButton = document.getElementById("cancelReplyButton");
    
    elements.editPreview = document.getElementById("editPreview");
    elements.cancelEditButton = document.getElementById("cancelEditButton");

    elements.pinnedMessagesBar = document.getElementById("pinnedMessagesBar");
    elements.pinnedMessageText = document.getElementById("pinnedMessageText");
    elements.closePinnedBar = document.getElementById("closePinnedBar");

    elements.membersSheet = document.getElementById("membersSheet");
    elements.sheetContent = document.getElementById("sheetContent");
    elements.sheetTabs = document.querySelectorAll(".sheet-tab");
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

    const fallbackName = profile?.username || user.user_metadata?.full_name || user.email.split('@')[0];
    const fallbackPic = user.user_metadata?.avatar_url || localStorage.getItem('rbx_pic') || 'jay.png';

    let activeProfile = profile;
    if (!activeProfile) {
        // Create initial profile if missing
        const newProfile = {
            id: user.id,
            username: user.email.split('@')[0], // Default to email prefix
            display_name: user.user_metadata?.full_name || user.email.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url || 'jay.png',
            status: 'Ready to chat'
        };
        const { data: created, error: createError } = await window.supabaseClient
            .from('profiles')
            .upsert(newProfile, { onConflict: 'id' })
            .select()
            .single();
        
        if (!createError) activeProfile = created;
    }

    state.currentUser = {
        id: activeProfile?.username || user.email.split('@')[0],
        name: activeProfile?.display_name || fallbackName,
        avatarUrl: activeProfile?.avatar_url || fallbackPic,
        presence: "online",
        statusText: activeProfile?.status || "Shipping polished interfaces",
        initials: getInitials(activeProfile?.display_name || fallbackName),
        toneA: "#7b8cff",
        toneB: "#64d9ff",
        role: "You"
    };

    // Load all people/profiles
    const { data: allProfiles } = await window.supabaseClient
        .from('profiles')
        .select('*');

    // Load recent thread avatars as fallback (using 'threads' table, not 'posts')
    const { data: latestThreads } = await window.supabaseClient
        .from('threads')
        .select('author, avatar_url')
        .not('avatar_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

    state.threadAvatars = {};
    if (latestThreads) {
        latestThreads.forEach(t => {
            if (t.author && !state.threadAvatars[t.author]) state.threadAvatars[t.author] = t.avatar_url;
        });
    }

    if (allProfiles) {
        allProfiles.forEach(p => {
            const id = p.username;
            const [toneA, toneB] = pickTone(id);
            state.people[id] = {
                id,
                name: p.display_name || p.username,
                avatarUrl: p.avatar_url || state.threadAvatars[id] || "",
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
    console.log('[Pulse] Starting deep sync with Supabase...');
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const uuid = session?.user?.id;

    // Fetch all messages where the current user is involved
    const { data: messages, error: msgError } = await window.supabaseClient
        .from('messages')
        .select('*')
        .or(`sender.eq.${state.currentUser.id},receiver.eq.${state.currentUser.id},sender.eq.${uuid},receiver.eq.${uuid},receiver.eq.global_chat`)
        .order('created_at', { ascending: true });

    if (msgError) {
        console.error('[Pulse] Failed to load messages:', msgError);
        return;
    }
    
    console.log(`[Pulse] Found ${messages?.length || 0} messages in cloud history.`);

    // Clear local buffers to avoid stale data
    state.messages = {};
    const chatsMap = new Map();

    // Build chat objects from the mapped messages
    messages.forEach(msg => {
        let chatId, chatType, chatName;
        if (msg.receiver === 'global_chat') {
            chatId = 'global_chat';
            chatType = 'global';
            chatName = 'Global Chat';
        } else if (msg.channel_type === 'group') {
            return; // Groups handled in fetchGroups
        } else {
            const otherUser = msg.sender === state.currentUser.id ? msg.receiver : msg.sender;
            chatId = `dm-${otherUser}`;
            chatType = 'direct';
            chatName = state.people[otherUser]?.name || otherUser;
        }

        if (!chatsMap.has(chatId)) {
            chatsMap.set(chatId, {
                id: chatId,
                type: chatType,
                participantIds: chatType === 'direct' ? [state.currentUser.id, chatId.replace('dm-', '')] : [],
                name: chatName,
                unread: 0,
                lastTimestamp: 0
            });
        }

        const chat = chatsMap.get(chatId);
        const ts = new Date(msg.created_at).getTime();
        if (ts > chat.lastTimestamp) chat.lastTimestamp = ts;

        // CRITICAL: Actually store the message in state
        if (!state.messages[chatId]) state.messages[chatId] = [];
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

    // Ensure Global Chat exists even with no messages
    if (!state.chats.some(c => c.id === 'global_chat')) {
        state.chats.unshift({
            id: 'global_chat',
            type: 'global',
            name: 'Global Chat',
            participantIds: [],
            unread: 0,
            lastTimestamp: 0
        });
    }

    // Restore activeChatId from localStorage if still valid
    const savedState = readStorage(STORAGE_KEY);
    const savedChatId = savedState?.activeChatId;
    if (savedChatId && state.chats.some(c => c.id === savedChatId)) {
        state.activeChatId = savedChatId;
    } else {
        state.activeChatId = state.chats[0]?.id || null;
    }

    // Fetch groups where the current user is a member
    await fetchGroups();

    // Fetch friend requests
    await fetchFriendRequests();

    // Build friends list from all known people except self
    state.friends = Object.keys(state.people).filter(id => id !== state.currentUser.id);
}

async function fetchGroups() {
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
}

async function fetchFriendRequests() {
    const { data: requests, error } = await window.supabaseClient
        .from('friend_requests')
        .select('*')
        .eq('to_user', state.currentUser.id)
        .eq('status', 'pending');

    if (!error) {
        state.requests = requests || [];
        // Ensure request senders are in state.people
        for (const req of state.requests) {
            await ensurePersonInDB(req.from_user);
        }
    }
}

function setupRealtimeSubscriptions() {
    if (state.messageSubscription) state.messageSubscription.unsubscribe();

    // 1. Messages channel (Global)
    window.supabaseClient
        .channel('realtime-msgs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            handleIncomingMessage(payload.new);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
            const msg = payload.new;
            for (const chatId in state.messages) {
                const existing = state.messages[chatId].find(m => String(m.id) === String(msg.id));
                if (existing) {
                    existing.reactions = msg.reactions || [];
                    if (state.activeChatId === chatId) renderWorkspace();
                    break;
                }
            }
        })
        .subscribe();

    // 2. Friend requests channel (Global)
    window.supabaseClient
        .channel('realtime-reqs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, payload => {
            if (payload.new && payload.new.to_user === state.currentUser.id) {
                fetchFriendRequests().then(() => renderApp());
            }
        })
        .subscribe();

    // 3. Per-Channel Listeners (Typing)
    updatePerChannelSubscriptions();
}

function updatePerChannelSubscriptions() {
    const activeChat = getActiveChat();
    
    // Clear existing typing channel if any
    if (state.typingChannel) {
        state.typingChannel.unsubscribe();
        state.typingChannel = null;
    }
    
    if (!activeChat) return;

    state.typingChannel = window.supabaseClient
        .channel(`chat-typing-${activeChat.id}`)
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
            if (payload.senderId !== state.currentUser.id) {
                if (payload.isTyping) {
                    state.typing = { chatId: activeChat.id, senderName: payload.senderName };
                } else {
                    state.typing = null;
                }
                renderTypingIndicator();
            }
        })
        .subscribe();
}

function handleIncomingMessage(msg) {
    if (!state.currentUser) return;

    // Determine if this message is relevant to the current user
    const knownGroupIds = state.chats.filter(c => c.type === 'group').map(c => c.id);
    const isDM = msg.channel_type === 'direct' || !msg.channel_type;
    const isGlobal = msg.receiver === 'global_chat';
    const isGroupForMe = msg.channel_type === 'group' && knownGroupIds.includes(msg.receiver);
    const isDMForMe = isDM && (msg.sender === state.currentUser.id || msg.receiver === state.currentUser.id);

    if (!isDMForMe && !isGroupForMe && !isGlobal) return;

    let chatId;
    if (msg.channel_type === 'group' || isGlobal) {
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
                            avatarUrl: data.avatar_url || state.threadAvatars?.[otherUser] || '',
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
    elements.globalViewButton.addEventListener("click", () => setNavView("global"));
    elements.friendsViewButton.addEventListener("click", () => setNavView("friends"));
    elements.requestsViewButton.addEventListener("click", () => setNavView("requests"));
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

    elements.directRecipientInput.addEventListener("input", handleUserSearch);
    elements.userSearchResults.addEventListener("click", handleSearchResultSelection);

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeydown);
    window.addEventListener("resize", handleResize);
    elements.uploadButton.addEventListener("click", () => elements.fileInput.click());
    elements.fileInput.addEventListener("change", handleFileUpload);

    // Search events
    elements.openSearchButton.addEventListener("click", toggleWorkspaceSearch);
    elements.closeWorkspaceSearch.addEventListener("click", toggleWorkspaceSearch);
    elements.workspaceSearchInput.addEventListener("input", handleWorkspaceSearch);

    // Mention events
    elements.mentionDropdown.addEventListener("click", handleMentionClick);

    // Advanced features
    if (elements.cancelReplyButton) elements.cancelReplyButton.addEventListener("click", cancelReply);
    if (elements.cancelEditButton) elements.cancelEditButton.addEventListener("click", cancelEdit);
    if (elements.closePinnedBar) elements.closePinnedBar.addEventListener("click", () => elements.pinnedMessagesBar.classList.add("hidden"));

    elements.sheetTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            state.currentSheetTab = tab.dataset.tab;
            elements.sheetTabs.forEach(t => t.classList.toggle("active", t === tab));
            renderSheet();
        });
    });
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !state.currentUser) return;

    const activeChat = getActiveChat();
    if (!activeChat) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `chat-assets/${fileName}`;

    if (window.showTopNotification) window.showTopNotification('Uploading image...', 'info');

    const { error: uploadError } = await window.supabaseClient.storage
        .from('attachments')
        .upload(filePath, file);

    if (uploadError) {
        console.error('Upload failed:', uploadError);
        if (window.showTopNotification) window.showTopNotification('Upload failed. Check your storage bucket.', 'error');
        return;
    }

    const { data: { publicUrl } } = window.supabaseClient.storage
        .from('attachments')
        .getPublicUrl(filePath);

    // Send as a message with the image URL
    sendGif(publicUrl); // Reusing sendGif logic since it handles image URLs perfectly
    elements.fileInput.value = '';
}

window.handleFriendRequestAction = async function(id, action) {
    const { error } = await window.supabaseClient
        .from('friend_requests')
        .update({ status: action === 'accept' ? 'accepted' : 'declined' })
        .eq('id', id);

    if (error) {
        if (window.showTopNotification) window.showTopNotification('Failed to process request', 'error');
    } else {
        await fetchFriendRequests();
        renderApp();
    }
}

window.sendFriendRequest = async function(username) {
    if (!state.currentUser) return;
    const { error } = await window.supabaseClient
        .from('friend_requests')
        .insert({
            from_user: state.currentUser.id,
            to_user: username,
            status: 'pending'
        });

    if (error) {
        if (window.showTopNotification) window.showTopNotification('Request already sent or error occurred', 'error');
    } else {
        if (window.showTopNotification) window.showTopNotification('Friend request sent!', 'success');
    }
}

async function handleUserSearch(event) {
    const query = event.target.value.trim();
    if (!query || query.length < 2) {
        elements.userSearchResults.classList.add("hidden");
        return;
    }

    const { data: users, error } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(5);

    if (error || !users || users.length === 0) {
        elements.userSearchResults.innerHTML = '<div class="search-result-item">No users found</div>';
        elements.userSearchResults.classList.remove("hidden");
        return;
    }

    elements.userSearchResults.innerHTML = users.map(user => `
        <button class="search-result-item" type="button" data-username="${user.username}" data-displayname="${user.display_name || user.username}">
            ${renderPersonAvatar({
                initials: getInitials(user.display_name || user.username),
                toneA: pickTone(user.username)[0],
                toneB: pickTone(user.username)[1],
                avatarUrl: user.avatar_url,
                name: user.display_name || user.username
            }, "avatar-token", false)}
            <div class="search-result-info">
                <strong>${escapeHtml(user.display_name || user.username)}</strong>
                <span>@${escapeHtml(user.username)}</span>
            </div>
        </button>
    `).join("");
    elements.userSearchResults.classList.remove("hidden");
}

function handleSearchResultSelection(event) {
    const item = event.target.closest(".search-result-item");
    if (!item || !item.dataset.username) return;

    elements.directRecipientInput.value = item.dataset.username;
    elements.userSearchResults.classList.add("hidden");
}

function renderApp() {
    // Guard: if currentUser isn't set yet (e.g. initializeState failed or redirected),
    // skip the full render to prevent cascading crashes in renderDirectory/renderWorkspace/renderMessages.
    if (!state.currentUser) return;

    applyAppTheme();
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
    // Guard: if currentUser isn't loaded yet (e.g. initializeState returned early),
    // skip the render to avoid crashing on null.name / null.statusText
    if (!state.currentUser) return;

    const homeUnread = state.chats.reduce((total, chat) => total + (chat.unread || 0), 0);
    const onlineFriends = state.friends.filter((friendId) => state.people[friendId]?.presence === "online").length;

    elements.homeViewButton.setAttribute("aria-pressed", state.nav === "home");
    elements.globalViewButton.setAttribute("aria-pressed", state.nav === "global");
    elements.friendsViewButton.setAttribute("aria-pressed", state.nav === "friends");
    elements.requestsViewButton.setAttribute("aria-pressed", state.nav === "requests");

    // Add visual 'active' class as well for styling redundancy
    elements.homeViewButton.classList.toggle("active", state.nav === "home");
    elements.globalViewButton.classList.toggle("active", state.nav === "global");
    elements.friendsViewButton.classList.toggle("active", state.nav === "friends");
    elements.requestsViewButton.classList.toggle("active", state.nav === "requests");

    elements.homeUnreadBadge.textContent = homeUnread;
    elements.homeUnreadBadge.classList.toggle("hidden", homeUnread === 0);
    
    elements.friendsOnlineBadge.textContent = onlineFriends;
    elements.friendsOnlineBadge.classList.toggle("hidden", onlineFriends === 0);

    const requestCount = state.requests.length;
    elements.requestsBadge.textContent = requestCount;
    elements.requestsBadge.classList.toggle("hidden", requestCount === 0);

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

    if (state.nav === "global") {
        // Show the full chat list in the directory while workspace shows Global Chat
        elements.directoryEyebrow.textContent = "Inbox";
        elements.directoryTitle.textContent = "All conversations";
        elements.directorySubtitle.textContent = "Return to any direct or group chat from here.";
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

    if (state.nav === "requests") {
        // No list to show in directory when viewing requests
        elements.directoryEyebrow.textContent = "Invites";
        elements.directoryTitle.textContent = "Friend requests";
        elements.directorySubtitle.textContent = "Manage pending requests in the panel on the right.";
        elements.searchInput.placeholder = "";
        elements.newConversationButton.textContent = "New chat";
        elements.filterBar.innerHTML = "";
        elements.directoryContent.innerHTML = "";
        return;
    }

    // nav === "friends"
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
        elements.requestsStage.classList.add("hidden");
        elements.chatStage.classList.add("hidden");
        elements.composer.classList.add("hidden");
        elements.membersToggleButton.classList.add("hidden");
        elements.jumpLatestButton.classList.add("hidden");
        elements.workspaceIdentity.innerHTML = renderWorkspaceSectionIdentity("Friends", "See who is online and jump straight into a conversation.");
        elements.friendsStage.innerHTML = renderFriendsStage();
        return;
    }

    if (state.nav === "requests") {
        elements.friendsStage.classList.add("hidden");
        elements.requestsStage.classList.remove("hidden");
        elements.chatStage.classList.add("hidden");
        elements.composer.classList.add("hidden");
        elements.membersToggleButton.classList.add("hidden");
        elements.jumpLatestButton.classList.add("hidden");
        elements.workspaceIdentity.innerHTML = renderWorkspaceSectionIdentity("Requests", "Manage your pending chat invitations.");
        renderRequestsView();
        return;
    }

    const activeChat = getActiveChat();
    elements.friendsStage.classList.add("hidden");
    elements.requestsStage.classList.add("hidden");
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

    // Setup Workspace Content
    if (state.searchActive) {
        renderSearchHeader();
    } else {
        elements.workspaceIdentity.innerHTML = renderWorkspaceChatIdentity(activeChat);
        renderPinnedBar(activeChat);
    }
    
    // Global Chat and group chats show Members panel; DMs show Profile
    elements.membersToggleButton.textContent = (activeChat.type === "group" || activeChat.type === "global") ? "Members" : "Profile";
    elements.membersSheet.classList.toggle("hidden", !state.membersOpen);
    
    renderMessages(activeChat);
    renderSheet();
    elements.messageInput.placeholder = `Message ${getChatTitle(activeChat)}`;
}

function renderPinnedBar(chat) {
    if (!chat || !elements.pinnedMessagesBar) return;
    const messages = state.messages[chat.id] || [];
    const pins = messages.filter(m => m.isPinned);
    
    if (pins.length > 0) {
        elements.pinnedMessagesBar.classList.remove("hidden");
        elements.pinnedMessageText.innerText = pins[pins.length - 1].text.substring(0, 60) + "...";
        elements.pinnedMessageText.onclick = () => scrollToMessage(pins[pins.length - 1].id);
    } else {
        elements.pinnedMessagesBar.classList.add("hidden");
    }
}

function renderSheet() {
    if (!state.membersOpen || !elements.sheetContent) return;
    
    const activeChat = getActiveChat();
    if (!activeChat) return;

    if (state.currentSheetTab === "members") {
        elements.sheetContent.innerHTML = renderMembersSheet(activeChat);
    } else if (state.currentSheetTab === "gallery") {
        const messages = state.messages[activeChat.id] || [];
        const media = messages.filter(m => m.gifUrl);
        elements.sheetContent.innerHTML = `
            <div class="gallery-grid">
                ${media.map(m => `
                    <div class="gallery-item" onclick="window.showLightbox('${m.gifUrl}')">
                        <img src="${m.gifUrl}" loading="lazy">
                    </div>
                `).join("")}
            </div>
            ${media.length === 0 ? '<p style="text-align:center; color:var(--text-muted); font-size:0.8rem; margin-top:20px;">No media found.</p>' : ''}
        `;
    } else if (state.currentSheetTab === "pinned") {
        const messages = state.messages[activeChat.id] || [];
        const pins = messages.filter(m => m.isPinned);
        elements.sheetContent.innerHTML = `
            <div class="members-list">
                ${pins.map(m => `
                    <div class="search-result-item" onclick="scrollToMessage('${m.id}')">
                        <div class="search-result-info">
                            <strong>${escapeHtml(m.sender)}</strong>
                            <span>${escapeHtml(m.text.substring(0, 40))}...</span>
                        </div>
                    </div>
                `).join("")}
                ${pins.length === 0 ? '<p style="text-align:center; color:var(--text-muted); font-size:0.8rem; margin-top:20px;">No pinned messages.</p>' : ''}
            </div>
        `;
    }
}

function renderWorkspaceSectionIdentity(title, copy) {
    const toneA = state.currentUser?.toneA || '#7b8cff';
    const toneB = state.currentUser?.toneB || '#64d9ff';
    return `
        <div class="workspace-identity">
            <div class="workspace-avatar avatar-token" style="--avatar-a:${toneA}; --avatar-b:${toneB};">
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
    if (chat.type === "global") {
        const globalInfo = {
            id: 'global_chat',
            name: 'Global Chat',
            avatarUrl: 'px-logo.png',
            initials: 'PX',
            toneA: '#7b8cff',
            toneB: '#64d9ff'
        };
        return `
            <div class="workspace-identity">
                ${renderPersonAvatar(globalInfo, "workspace-avatar", false)}
                <div class="workspace-avatar-copy">
                    <h2>Global Chat</h2>
                    <p>Connecting everyone across the Pulse network</p>
                </div>
            </div>
        `;
    }

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
    const avatarHtml = `
        <div class="message-avatar" onclick="window.showProfileSummary('${person.id}')" style="cursor: pointer;">
            ${renderPersonAvatar(person, "message-avatar-token", false)}
        </div>
    `;
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
        const isOwn = !!state.currentUser && message.senderId === state.currentUser.id;
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
            <article class="message-item ${isOwn ? "sent" : "received"} ${message.isPinned ? "is-pinned" : ""}" data-message-id="${message.id}">
                ${isOwn ? "" : renderPersonAvatar(sender, "member-avatar", true)}
                <div class="message-shell">
                    <div class="message-meta">
                        <strong class="message-sender" onclick="window.showProfileSummary('${message.senderId}')" style="cursor: pointer;">${escapeHtml(sender.name)}</strong>
                        <span class="message-time">${escapeHtml(formatMessageTimestamp(message.timestamp))}</span>
                    </div>
                    ${message.isPinned ? `<div style="color:var(--accent); font-size:0.6rem; margin-bottom:4px; display:flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M12 2L15 8L22 9L17 14L18.5 21L12 17.5L5.5 21L7 14L2 9L9 8L12 2Z"/></svg> Pinned</div>` : ""}
                    ${message.reply_to ? renderReplyContext(message.reply_to, chat.id) : ""}
                    ${message.gifUrl ? `<div class="message-attachment"><img src="${escapeHtml(message.gifUrl)}" alt="GIF attachment" loading="lazy"></div>` : ""}
                    ${message.text ? `<div class="message-bubble">${renderFormattedText(message.text)}${message.is_edited ? '<span class="message-edited-tag">(edited)</span>' : ''}</div>` : ""}
                    ${message.link_preview ? renderLinkPreview(message.link_preview) : ""}
                    ${reactionMenu}
                    ${reactions}
                </div>
                <div class="message-toolbar ${state.reactionMenu && state.reactionMenu.messageId === message.id ? "active" : ""}">
                    <button class="message-action-button" type="button" title="Reply" data-action="reply" data-chat-id="${chat.id}" data-message-id="${message.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6m-6-6l6-6"/></svg>
                    </button>
                    ${isOwn ? `
                        <button class="message-action-button" type="button" title="Edit" data-action="edit" data-chat-id="${chat.id}" data-message-id="${message.id}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                    ` : ""}
                    <button class="message-action-button" type="button" title="React" data-action="toggle-reaction-menu" data-chat-id="${chat.id}" data-message-id="${message.id}">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M8.5 10.5h.01"></path><path d="M15.5 10.5h.01"></path><path d="M8.5 14.5c.8 1.1 2 1.7 3.5 1.7s2.7-.6 3.5-1.7"></path></svg>
                    </button>
                    <button class="message-action-button" type="button" title="Pin" data-action="pin" data-chat-id="${chat.id}" data-message-id="${message.id}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15 8L22 9L17 14L18.5 21L12 17.5L5.5 21L7 14L2 9L9 8L12 2Z"/></svg>
                    </button>
                    <button class="message-action-button delete" type="button" title="Delete" data-action="delete-message" data-chat-id="${chat.id}" data-message-id="${message.id}">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 12h10l1-12"></path><path d="M9 7V4h6v3"></path></svg>
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

function renderReplyContext(replyToId, chatId) {
    const parent = (state.messages[chatId] || []).find(m => String(m.id) === String(replyToId));
    if (!parent) return "";
    
    return `
        <div class="message-reply-context" onclick="scrollToMessage('${parent.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6m-6-6l6-6"/></svg>
            <span>Replying to <strong>${escapeHtml(state.people[parent.senderId]?.name || parent.senderId)}</strong></span>
        </div>
    `;
}

function renderLinkPreview(preview) {
    return `
        <div class="link-preview-card" onclick="window.open('${escapeHtml(preview.url)}', '_blank')">
            ${preview.image ? `<img src="${escapeHtml(preview.image)}" class="link-preview-image">` : ""}
            <div class="link-preview-body">
                <div class="link-preview-title">${escapeHtml(preview.title)}</div>
                <div class="link-preview-desc">${escapeHtml(preview.desc)}</div>
                <div class="link-preview-site">${escapeHtml(new URL(preview.url).hostname)}</div>
            </div>
        </div>
    `;
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
    if (!elements.gifGrid) return;
    elements.gifGrid.innerHTML = '<p class="text-muted" style="padding: 12px; text-align: center;">Loading GIFs...</p>';

    const url = query
        ? `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/search?q=${encodeURIComponent(query.trim())}&limit=20`
        : `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/trending?limit=20`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Klipy API responded with status ${response.status}`);

        const json = await response.json();
        const results = (json.data && Array.isArray(json.data.data)) ? json.data.data : [];

        if (results.length === 0) {
            elements.gifGrid.innerHTML = '<p class="text-muted" style="padding: 12px; text-align: center;">No GIFs found for this search.</p>';
            return;
        }

        elements.gifGrid.innerHTML = results.map(gif => {
            const gifUrl = gif?.file?.gif || '';
            if (!gifUrl) return '';
            return `<img class="gif-item" src="${gifUrl}" data-full-url="${gifUrl}" alt="${escapeHtml(gif.title || 'GIF')}" loading="lazy">`;
        }).join("");
    } catch (e) {
        console.error('[Pulse] Klipy Fetch Fail:', e);
        elements.gifGrid.innerHTML = '<p class="text-danger" style="padding: 12px; text-align: center;">GIF service is currently unavailable.</p>';
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
    if (view === 'global') {
        state.activeChatId = 'global_chat';
    }
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
    applyAppTheme();
}

function applyAppTheme() {
    if (state.theme === "light") {
        document.body.classList.add("light-mode");
    } else {
        document.body.classList.remove("light-mode");
    }
}

// Bridge for global.js calls
window.setMode = function(mode, target) {
    if (mode === 'dm') {
        openConversationModal('direct');
        if (elements.directRecipientInput) {
            elements.directRecipientInput.value = target;
            handleUserSearch({ target: elements.directRecipientInput });
        }
    }
};

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

    if (state.nav === "home" || state.nav === "global") {
        state.chatFilter = button.dataset.filter;
    } else if (state.nav === "friends") {
        state.friendFilter = button.dataset.filter;
    }
    // requests nav has no filter bar — do nothing

    renderDirectory();
}

function handleDirectoryClick(event) {
    const friendAction = event.target.closest("[data-start-chat]");
    if (friendAction) {
        const friendId = friendAction.dataset.friendId;
        const chat = ensureDirectChat(friendId);
        state.nav = "home"; // Ensure we jump to chats view
        selectChat(chat.id);
        return;
    }

    const friendRow = event.target.closest("[data-friend-id]");
    if (friendRow) {
        const chat = ensureDirectChat(friendRow.dataset.friendId);
        state.nav = "home"; // Ensure we jump to chats view
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

    if (action === "reply") {
        setReply(chatId, messageId);
    } else if (action === "edit") {
        setEdit(chatId, messageId);
    } else if (action === "pin") {
        togglePinMessage(chatId, messageId);
    } else if (action === "delete-message") {
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
    detectMentions();
    
    // Broadcast typing state
    broadcastTyping(true);
}

// Presence heartbeat
let presenceInterval = null;
function startPresenceHeartbeat() {
    if (presenceInterval) clearInterval(presenceInterval);
    updateMyPresence('online');
    presenceInterval = setInterval(() => updateMyPresence('online'), 1000 * 60); // every minute
}

async function updateMyPresence(status) {
    if (!state.currentUser) return;
    try {
        await window.supabaseClient.rpc('update_user_presence', { 
            username: state.currentUser.id, 
            status: status 
        });
    } catch (e) {
        console.warn('[Pulse] Presence sync failed. Did you run feature_updates.sql?', e);
    }
}

function detectMentions() {
    const value = elements.messageInput.value;
    const selectionStart = elements.messageInput.selectionStart;
    const textBeforeCursor = value.substring(0, selectionStart);
    
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
        state.mentionQuery = mentionMatch[1].toLowerCase();
        const activeChat = getActiveChat();
        
        // Filter pool: If in group/global, first show chat participants, then all friends
        let pool = [];
        if (activeChat && (activeChat.type === 'group' || activeChat.type === 'global')) {
            pool = getChatParticipants(activeChat);
        } else {
            pool = state.friends.map(id => state.people[id]).filter(Boolean);
        }
        
        state.mentionPeople = pool.filter(p => 
            p.id !== state.currentUser.id && 
            (p.name.toLowerCase().includes(state.mentionQuery) || p.id.toLowerCase().includes(state.mentionQuery))
        ).slice(0, 8);
        
        if (state.mentionPeople.length > 0) {
            renderMentionDropdown();
            return;
        }
    }
    
    state.mentionQuery = null;
    renderMentionDropdown();
}

function handleMentionClick(event) {
    const item = event.target.closest(".mention-item");
    if (!item) return;
    insertMention(item.dataset.username);
}

function insertMention(username) {
    const value = elements.messageInput.value;
    const selectionStart = elements.messageInput.selectionStart;
    const textBeforeCursor = value.substring(0, selectionStart);
    const textAfterCursor = value.substring(selectionStart);
    
    const nextBefore = textBeforeCursor.replace(/@\w*$/, `@${username} `);
    elements.messageInput.value = nextBefore + textAfterCursor;
    
    state.mentionQuery = null;
    renderMentionDropdown();
    elements.messageInput.focus();
    updateComposerMetrics();
    autoResizeComposer();
}

function renderMentionDropdown() {
    const show = state.mentionQuery !== null && state.mentionPeople.length > 0;
    elements.mentionDropdown.classList.toggle("hidden", !show);
    
    if (!show) return;
    
    elements.mentionDropdown.innerHTML = state.mentionPeople.map((person, idx) => `
        <button class="mention-item ${idx === state.mentionIndex ? 'active' : ''}" type="button" data-username="${person.id}">
            ${renderPersonAvatar(person, "avatar-token", false)}
            <div class="mention-info">
                <strong>${escapeHtml(person.name)}</strong>
                <span>@${escapeHtml(person.id)}</span>
            </div>
        </button>
    `).join("");
}

function toggleWorkspaceSearch() {
    state.searchActive = !state.searchActive;
    elements.workspaceSearchField.classList.toggle("hidden", !state.searchActive);
    elements.openSearchButton.classList.toggle("hidden", state.searchActive);
    
    if (state.searchActive) {
        elements.workspaceSearchInput.focus();
    } else {
        state.searchQuery = "";
        elements.workspaceSearchInput.value = "";
        renderWorkspace();
    }
}

function handleWorkspaceSearch(event) {
    state.searchQuery = event.target.value.trim().toLowerCase();
    renderWorkspace();
}

function renderFormattedText(text) {
    // 1. Escape HTML
    let content = escapeHtml(text).replace(/\n/g, "<br>");
    
    // 2. Format URLs
    content = content.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // 3. Format Mentions: @username
    // Use state.people to check if user exists
    content = content.replace(/@(\w+)/g, (match, username) => {
        const person = state.people[username.toLowerCase()];
        if (person) {
            return `<span class="message-mention" onclick="window.showProfileSummary('${person.id}')">@${escapeHtml(person.id)}</span>`;
        }
        return match;
    });
    
    return content;
}

// Typing Indicator broadcasting
let typingTimeout = null;
async function broadcastTyping(isTyping) {
    const activeChat = getActiveChat();
    if (!activeChat || !state.currentUser || !state.typingChannel) return;

    await state.typingChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { 
            senderId: state.currentUser.id, 
            senderName: state.currentUser.name,
            isTyping 
        }
    });

    if (isTyping) {
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => broadcastTyping(false), 3000);
    }
}

function handleComposerKeydown(event) {
    if (state.mentionQuery !== null && state.mentionPeople.length > 0) {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            state.mentionIndex = (state.mentionIndex + 1) % state.mentionPeople.length;
            renderMentionDropdown();
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            state.mentionIndex = (state.mentionIndex - 1 + state.mentionPeople.length) % state.mentionPeople.length;
            renderMentionDropdown();
            return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            insertMention(state.mentionPeople[state.mentionIndex].id);
            return;
        }
        if (event.key === "Escape") {
            state.mentionQuery = null;
            renderMentionDropdown();
            return;
        }
    }

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

    const insideMentions = event.target.closest("#mentionDropdown") || event.target.closest("#messageInput");
    if (!insideMentions && state.mentionQuery !== null) {
        state.mentionQuery = null;
        renderMentionDropdown();
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

function renderRequestsView() {
    elements.requestsStage.innerHTML = `
        <div class="message-stream">
            <div class="stream-inner" style="padding: 20px;">
                ${state.requests.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-state-icon">💌</div>
                        <h3>No pending requests</h3>
                        <p>When someone invites you to chat, it will appear here.</p>
                    </div>
                ` : `
                    <div class="requests-list">
                        ${state.requests.map(req => {
                            const user = state.people[req.from_user] || { name: req.from_user, initials: '?' };
                            return `
                                <div class="request-item">
                                    ${renderPersonAvatar(user, "avatar-token", false)}
                                    <div class="request-info">
                                        <strong>${escapeHtml(user.name)}</strong>
                                        <p>wants to start a conversation</p>
                                    </div>
                                    <div class="request-actions">
                                        <button class="request-btn accept" onclick="window.handleFriendRequestAction('${req.id}', 'accept')">Accept</button>
                                        <button class="request-btn decline" onclick="window.handleFriendRequestAction('${req.id}', 'decline')">Decline</button>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>
                `}
            </div>
        </div>
    `;
}

async function ensurePersonInDB(name) {
    const { data, error } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .or(`username.eq.${name},display_name.eq.${name}`)
        .maybeSingle();

    if (error || !data) {
        console.warn(`[Pulse] Person not found: ${name}`);
        if (window.showTopNotification) {
            window.showTopNotification(`User "${name}" not found. You can send them a friend request!`, 'info');
        }
        return null;
    }

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
    // Disable send when: no text typed, or no active chat selected.
    // NOTE: Global Chat IS a valid active chat (id = 'global_chat'), so
    // we do NOT gate on state.nav — that would permanently block Global Chat
    // which uses nav='global' but still has a valid activeChatId.
    elements.sendButton.disabled = length === 0 || !state.activeChatId;
}

function autoResizeComposer() {
    elements.messageInput.style.height = "auto";
    elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 140)}px`;
}

async function sendGif(gifUrl) {
    const activeChat = getActiveChat();
    if (!activeChat) return;

    let receiver;
    if (activeChat.type === 'global') {
        receiver = 'global_chat';
    } else if (activeChat.type === 'group') {
        receiver = activeChat.id;
    } else {
        receiver = activeChat.participantIds.find(id => id !== state.currentUser.id);
    }

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

    const payload = {
        sender: state.currentUser.id,
        receiver,
        content: '[GIF]',
        gif_url: gifUrl,
        channel_type: activeChat.type
    };

    const performInsert = async (p) => {
        return await window.supabaseClient.from('messages').insert([p]).select().single();
    };

    let { data, error } = await performInsert(payload);

    // Resilience: Retry without optional columns if they don't exist in DB
    if (error && (error.message.includes('gif_url') || error.message.includes('channel_type'))) {
        const fallbackPayload = { ...payload };
        if (error.message.includes('gif_url')) delete fallbackPayload.gif_url;
        if (error.message.includes('channel_type')) delete fallbackPayload.channel_type;
        const retry = await performInsert(fallbackPayload);
        data = retry.data;
        error = retry.error;
    }

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

    if (state.editingMessage) {
        await updateMessage(activeChat.id, state.editingMessage.id, text);
        cancelEdit();
        return;
    }

    let receiver;
    if (activeChat.type === 'global') {
        receiver = 'global_chat';
    } else if (activeChat.type === 'group') {
        receiver = activeChat.id;
    } else {
        receiver = activeChat.participantIds.find(id => id !== state.currentUser.id);
    }

    // Link Preview Logic (Simple Regex)
    let linkPreview = null;
    const urlMatch = text.match(/https?:\/\/[^\s<]+/);
    if (urlMatch) {
         linkPreview = {
             url: urlMatch[0],
             title: "Link Preview",
             desc: "Click to visit this resource on the web.",
             image: null
         };
    }

    // Optimistic UI: show message immediately before DB confirms
    const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newMessage = {
        id: optimisticId,
        senderId: state.currentUser.id,
        text,
        timestamp: Date.now(),
        reactions: [],
        pending: true,
        reply_to: state.replyingTo ? state.replyingTo.id : null,
        is_edited: false,
        link_preview: linkPreview
    };

    if (!state.messages[activeChat.id]) state.messages[activeChat.id] = [];
    state.messages[activeChat.id].push(newMessage);

    // Update chat lastTimestamp so it floats to top
    const chat = getChatById(activeChat.id);
    if (chat) chat.lastTimestamp = Date.now();

    elements.messageInput.value = '';
    cancelReply();
    autoResizeComposer();
    updateComposerMetrics();
    renderApp();
    scrollToLatest(true);

    const payload = {
        sender: state.currentUser.id,
        receiver,
        content: text,
        channel_type: activeChat.type,
        reply_to: newMessage.reply_to,
        link_preview: newMessage.link_preview
    };

    const performInsert = async (p) => {
        return await window.supabaseClient.from('messages').insert([p]).select().single();
    };

    let { data, error } = await performInsert(payload);

    if (error && error.message.includes('channel_type')) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.channel_type;
        const retry = await performInsert(fallbackPayload);
        data = retry.data;
        error = retry.error;
    }

    if (error) {
        console.error('Message send failed:', error);
        state.messages[activeChat.id] = state.messages[activeChat.id].filter(m => m.id !== optimisticId);
        renderApp();
        if (window.showTopNotification) window.showTopNotification('Failed to send message. Try again.', 'error');
        return;
    }

    // Replace optimistic placeholder with the confirmed DB message
    const confirmed = {
        id: String(data.id),
        senderId: data.sender,
        text: data.content,
        gifUrl: data.gif_url || null,
        timestamp: new Date(data.created_at).getTime(),
        reactions: [],
        reply_to: data.reply_to,
        is_edited: data.is_edited,
        link_preview: data.link_preview
    };
    state.messages[activeChat.id] = state.messages[activeChat.id].filter(m => m.id !== optimisticId);
    if (!state.messages[activeChat.id].some(m => m.id === confirmed.id)) {
        state.messages[activeChat.id].push(confirmed);
    }
    if (chat) chat.lastTimestamp = confirmed.timestamp;
    renderApp();
    scrollToLatest(false);
}

async function updateMessage(chatId, messageId, newText) {
    const { error } = await window.supabaseClient
        .from('messages')
        .update({ content: newText, is_edited: true, updated_at: new Date().toISOString() })
        .eq('id', messageId);
        
    if (!error) {
        const msg = state.messages[chatId].find(m => String(m.id) === String(messageId));
        if (msg) {
            msg.text = newText;
            msg.is_edited = true;
            renderWorkspace();
        }
    }
}

async function togglePinMessage(chatId, messageId) {
    const msg = state.messages[chatId].find(m => String(m.id) === String(messageId));
    if (!msg) return;
    
    const newPin = !msg.isPinned;
    const { error } = await window.supabaseClient
        .from('messages')
        .update({ is_pinned: newPin })
        .eq('id', messageId);
        
    if (!error) {
        msg.isPinned = newPin;
        renderWorkspace();
    }
}

function setReply(chatId, messageId) {
    const msg = state.messages[chatId].find(m => String(m.id) === String(messageId));
    if (!msg) return;
    state.replyingTo = msg;
    state.editingMessage = null;
    
    elements.replyToName.innerText = state.people[msg.senderId]?.name || msg.senderId;
    elements.replyToText.innerText = msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : '');
    elements.replyPreview.classList.remove("hidden");
    elements.editPreview.classList.add("hidden");
    elements.messageInput.focus();
}

function cancelReply() {
    state.replyingTo = null;
    elements.replyPreview.classList.add("hidden");
}

function setEdit(chatId, messageId) {
    const msg = state.messages[chatId].find(m => String(m.id) === String(messageId));
    if (!msg) return;
    state.editingMessage = msg;
    state.replyingTo = null;
    
    elements.messageInput.value = msg.text;
    elements.editPreview.classList.remove("hidden");
    elements.replyPreview.classList.add("hidden");
    elements.messageInput.focus();
    autoResizeComposer();
}

function cancelEdit() {
    state.editingMessage = null;
    elements.messageInput.value = "";
    elements.editPreview.classList.add("hidden");
    autoResizeComposer();
}

function scrollToMessage(messageId) {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight-pulse');
        setTimeout(() => el.classList.remove('highlight-pulse'), 2000);
    }
}

window.showLightbox = (url) => {
    // Basic lightbox implementation
    const lb = document.createElement('div');
    lb.className = 'modal-backdrop';
    lb.style.zIndex = '1000';
    lb.onclick = () => lb.remove();
    lb.innerHTML = `<img src="${url}" style="max-width:90vw; max-height:90vh; border-radius:24px; box-shadow:var(--shadow-lg);">`;
    document.body.appendChild(lb);
};

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

async function toggleReaction(chatId, messageId, emoji) {
    // Only allow reacting to real messages
    if (String(messageId).startsWith('opt-')) return;

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
    
    // Optimistic local update
    message.reactions = reactions;
    state.reactionMenu = null;
    renderWorkspace();

    // Sync to DB
    const { error } = await window.supabaseClient
        .from('messages')
        .update({ reactions: reactions })
        .eq('id', messageId);

    if (error) {
        console.error('[Pulse] Reaction sync failed:', error);
        // Rollback? Optional for reactions
    }
}

function selectChat(chatId) {
    state.nav = "home";
    state.activeChatId = chatId;
    state.searchQuery = ""; // Reset search content
    state.searchActive = false;
    elements.workspaceSearchField.classList.add("hidden");
    elements.openSearchButton.classList.remove("hidden");
    
    state.chatFilter = "all";
    state.membersOpen = false;
    state.emojiOpen = false;
    state.settingsOpen = false;
    state.reactionMenu = null;
    cancelReply();
    cancelEdit();
    closeDrawers();

    const chat = getChatById(chatId);
    if (chat) chat.unread = 0;

    persistState();
    renderApp();
    scrollToLatest(false);
    
    // Mark as read in DB
    markChannelAsRead(chatId);
}

async function markChannelAsRead(chatId) {
    if (!state.currentUser) return;
    try {
        await window.supabaseClient
            .from('read_receipts')
            .upsert({ 
                user_name: state.currentUser.id, 
                channel_id: chatId, 
                last_read_at: new Date().toISOString() 
            }, { onConflict: 'user_name, channel_id' });
    } catch (e) {
        console.warn('[Pulse] Read receipt sync failed. Did you run feature_updates.sql?', e);
    }
    
    // Update typing subscriptions for the new channel
    updatePerChannelSubscriptions();
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
    let msgs = [...(state.messages[chatId] || [])].sort((left, right) => left.timestamp - right.timestamp);
    
    if (state.searchQuery) {
        msgs = msgs.filter(m => m.text && m.text.toLowerCase().includes(state.searchQuery));
    }
    
    return msgs;
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
    if (!chat || !chat.participantIds) return state.currentUser || { id: 'unknown', name: 'Unknown' };
    const selfId = state.currentUser?.id || '';
    return getChatParticipants(chat).find((person) => person.id !== selfId) || state.currentUser || { id: 'unknown', name: 'Unknown' };
}

function getChatTitle(chat) {
    // Global and group chats use their own name; direct chats use the peer's name
    if (chat.type === "group" || chat.type === "global") return chat.name;
    return getDirectPeer(chat).name;
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

function renderPersonAvatar(person, className = "avatar-token", withPresence = true) {
    if (!person) return "";
    const name = person.name || "User";
    const initials = person.initials || getInitials(name);
    const toneA = person.toneA || "#7b8cff";
    const toneB = person.toneB || "#64d9ff";
    
    const presenceHtml = withPresence ? `<span class="presence-dot ${escapeHtml(person.presence || 'offline')}"></span>` : "";
    
    return `
        <div class="${className} avatar-token" style="--avatar-a:${toneA}; --avatar-b:${toneB};">
            ${person.avatarUrl ? `<img src="${escapeHtml(person.avatarUrl)}" alt="${escapeHtml(name)}">` : `<span>${escapeHtml(initials)}</span>`}
            ${presenceHtml}
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


function renderAvatarContent(person, withPresence = true) {
    if (!person) return "";
    const name = person.name || "User";
    const initials = person.initials || getInitials(name);
    const toneA = person.toneA || "#7b8cff";
    const toneB = person.toneB || "#64d9ff";
    const presenceHtml = withPresence ? `<span class="presence-dot ${escapeHtml(person.presence || 'offline')}"></span>` : "";

    return `
        <div class="avatar-token" style="--avatar-a:${toneA}; --avatar-b:${toneB}; width:100%; height:100%; border-radius:16px;">
            ${person.avatarUrl ? `<img src="${escapeHtml(person.avatarUrl)}" alt="${escapeHtml(name)}">` : `<span>${escapeHtml(initials)}</span>`}
        </div>
        ${presenceHtml}
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
    // Show jump button in both 'home' and 'global' — Global Chat is a valid chat view
    const inChatView = state.nav === "home" || state.nav === "global";
    elements.jumpLatestButton.classList.toggle("hidden", hidden || !inChatView);
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
