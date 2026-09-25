document.addEventListener('DOMContentLoaded', function () {

    const adminChatList = document.getElementById('adminChatList');
    const adminChatDrawer = document.getElementById('adminChatDrawer');
    const adminChatMessages = document.getElementById('adminChatMessages');
    const adminChatInput = document.getElementById('adminChatInput');
    const adminSendChat = document.getElementById('adminSendChat');
    const closeAdminChat = document.getElementById('closeAdminChat');

    let currentChatSessionId = null;
    let currentChatUserId = null;
    let isSending = false;
    let connection = null;

    // Initialize SignalR connection if available
    if (window.signalR) {
        try {
            connection = new signalR.HubConnectionBuilder()
                .withUrl('/chatHub')
                .withAutomaticReconnect()
                .build();

            connection.on('ReceiveMessage', function (payload) {
                try {
                    if (!payload) return;

                    const chatId = String(payload.chatSessionId ?? payload.ChatSessionId ?? '');
                    const senderId = payload.senderId ?? payload.SenderId ?? '';
                    const message = payload.message ?? payload.Message ?? '';
                    const sentAt = payload.sentAt ?? payload.SentAt ?? null;

                    // Update list preview/time
                    const item = adminChatList?.querySelector(`[data-chat-session-id="${chatId}"]`);
                    if (item) {
                        const preview = item.querySelector('.admin-chat-preview');
                        if (preview) preview.textContent = message;

                        const time = item.querySelector('.admin-chat-time');
                        if (time) {
                            try { time.textContent = sentAt ? new Date(sentAt).toLocaleString() : new Date().toLocaleString(); } catch (e) { }
                        }
                    }

                    // If currently open, append to messages
                    if (currentChatSessionId && String(currentChatSessionId) === chatId) {
                        const mObj = { SenderId: senderId, Message: message, SentAt: sentAt };
                        const el = buildMessageElement(mObj, currentChatUserId);
                        if (adminChatMessages) {
                            adminChatMessages.appendChild(el);
                            scrollToBottom();
                        }
                    } else {
                        // increase unread badge
                        if (item) {
                            const badge = item.querySelector('.admin-chat-badge');
                            if (badge) {
                                const val = parseInt(badge.textContent || '0', 10) || 0;
                                badge.textContent = String(val + 1);
                            } else {
                                const container = item.querySelector('.d-flex.justify-content-between.align-items-center.mt-2') || item;
                                const newBadge = document.createElement('span');
                                newBadge.className = 'badge bg-danger admin-chat-badge';
                                newBadge.textContent = '1';
                                container.appendChild(newBadge);
                            }
                        }
                    }

                } catch (err) {
                    console.error('ReceiveMessage handler error:', err);
                }
            });

            connection.start().then(function () {
                console.info('ChatHub connected');
            }).catch(function (err) {
                console.warn('ChatHub connection failed:', err);
            });

        } catch (err) {
            console.warn('SignalR init failed:', err);
        }
    }

    // Delegated click for chat list
    if (adminChatList) {
        adminChatList.addEventListener('click', function (e) {
            const item = e.target.closest('.admin-chat-item');
            if (!item) return;

            openChat(item);
        });
    }

    if (closeAdminChat) {
        closeAdminChat.addEventListener('click', closeDrawer);
    }

    if (adminChatInput) {
        adminChatInput.addEventListener('input', function () {
            if (adminSendChat)
                adminSendChat.disabled = !adminChatInput.value.trim() || !currentChatSessionId;
        });

        adminChatInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (adminSendChat && !adminSendChat.disabled) adminSendChat.click();
            }
        });
    }

    if (adminSendChat) {
        adminSendChat.addEventListener('click', sendMessage);
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && adminChatDrawer && adminChatDrawer.classList.contains('open')) {
            closeDrawer();
        }
    });

    async function openChat(item) {
        const chatSessionId = item.dataset.chatSessionId;
        if (!chatSessionId) return;

        currentChatSessionId = chatSessionId;

        // active visual
        const prev = adminChatList.querySelector('.admin-chat-item.active');
        if (prev) prev.classList.remove('active');
        item.classList.add('active');

        // header
        const userName = item.querySelector('.admin-chat-username')?.textContent?.trim() || 'User';
        const subtitle = item.querySelector('.admin-chat-task')?.textContent?.trim() || '';
        const drawerUserName = document.getElementById('drawerUserName');
        const drawerContext = document.getElementById('drawerContext');
        if (drawerUserName) drawerUserName.textContent = userName;
        if (drawerContext) drawerContext.textContent = subtitle;

        // open drawer
        if (adminChatDrawer) {
            adminChatDrawer.classList.add('open');
            adminChatDrawer.setAttribute('aria-hidden', 'false');
        }

        if (adminChatMessages) adminChatMessages.innerHTML = '<div class="text-center text-muted">Loading messages...</div>';
        if (adminChatInput) adminChatInput.value = '';
        if (adminSendChat) adminSendChat.disabled = true;

        // join SignalR group if available
        try {
            if (connection) {
                await connection.invoke('JoinChat', Number(chatSessionId));
            }
        } catch (err) {
            console.warn('JoinChat failed:', err);
        }

        loadChatHistory(chatSessionId);
    }

    async function closeDrawer() {
        if (adminChatDrawer) {
            adminChatDrawer.classList.remove('open');
            adminChatDrawer.setAttribute('aria-hidden', 'true');
        }

        // leave SignalR group for current session
        const leavingSession = currentChatSessionId;

        if (adminChatMessages) adminChatMessages.innerHTML = '<div class="text-center text-muted">Open a chat to view messages.</div>';
        if (adminChatInput) adminChatInput.value = '';
        if (adminSendChat) adminSendChat.disabled = true;

        try {
            if (connection && leavingSession) {
                await connection.invoke('LeaveChat', Number(leavingSession));
            }
        } catch (err) {
            console.warn('LeaveChat failed:', err);
        }

        currentChatSessionId = null;
        currentChatUserId = null;
    }

    async function loadChatHistory(chatSessionId) {
        try {
            const resp = await fetch(`/Admin/Chat/GetChat?chatSessionId=${encodeURIComponent(chatSessionId)}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'same-origin'
            });

            if (!resp.ok) {
                if (adminChatMessages) adminChatMessages.innerHTML = `<div class="text-danger">Failed to load chat (${resp.status}).</div>`;
                return;
            }

            const data = await resp.json();

            // flexible property access (camelCase or PascalCase)
            const user = data.user ?? data.User ?? null;
            const task = data.task ?? data.Task ?? null;
            const messages = data.messages ?? data.Messages ?? [];

            currentChatUserId = user?.id ?? user?.Id ?? null;

            // update context with task info if present
            if (task) {
                const title = task.title ?? task.Title ?? '';
                const status = task.status ?? task.Status ?? '';
                const ctx = `${title} · ${status}`;
                const drawerContext = document.getElementById('drawerContext');
                if (drawerContext) drawerContext.textContent = ctx;
            }

            if (!adminChatMessages) return;

            adminChatMessages.innerHTML = '';

            if (!messages || messages.length === 0) {
                adminChatMessages.innerHTML = '<div class="text-center text-muted">No messages yet.</div>';
            } else {
                messages.forEach(m => {
                    const el = buildMessageElement(m, currentChatUserId);
                    adminChatMessages.appendChild(el);
                });
            }

            scrollToBottom();

            if (adminSendChat) adminSendChat.disabled = false;

        } catch (err) {
            console.error('Error loading chat:', err);
            if (adminChatMessages) adminChatMessages.innerHTML = '<div class="text-danger">Error loading chat.</div>';
        }
    }

    function buildMessageElement(m, chatUserId) {
        const senderId = m.senderId ?? m.SenderId ?? '';
        const messageText = m.message ?? m.Message ?? '';
        const sentAt = m.sentAt ?? m.SentAt ?? null;

        const isUser = senderId && chatUserId && senderId === chatUserId;

        const row = document.createElement('div');
        row.className = 'message-row ' + (isUser ? 'user' : 'admin');

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble ' + (isUser ? 'user' : 'admin');

        const date = sentAt ? new Date(sentAt) : new Date();
        const taskStartMatch = messageText.match(/^New chat started for Task #(\\d+)\\s*$/m);

        if (taskStartMatch) {
            const parts = messageText.split(/\\n\\s*\\n/);
            const heading = parts.shift()?.trim() || taskStartMatch[0];
            const details = parts.join('\\n\\n').trim();

            bubble.classList.add('initial-task-message');

            const headingEl = document.createElement('div');
            headingEl.className = 'initial-task-title';
            headingEl.textContent = heading;
            bubble.appendChild(headingEl);

            if (details) {
                const detailBox = document.createElement('div');
                detailBox.className = 'initial-task-details';

                details.split('\\n').forEach(line => {
                    const clean = line.trim();
                    if (!clean) return;

                    const rowEl = document.createElement('div');
                    rowEl.className = 'initial-task-row';

                    const separator = clean.indexOf(':');
                    if (separator > 0) {
                        const labelEl = document.createElement('span');
                        labelEl.className = 'initial-task-label';
                        labelEl.textContent = clean.slice(0, separator).trim();

                        const valueEl = document.createElement('span');
                        valueEl.className = 'initial-task-value';
                        valueEl.textContent = clean.slice(separator + 1).trim();

                        rowEl.appendChild(labelEl);
                        rowEl.appendChild(valueEl);
                    } else {
                        rowEl.textContent = clean;
                    }

                    detailBox.appendChild(rowEl);
                });

                bubble.appendChild(detailBox);
            }
        } else {
            const safe = escapeHtml(messageText);
            bubble.innerHTML = `<div>${safe}</div>`;
        }

        const meta = document.createElement('div');
        meta.className = 'message-meta';
        meta.textContent = date.toLocaleString();
        bubble.appendChild(meta);

        row.appendChild(bubble);

        return row;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function scrollToBottom() {
        if (!adminChatMessages) return;
        adminChatMessages.scrollTop = adminChatMessages.scrollHeight;
    }

    async function sendMessage() {
        if (!currentChatSessionId) return;
        if (!adminChatInput) return;

        const text = adminChatInput.value.trim();
        if (!text) return;
        if (isSending) return;

        isSending = true;
        if (adminSendChat) adminSendChat.disabled = true;

        try {
            // Prefer SignalR when available
            if (connection) {
                try {
                    await connection.invoke('SendMessage', Number(currentChatSessionId), text);

                    // clear input; message will be appended via ReceiveMessage handler
                    adminChatInput.value = '';
                } catch (err) {
                    console.warn('SignalR send failed, falling back to HTTP POST', err);
                    await fallbackSend(text);
                }
            } else {
                await fallbackSend(text);
            }

        } catch (err) {
            console.error('Error sending message:', err);
            alert('Error sending message.');
        } finally {
            isSending = false;
            if (adminSendChat) adminSendChat.disabled = adminChatInput.value.trim() === '';
        }
    }

    async function fallbackSend(text) {
        const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || '';

        const payload = {
            chatSessionId: Number(currentChatSessionId),
            message: text
        };

        const resp = await fetch('/Admin/Chat/SendMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': token
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const txt = await resp.text();
            console.error('Send failed', resp.status, txt);
            alert('Failed to send message.');
            return;
        }

        // optimistic append when using HTTP
        const optimistic = { SenderId: 'ADMIN', Message: text, SentAt: new Date().toISOString() };
        const el = buildMessageElement(optimistic, currentChatUserId);
        if (adminChatMessages) {
            adminChatMessages.appendChild(el);
            scrollToBottom();
        }

        adminChatInput.value = '';
    }

});
