document.addEventListener('DOMContentLoaded', function () {

    // There must be exactly one global User Chat drawer.
    // Remove accidental duplicate partials before binding any events.
    const duplicateDrawers = document.querySelectorAll('#taskChatDrawer');
    duplicateDrawers.forEach(function (element, index) {
        if (index > 0) element.remove();
    });

    const duplicateOverlays = document.querySelectorAll('#taskChatOverlay');
    duplicateOverlays.forEach(function (element, index) {
        if (index > 0) element.remove();
    });

    const overlay = document.getElementById('taskChatOverlay');
    const drawer = document.getElementById('taskChatDrawer');
    const userChatList = document.getElementById('userChatList');
    const messagesContainer = document.getElementById('taskChatMessages');
    const closeButton = document.getElementById('closeTaskChat');
    const startChatButton = document.getElementById('startTaskChat');
    const composer = document.getElementById('taskChatComposer');
    const input = document.getElementById('taskChatInput');
    const sendButton = document.getElementById('sendTaskChat');
    const chatTaskTitle = document.getElementById('chatTaskTitle');
    const chatTaskStatus = document.getElementById('chatTaskStatus');
    const globalBadge = document.getElementById('globalChatBadge');
    const taskPicker = document.getElementById('taskChatTaskPicker');
    const taskList = document.getElementById('taskChatTaskList');
    const selectedTaskBox = document.getElementById('taskChatSelectedTask');
    const selectedTaskTitle = document.getElementById('taskChatSelectedTaskTitle');
    const clearSelectedTaskButton = document.getElementById('clearTaskChatTask');

    // The drawer/overlay are global fixed UI. Keep them directly under <body>
    // so notification/modal containers can never clip, hide, or reposition them.
    if (overlay && overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
    }
    if (drawer && drawer.parentElement !== document.body) {
        document.body.appendChild(drawer);
    }

    let connection = null;
    let isConnected = false;
    let activeChatSessionId = null;
    let activeChatTaskId = null;
    let renderedMessageIds = new Set();
    let selectedNewTask = null;
    let taskPickerRequestId = 0;

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatTime(value) {
        if (!value) return '';
        try {
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return '';
            return d.toLocaleString();
        } catch (e) {
            return '';
        }
    }

    async function initConnection() {
        if (!window.signalR) return;

        try {
            connection = new signalR.HubConnectionBuilder()
                .withUrl('/chatHub')
                .withAutomaticReconnect()
                .build();

            connection.onreconnecting(err => console.warn('ChatHub reconnecting', err));

            connection.onreconnected(id => {
                console.info('ChatHub reconnected', id);
                // Re-join active chat group after reconnect
                if (activeChatSessionId) {
                    connection.invoke('JoinChat', Number(activeChatSessionId)).catch(() => { });
                }

                // Refresh list to ensure unread counts are correct
                loadChats().catch(() => { });
            });

            connection.onclose(err => {
                isConnected = false;
                console.warn('ChatHub closed', err);
            });

            connection.on('ReceiveMessage', function (payload) {
                handleIncomingMessage(payload).catch(err => console.error('ReceiveMessage error', err));
            });

            await connection.start();
            isConnected = true;
            console.info('ChatHub connected');

            // Initial load of conversation list
            await loadChats();
        }
        catch (err) {
            console.warn('SignalR init failed:', err);
        }
    }

    async function loadChats() {
        if (!userChatList) return;

        try {
            const res = await fetch('/User/MyTasks/GetUserChats');
            const json = await res.json();

            if (!json || !json.success) return;

            const sessions = json.data || [];

            userChatList.innerHTML = '';

            let totalUnread = 0;

            sessions.forEach(s => {
                totalUnread += s.unreadCount || 0;

                const item = document.createElement('div');
                item.className = 'task-chat-item';
                item.dataset.chatSessionId = s.chatSessionId;
                item.dataset.taskId = s.taskId;
                item.dataset.taskStatus = s.taskStatus || '';

                const title = escapeHtml(s.taskTitle || 'Task');
                const preview = escapeHtml(s.latestMessage || '');
                const time = formatTime(s.latestMessageAt);

                item.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <div class="task-chat-item-title">${title}</div>
                            <div class="task-chat-preview text-muted">${preview}</div>
                        </div>
                        <div class="text-end">
                            <small class="task-chat-time d-block">${time}</small>
                            ${s.unreadCount ? `<span class="chat-badge">${s.unreadCount}</span>` : ''}
                        </div>
                    </div>`;

                userChatList.appendChild(item);
            });

            updateGlobalBadge(totalUnread);
        }
        catch (err) {
            console.error('loadChats failed', err);
        }
    }

    function updateGlobalBadge(count) {
        if (!globalBadge) return;
        if (!count) {
            globalBadge.style.display = 'none';
            globalBadge.textContent = '';
        }
        else {
            globalBadge.style.display = '';
            globalBadge.textContent = String(count);
        }
    }

    function appendMessageElement(m) {
        if (!messagesContainer) return;

        const messageId = m.id || `${m.senderId}-${m.sentAt}`;

        if (renderedMessageIds.has(messageId)) return;

        renderedMessageIds.add(messageId);

        const isMe = window.CurrentUserId && m.senderId === window.CurrentUserId;

        const wrapper = document.createElement('div');
        wrapper.className = 'task-chat-message ' + (isMe ? 'me' : 'them');
        wrapper.dataset.messageId = messageId;

        const bubble = document.createElement('div');
        bubble.className = 'task-chat-bubble';
        bubble.innerHTML = escapeHtml(m.message || '');

        const time = document.createElement('div');
        time.className = 'task-chat-time';
        time.textContent = formatTime(m.sentAt);

        wrapper.appendChild(bubble);
        wrapper.appendChild(time);

        messagesContainer.appendChild(wrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function renderMessages(messages) {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = '';
        renderedMessageIds.clear();

        messages.forEach(m => appendMessageElement(m));

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function openConversation(chatSessionId, taskId, title, status) {
        if (!chatSessionId) return;

        activeChatSessionId = chatSessionId;
        activeChatTaskId = taskId;

        if (chatTaskTitle) chatTaskTitle.textContent = title || 'Conversation';
        if (chatTaskStatus) chatTaskStatus.textContent = status || '—';

        if (drawer && overlay) {
            drawer.classList.add('active');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        if (messagesContainer) {
            messagesContainer.innerHTML = '<div class="task-chat-empty text-center text-muted p-3">Loading messages...</div>';
        }

        // Join SignalR group for real-time updates
        if (isConnected && connection) {
            try {
                await connection.invoke('JoinChat', Number(chatSessionId));
            }
            catch (err) {
                console.warn('JoinChat failed:', err);
            }
        }

        // Load chat history from server
        try {
            const res = await fetch(`/User/MyTasks/GetChat?chatSessionId=${encodeURIComponent(chatSessionId)}`);
            const json = await res.json();

            if (!json || !json.success) {
                if (messagesContainer) messagesContainer.innerHTML = '<div class="text-center text-danger">Unable to load chat.</div>';
                return;
            }

            const chat = json.data || {};

            renderMessages(chat.messages || []);

            // Mark admin->user messages as read on open
            await markChatRead(chatSessionId);

            // Show composer
            if (composer) composer.style.display = '';
            if (input) input.value = '';
            if (sendButton) sendButton.disabled = true;
        }
        catch (err) {
            console.error('openConversation failed', err);
        }
    }

    async function markChatRead(chatSessionId) {
        try {
            const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value
    || document.querySelector('#userChatAntiForgeryForm input[name="__RequestVerificationToken"]')?.value
    || '';

            const res = await fetch('/User/MyTasks/MarkChatRead', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                body: new URLSearchParams({ chatSessionId: chatSessionId, __RequestVerificationToken: token })
            });

            const json = await res.json();

            if (json && json.success) {
                // remove unread badge from list item
                const item = userChatList?.querySelector(`[data-chat-session-id="${chatSessionId}"]`);
                if (item) {
                    const badge = item.querySelector('.chat-badge');
                    if (badge) badge.remove();
                }

                // refresh list to update global unread total
                await loadChats();
            }
        }
        catch (err) {
            console.warn('MarkChatRead failed', err);
        }
    }

    async function handleIncomingMessage(payload) {
        if (!payload) return;

        try {
            const chatId = String(payload.chatSessionId ?? payload.ChatSessionId ?? '');
            const msgId = payload.id ?? payload.Id ?? `${payload.senderId}-${payload.sentAt}`;
            const senderId = payload.senderId ?? payload.SenderId ?? '';
            const message = payload.message ?? payload.Message ?? '';
            const sentAt = payload.sentAt ?? payload.SentAt ?? null;

            // update list preview/time
            const item = userChatList?.querySelector(`[data-chat-session-id="${chatId}"]`);
            if (item) {
                const preview = item.querySelector('.task-chat-preview');
                if (preview) preview.textContent = message;

                const time = item.querySelector('.task-chat-time');
                if (time) time.textContent = formatTime(sentAt);
            }
            else {
                // unknown conversation -> refresh list
                await loadChats();
            }

            if (activeChatSessionId && String(activeChatSessionId) === String(chatId)) {
                appendMessageElement({ id: msgId, senderId: senderId, message: message, sentAt: sentAt });

                // If admin sent the message, mark it as read
                await markChatRead(chatId);

                return;
            }

            // increase unread badge
            if (item) {
                let badge = item.querySelector('.chat-badge');
                if (badge) {
                    const val = parseInt(badge.textContent || '0', 10) || 0;
                    badge.textContent = String(val + 1);
                }
                else {
                    const container = item.querySelector('.text-end') || item;
                    const newBadge = document.createElement('span');
                    newBadge.className = 'chat-badge';
                    newBadge.textContent = '1';
                    container.appendChild(newBadge);
                }
            }

            // update global unread
            const currentGlobal = parseInt(globalBadge?.textContent || '0', 10) || 0;
            updateGlobalBadge(currentGlobal + 1);

            // show in-app toast when drawer is closed
            if (!drawer.classList.contains('active')) {
                showToast(message, chatId);
            }

        }
        catch (err) {
            console.error('handleIncomingMessage error', err);
        }
    }

    function showToast(message, chatId) {
        try {
            const id = 'chat-toast-' + Date.now();
            const el = document.createElement('div');
            el.id = id;
            el.className = 'chat-toast';
            el.textContent = message;
            el.style.position = 'fixed';
            el.style.bottom = '20px';
            el.style.right = '20px';
            el.style.background = '#2d3748';
            el.style.color = '#fff';
            el.style.padding = '10px 14px';
            el.style.borderRadius = '6px';
            el.style.cursor = 'pointer';
            el.style.zIndex = '9999';

            el.addEventListener('click', function () {
                // open conversation
                openConversation(chatId).catch(() => { });
                el.remove();
            });

            document.body.appendChild(el);

            setTimeout(function () { el.remove(); }, 10000);
        }
        catch (err) { }
    }

    function closeTaskPicker() {
        if (taskPicker) taskPicker.hidden = true;
        if (taskList) taskList.innerHTML = '';
    }

    function setSelectedNewTask(task) {
        selectedNewTask = task || null;

        if (selectedTaskBox && selectedTaskTitle) {
            if (selectedNewTask) {
                selectedTaskTitle.textContent = selectedNewTask.title || 'Task';
                selectedTaskBox.hidden = false;
            } else {
                selectedTaskTitle.textContent = '';
                selectedTaskBox.hidden = true;
            }
        }

        if (startChatButton) {
            startChatButton.disabled = !selectedNewTask;
            startChatButton.innerHTML = '<span>✦</span> Start Chat';
        }
    }

    async function loadAvailableChatTasks(search) {
        if (!taskList || !taskPicker) return;

        const requestId = ++taskPickerRequestId;
        const query = String(search || '').trim();

        taskList.innerHTML = '<div class="task-chat-task-empty">Searching tasks...</div>';
        taskPicker.hidden = false;

        try {
            const res = await fetch('/User/MyTasks/GetAvailableChatTasks?search=' + encodeURIComponent(query));
            const json = await res.json();

            if (requestId !== taskPickerRequestId) return;

            if (!json || !json.success) {
                taskList.innerHTML = '<div class="task-chat-task-empty">Unable to load tasks.</div>';
                return;
            }

            const tasks = json.data || [];

            if (!tasks.length) {
                taskList.innerHTML = '<div class="task-chat-task-empty">No tasks available for a new chat.</div>';
                return;
            }

            taskList.innerHTML = '';

            tasks.forEach(task => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'task-chat-task-option';
                button.dataset.taskId = task.taskId;
                button.innerHTML =
                    '<span class="task-chat-task-option-title">' + escapeHtml(task.title || 'Task') + '</span>' +
                    '<span class="task-chat-task-option-meta">TASK-' + escapeHtml(task.taskId) +
                    ' · ' + escapeHtml(task.status || 'Pending') + '</span>';

                button.addEventListener('click', function () {
                    setSelectedNewTask(task);
                    closeTaskPicker();

                    if (input) {
                        input.value = '';
                        input.placeholder = 'Type your message...';
                        input.focus();
                    }
                });

                taskList.appendChild(button);
            });
        }
        catch (err) {
            if (requestId !== taskPickerRequestId) return;
            console.error('loadAvailableChatTasks failed', err);
            taskList.innerHTML = '<div class="task-chat-task-empty">Unable to load tasks.</div>';
        }
    }

    async function startChatForTask(taskId) {
        if (!taskId) return;

        activeChatTaskId = taskId;

        if (startChatButton) {
            startChatButton.disabled = true;
            startChatButton.innerHTML = 'Starting...';
        }

        try {
            const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value
    || document.querySelector('#userChatAntiForgeryForm input[name="__RequestVerificationToken"]')?.value
    || '';

            const res = await fetch('/User/MyTasks/StartChat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: new URLSearchParams({ taskId: taskId, __RequestVerificationToken: token })
            });

            const json = await res.json();

            if (!json || !json.success) throw new Error(json?.message || 'Unable to start chat.');

            activeChatSessionId = json.chatSessionId;

            if (startChatButton) startChatButton.style.display = 'none';

            await openConversation(activeChatSessionId, activeChatTaskId, chatTaskTitle?.textContent, chatTaskStatus?.textContent);
        }
        catch (err) {
            console.error('startChat failed', err);
            if (startChatButton) {
                startChatButton.disabled = false;
                startChatButton.innerHTML = '<span>✦</span> Start Chat';
            }
        }
    }

    async function sendMessage() {
        if (!activeChatSessionId) return;
        const text = input?.value?.trim();
        if (!text) return;

        if (sendButton) sendButton.disabled = true;

        try {
            if (isConnected && connection) {
                await connection.invoke('SendMessage', Number(activeChatSessionId), text);
            } else {
                console.warn('No SignalR connection available to send message');
            }

            if (input) input.value = '';
            if (sendButton) sendButton.disabled = false;
        }
        catch (err) {
            console.error('sendMessage failed', err);
            if (sendButton) sendButton.disabled = false;
        }
    }

    function closeDrawer() {
        if (drawer) drawer.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        activeChatSessionId = null;
        activeChatTaskId = null;
    }

    // UI wiring
    if (userChatList) {
        userChatList.addEventListener('click', function (ev) {
            const item = ev.target.closest('[data-chat-session-id]');
            if (!item) return;
            const chatId = item.dataset.chatSessionId;
            const taskId = item.dataset.taskId;
            const title = item.querySelector('.task-chat-item-title')?.textContent || '';
            const status = item.dataset.taskStatus || '';
            openConversation(chatId, taskId, title, status).catch(() => { });
        });
    }

    if (closeButton) closeButton.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);

    if (input) {
        input.addEventListener('input', function () {
            const value = input.value;
            const atIndex = value.lastIndexOf('@');

            // In a new-chat state, typing @ opens the eligible task picker.
            if (!activeChatSessionId && atIndex >= 0 && !selectedNewTask) {
                const query = value.slice(atIndex + 1);

                if (!query.includes(' ')) {
                    loadAvailableChatTasks(query).catch(() => { });
                } else {
                    closeTaskPicker();
                }
            } else if (!activeChatSessionId) {
                closeTaskPicker();
            }

            if (sendButton) sendButton.disabled = !activeChatSessionId || !value.trim();
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                closeTaskPicker();
                return;
            }

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();

                if (!activeChatSessionId && selectedNewTask && startChatButton && !startChatButton.disabled) {
                    startChatButton.click();
                    return;
                }

                if (sendButton && !sendButton.disabled) sendButton.click();
            }
        });
    }

    if (clearSelectedTaskButton) {
        clearSelectedTaskButton.addEventListener('click', function () {
            setSelectedNewTask(null);
            if (input) {
                input.value = '@';
                input.placeholder = 'Type @ to choose a task...';
                input.focus();
                loadAvailableChatTasks('').catch(() => { });
            }
        });
    }

    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (startChatButton) startChatButton.addEventListener('click', function () {
        const taskId = activeChatTaskId || selectedNewTask?.taskId;
        if (!taskId) return;
        startChatForTask(taskId).catch(() => { });
    });

    // Expose a simple API for other scripts (like my-tasks.js)
    window.UserChat = window.UserChat || {};
    window.UserChat.openForTask = function (opts) {
        // opts: { taskId, title, status, taskCard }
        try {
            const taskId = opts?.taskId || (opts?.taskCard && opts.taskCard.dataset.taskId);
            const title = opts?.title || (opts?.taskCard && opts.taskCard.dataset.title);
            const status = opts?.status || (opts?.taskCard && opts.taskCard.dataset.status);

            // set header
            if (chatTaskTitle) chatTaskTitle.textContent = title || 'Task Support';
            if (chatTaskStatus) chatTaskStatus.textContent = status || '—';

            // show drawer
            if (drawer && overlay) {
                drawer.classList.add('active');
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }

            // Switching from another task must immediately clear the previous
            // conversation from the main pane. The selected task owns the pane.
            const previousSessionId = activeChatSessionId;
            activeChatTaskId = taskId;
            activeChatSessionId = null;

            if (previousSessionId && isConnected && connection) {
                connection.invoke('LeaveChat', Number(previousSessionId)).catch(() => { });
            }

            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }

            if (composer) {
                composer.style.display = 'none';
            }

            if (input) {
                input.value = '';
            }

            if (sendButton) {
                sendButton.disabled = true;
            }

            if (startChatButton) {
                startChatButton.style.display = '';
                startChatButton.disabled = true;
                startChatButton.innerHTML = '<span>✦</span> Checking chat...';

                if (messagesContainer) {
                    messagesContainer.appendChild(startChatButton);
                }
            }

            // Check for an existing active session for THIS task only.
            (async function () {
                try {
                    const res = await fetch(`/User/MyTasks/CheckActiveSession?taskId=${encodeURIComponent(taskId)}`);
                    const json = await res.json();

                    // Ignore a stale response if the user already selected another task.
                    if (activeChatTaskId !== taskId) return;

                    if (json && json.success && json.exists && json.chatSessionId) {
                        activeChatSessionId = json.chatSessionId;
                        if (startChatButton) startChatButton.style.display = 'none';

                        await openConversation(activeChatSessionId, taskId, title, status);
                        return;
                    }

                    // No active session for this task: show a clean Start Chat state.
                    activeChatSessionId = null;

                    if (messagesContainer) {
                        messagesContainer.innerHTML = '';
                    }

                    if (startChatButton) {
                        startChatButton.style.display = '';
                        startChatButton.disabled = false;
                        startChatButton.innerHTML = '<span>✦</span> Start Chat';

                        if (messagesContainer) {
                            messagesContainer.appendChild(startChatButton);
                        }
                    }
                }
                catch (err) {
                    if (activeChatTaskId !== taskId) return;

                    console.error('CheckActiveSession failed:', err);

                    if (messagesContainer) {
                        messagesContainer.innerHTML = '<div class="task-chat-empty text-center text-muted p-3">Unable to check this task chat.</div>';
                    }
                }
            })();

        } catch (err) {
            console.error('UserChat.openForTask error', err);
        }
    };

    // Start connection
    initConnection();

    // Topbar chat button opens the global user chat drawer.
    // A new global chat must choose a task explicitly via @ before it can start.
    try {
        const topbarChat = document.getElementById('chatButton');
        if (topbarChat) {
            topbarChat.addEventListener('click', async function () {
                try {
                    activeChatSessionId = null;
                    activeChatTaskId = null;
                    setSelectedNewTask(null);
                    closeTaskPicker();

                    if (chatTaskTitle) chatTaskTitle.textContent = 'Select a task';
                    if (chatTaskStatus) chatTaskStatus.textContent = 'New chat';

                    if (messagesContainer) {
                        messagesContainer.innerHTML = '<div class="task-chat-empty"><div class="task-chat-empty-icon">💬</div><h4>Start a new task chat</h4><p>Type <strong>@</strong> in the message box and choose one of your tasks.</p></div>';
                    }

                    if (composer) composer.style.display = '';
                    if (input) {
                        input.value = '';
                        input.placeholder = 'Type @ to choose a task...';
                    }
                    if (sendButton) sendButton.disabled = true;
                    if (startChatButton) {
                        startChatButton.style.display = '';
                        startChatButton.disabled = true;
                        startChatButton.innerHTML = '<span>✦</span> Start Chat';
                    }

                    await loadChats();

                    if (drawer && overlay) {
                        drawer.classList.add('active');
                        overlay.classList.add('active');
                        document.body.style.overflow = 'hidden';
                    }
                }
                catch (err) {
                    console.warn('Opening user chat failed', err);
                }
            });
        }
    }
    catch (err) { }

});
