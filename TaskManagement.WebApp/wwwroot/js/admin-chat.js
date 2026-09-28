document.addEventListener('DOMContentLoaded', function () {

    const adminChatList = document.getElementById('adminChatList');
    const adminChatDrawer = document.getElementById('adminChatDrawer');
    const adminChatMessages = document.getElementById('adminChatMessages');
    const adminChatInput = document.getElementById('adminChatInput');
    const adminSendChat = document.getElementById('adminSendChat');
    const closeAdminChat = document.getElementById('closeAdminChat');

    const chatSearchInput = document.getElementById('chatSearchInput');
    const chatFilters = document.querySelectorAll('.chat-filter');

    let currentChatSessionId = null;
    let currentChatUserId = null;
    let isSending = false;
    let connection = null;
    let activeFilter = 'all';


    /* =========================================================
       INITIAL AVATARS
    ========================================================= */

    document.querySelectorAll('.admin-chat-item').forEach(function (item) {

        const name =
            item.querySelector('.admin-chat-username')?.textContent?.trim() || 'User';

        const avatar =
            item.querySelector('.chat-avatar-letter');

        if (avatar) {
            avatar.textContent =
                name.charAt(0).toUpperCase();
        }
    });


    /* =========================================================
       SIGNALR
       EXISTING BACKEND FLOW - UNCHANGED
    ========================================================= */

    if (window.signalR) {

        try {

            connection = new signalR.HubConnectionBuilder()
                .withUrl('/chatHub')
                .withAutomaticReconnect()
                .build();


            connection.on('ChatDeleted', function (payload) {

                const chatSessionId =
                    String(
                        payload?.chatSessionId ??
                        payload?.ChatSessionId ??
                        ''
                    );

                if (!chatSessionId || !adminChatList) {
                    return;
                }

                const item =
                    adminChatList.querySelector(
                        `[data-chat-session-id="${chatSessionId}"]`
                    );

                if (!item) {
                    return;
                }

                const deletingCurrent =
                    currentChatSessionId &&
                    String(currentChatSessionId) === chatSessionId;

                if (deletingCurrent) {
                    closeDrawer();
                }

                const group =
                    item.closest('.admin-chat-student-group');

                item.remove();

                if (group) {
                    const remaining =
                        group.querySelectorAll('.admin-chat-item');

                    if (remaining.length === 0) {
                        group.remove();
                    }
                    else {
                        const countElement =
                            group.querySelector(
                                '.student-header-content small'
                            );

                        if (countElement) {
                            countElement.textContent =
                                `${remaining.length} ${remaining.length === 1 ? 'conversation' : 'conversations'}`;
                        }
                    }
                }

                updateUnreadSummary();
                applyChatFilters();
            });


            connection.on('ReceiveMessage', async function (payload) {

                try {

                    if (!payload) {
                        return;
                    }

                    const chatId =
                        String(
                            payload.chatSessionId ??
                            payload.ChatSessionId ??
                            ''
                        );

                    const senderId =
                        payload.senderId ??
                        payload.SenderId ??
                        '';

                    const message =
                        payload.message ??
                        payload.Message ??
                        '';

                    const sentAt =
                        payload.sentAt ??
                        payload.SentAt ??
                        null;


                    /* Update chat preview */

                    const item =
                        adminChatList?.querySelector(
                            `[data-chat-session-id="${chatId}"]`
                        );


                    if (item) {

                        const preview =
                            item.querySelector('.admin-chat-preview');

                        if (preview) {
                            preview.textContent = message;
                        }


                        const time =
                            item.querySelector('.admin-chat-time');

                        if (time) {

                            try {

                                time.textContent =
                                    sentAt
                                        ? new Date(sentAt).toLocaleString()
                                        : new Date().toLocaleString();

                            } catch (e) {
                                // Ignore date formatting errors.
                            }
                        }
                    }


                    /* Append message if current chat */

                    if (
                        currentChatSessionId &&
                        String(currentChatSessionId) === chatId
                    ) {

                        const messageObject = {
                            SenderId: senderId,
                            Message: message,
                            SentAt: sentAt
                        };

                        const element =
                            buildMessageElement(
                                messageObject,
                                currentChatUserId
                            );

                        if (adminChatMessages) {

                            adminChatMessages.appendChild(element);

                            scrollToBottom();
                        }

                        // The currently open chat is read immediately.
                        const activeItem =
                            adminChatList?.querySelector(
                                `[data-chat-session-id="${chatId}"]`
                            );

                        await markChatRead(chatId, activeItem);

                    } else {

                        /* Increase unread badge */

                        if (item) {
                            const currentUnread =
                                parseInt(
                                    item.dataset.unread || '0',
                                    10
                                ) || 0;

                            setChatUnread(
                                item,
                                currentUnread + 1
                            );
                        }
                    }

                } catch (error) {

                    console.error(
                        'ReceiveMessage handler error:',
                        error
                    );
                }
            });


            connection.start()
                .then(function () {

                    console.info(
                        'ChatHub connected'
                    );

                })
                .catch(function (error) {

                    console.warn(
                        'ChatHub connection failed:',
                        error
                    );
                });


        } catch (error) {

            console.warn(
                'SignalR initialization failed:',
                error
            );
        }
    }


    // Calculate the aggregate unread count from the server-rendered list.
    updateUnreadSummary();


    /* =========================================================
       CHAT SEARCH
       FRONTEND ONLY
    ========================================================= */

    if (chatSearchInput) {

        chatSearchInput.addEventListener(
            'input',
            applyChatFilters
        );
    }


    /* =========================================================
       CHAT FILTERS
       FRONTEND ONLY
    ========================================================= */

    chatFilters.forEach(function (button) {

        button.addEventListener(
            'click',
            function () {

                chatFilters.forEach(function (item) {
                    item.classList.remove('active');
                });

                button.classList.add('active');

                activeFilter =
                    button.dataset.filter || 'all';

                applyChatFilters();
            }
        );
    });


    function updateUnreadSummary() {
        const summary = document.getElementById('adminChatUnreadCount');

        if (!summary || !adminChatList) {
            return;
        }

        let totalUnread = 0;

        adminChatList
            .querySelectorAll('.admin-chat-item')
            .forEach(function (item) {
                totalUnread +=
                    parseInt(item.dataset.unread || '0', 10) || 0;
            });

        adminChatList
            .querySelectorAll('.admin-chat-student-group')
            .forEach(function (group) {

                let groupUnread = 0;

                group
                    .querySelectorAll('.admin-chat-item')
                    .forEach(function (item) {
                        groupUnread +=
                            parseInt(item.dataset.unread || '0', 10) || 0;
                    });

                const badge =
                    group.querySelector('.student-unread');

                if (badge) {
                    badge.textContent =
                        String(groupUnread);

                    badge.style.display =
                        groupUnread > 0
                            ? 'inline-flex'
                            : 'none';
                }
            });

        summary.textContent = String(totalUnread);

        summary.style.display =
            totalUnread > 0 ? 'inline-flex' : 'none';
    }


    function setChatUnread(item, count) {
        if (!item) {
            return;
        }

        const unread = Math.max(0, Number(count) || 0);

        item.dataset.unread = String(unread);

        const row =
            item.querySelector('.chat-item-message-row');

        let badge =
            item.querySelector('.admin-chat-badge');

        if (unread === 0) {
            badge?.remove();
        }
        else {
            if (!badge && row) {
                badge = document.createElement('span');
                badge.className = 'admin-chat-badge';
                row.appendChild(badge);
            }

            if (badge) {
                badge.textContent =
                    unread > 99 ? '99+' : String(unread);
            }
        }

        updateUnreadSummary();
    }


    /* =========================================================
       CHAT FILTERS
    ========================================================= */

    function applyChatFilters() {

        const search =
            chatSearchInput?.value
                ?.trim()
                .toLowerCase() || '';

        const groups =
            adminChatList?.querySelectorAll(
                '.admin-chat-student-group'
            ) || [];

        groups.forEach(function (group) {

            const items =
                group.querySelectorAll(
                    '.admin-chat-item'
                );

            let visibleItems = 0;

            items.forEach(function (item) {

                const text =
                    item.textContent.toLowerCase();

                const status =
                    (
                        item.dataset.status || ''
                    ).toLowerCase();

                const unread =
                    parseInt(
                        item.dataset.unread || '0',
                        10
                    ) || 0;

                let matchesFilter = true;

                if (activeFilter === 'unread') {
                    matchesFilter = unread > 0;
                }
                else if (activeFilter === 'hold') {
                    matchesFilter = status.includes('hold');
                }
                else if (activeFilter === 'open') {
                    matchesFilter =
                        !status.includes('hold') &&
                        !status.includes('pending') &&
                        !status.includes('completed') &&
                        !status.includes('closed');
                }

                const matchesSearch =
                    !search ||
                    text.includes(search) ||
                    group.textContent
                        .toLowerCase()
                        .includes(search);

                const visible =
                    matchesFilter &&
                    matchesSearch;

                item.style.display =
                    visible ? '' : 'none';

                if (visible) {
                    visibleItems++;
                }
            });

            group.style.display =
                visibleItems > 0 ? '' : 'none';
        });
    }


    /* =========================================================
       CHAT LIST CLICK
    ========================================================= */

    if (adminChatList) {

        adminChatList.addEventListener(
            'click',
            function (event) {

                const deleteButton =
                    event.target.closest('.admin-chat-delete');

                if (deleteButton) {
                    event.preventDefault();
                    event.stopPropagation();

                    const item =
                        deleteButton.closest('.admin-chat-item');

                    if (item) {
                        deleteChat(item);
                    }

                    return;
                }

                const studentHeader =
                    event.target.closest('.admin-chat-student-header');

                if (studentHeader) {
                    event.preventDefault();

                    const group =
                        studentHeader.closest('.admin-chat-student-group');

                    if (!group) {
                        return;
                    }

                    const collapsed =
                        group.classList.toggle('collapsed');

                    studentHeader.setAttribute(
                        'aria-expanded',
                        String(!collapsed)
                    );

                    return;
                }

                const openButton =
                    event.target.closest('.admin-chat-open');

                const item =
                    openButton?.closest('.admin-chat-item');

                if (!item) {
                    return;
                }

                event.preventDefault();

                openChat(item);
            }
        );
    }


    /* =========================================================
       CLOSE CHAT
    ========================================================= */

    if (closeAdminChat) {

        closeAdminChat.addEventListener(
            'click',
            closeDrawer
        );
    }


    /* =========================================================
       INPUT
    ========================================================= */

    if (adminChatInput) {

        adminChatInput.addEventListener(
            'input',
            function () {

                if (adminSendChat) {

                    adminSendChat.disabled =
                        !adminChatInput.value.trim() ||
                        !currentChatSessionId;
                }
            }
        );


        adminChatInput.addEventListener(
            'keydown',
            function (event) {

                if (
                    event.key === 'Enter' &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    if (
                        adminSendChat &&
                        !adminSendChat.disabled
                    ) {

                        adminSendChat.click();
                    }
                }
            }
        );
    }


    /* =========================================================
       SEND
    ========================================================= */

    if (adminSendChat) {

        adminSendChat.addEventListener(
            'click',
            sendMessage
        );
    }


    /* =========================================================
       ESCAPE
    ========================================================= */

    document.addEventListener(
        'keydown',
        function (event) {

            if (
                event.key === 'Escape' &&
                adminChatDrawer &&
                adminChatDrawer.classList.contains('open')
            ) {

                closeDrawer();
            }
        }
    );


    /* =========================================================
       MARK CHAT READ
       Persist read state on the server so the badge does not
       return after refresh/reload.
    ========================================================= */

    async function markChatRead(chatSessionId, item) {
        if (!chatSessionId) return false;

        try {
            const token =
                document.querySelector(
                    '#antiForgeryForm input[name="__RequestVerificationToken"]'
                )?.value || '';

            const response = await fetch(
                '/Admin/Chat/MarkChatRead',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                    },
                    credentials: 'same-origin',
                    body: new URLSearchParams({
                        chatSessionId: String(chatSessionId),
                        __RequestVerificationToken: token
                    })
                }
            );

            if (!response.ok) {
                console.warn('Admin MarkChatRead failed:', response.status);
                return false;
            }

            const result = await response.json();

            if (!result?.success) {
                console.warn('Admin MarkChatRead rejected:', result?.message);
                return false;
            }

            if (item) {
                setChatUnread(item, 0);
            }

            return true;
        }
        catch (error) {
            console.warn('Admin MarkChatRead failed:', error);
            return false;
        }
    }


    /* =========================================================
       DELETE CHAT
       Deletes only the chat session and its messages.
       Task, project, assignment and notification remain intact.
    ========================================================= */

    async function deleteChat(item) {

        const chatSessionId =
            item?.dataset.chatSessionId;

        if (!chatSessionId) {
            return;
        }

        const taskTitle =
            item.querySelector('.admin-chat-username')
                ?.textContent
                ?.trim() || 'this task';

        const confirmed =
            window.confirm(
                `Delete the chat for "${taskTitle}"?\n\nThis removes the conversation and its messages. The task itself will not be deleted.`
            );

        if (!confirmed) {
            return;
        }

        const token =
            document.querySelector(
                '#antiForgeryForm input[name="__RequestVerificationToken"]'
            )?.value || '';

        try {

            const response =
                await fetch(
                    '/Admin/Chat/Delete',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type':
                                'application/x-www-form-urlencoded; charset=UTF-8'
                        },
                        credentials: 'same-origin',
                        body: new URLSearchParams({
                            chatSessionId:
                                String(chatSessionId),
                            __RequestVerificationToken:
                                token
                        })
                    }
                );

            const result =
                await response.json();

            if (!response.ok || !result?.success) {
                throw new Error(
                    result?.message ||
                    'Unable to delete the chat.'
                );
            }

            const group =
                item.closest('.admin-chat-student-group');

            const deletingCurrent =
                currentChatSessionId &&
                String(currentChatSessionId) ===
                    String(chatSessionId);

            if (deletingCurrent) {
                await closeDrawer();
            }

            item.remove();

            if (group) {

                const remaining =
                    group.querySelectorAll(
                        '.admin-chat-item'
                    );

                if (remaining.length === 0) {
                    group.remove();
                }
                else {
                    const countElement =
                        group.querySelector(
                            '.student-header-content small'
                        );

                    if (countElement) {
                        countElement.textContent =
                            `${remaining.length} ${remaining.length === 1 ? 'conversation' : 'conversations'}`;
                    }
                }
            }

            updateUnreadSummary();

            applyChatFilters();

        }
        catch (error) {

            console.error(
                'Delete chat failed:',
                error
            );

            alert(
                error?.message ||
                'Unable to delete the chat.'
            );
        }
    }


    /* =========================================================
       OPEN CHAT
    ========================================================= */

    async function openChat(item) {

    const chatSessionId = item.dataset.chatSessionId;

    if (!chatSessionId) {
        return;
    }

    currentChatSessionId = chatSessionId;

    // Persist the read state. UI removal alone would return on reload.
    await markChatRead(chatSessionId, item);

    /* =====================================================
       MARK THIS CHAT AS READ IN THE UI
       Remove unread badge immediately when opened
    ====================================================== */

    const unreadBadge =
        item.querySelector('.admin-chat-badge');

    if (unreadBadge) {
        unreadBadge.remove();
    }

    /*
     * Keep the data attribute in sync so the
     * frontend unread filter also knows it is read.
     */
    item.dataset.unread = '0';



    /* Active item */

    const previous =
        adminChatList.querySelector(
            '.admin-chat-item.active'
        );

    if (previous) {
        previous.classList.remove('active');
    }

    item.classList.add('active');


    /* User name */

    const userName =
        item.querySelector(
            '.admin-chat-username'
        )?.textContent?.trim() || 'User';


    const subtitle =
        item.querySelector(
            '.chat-project'
        )?.textContent?.trim() || '';


    const drawerUserName =
        document.getElementById(
            'drawerUserName'
        );


    const drawerContext =
        document.getElementById(
            'drawerContext'
        );


    const drawerInitial =
        document.getElementById(
            'drawerUserInitial'
        );


    if (drawerUserName) {
        drawerUserName.textContent = userName;
    }


    if (drawerContext) {
        drawerContext.textContent = subtitle;
    }


    if (drawerInitial) {
        drawerInitial.textContent =
            userName.charAt(0).toUpperCase();
    }


    /* Open panel */

    if (adminChatDrawer) {

        adminChatDrawer.classList.add('open');

        adminChatDrawer.setAttribute(
            'aria-hidden',
            'false'
        );
    }


    /* Loading */

    if (adminChatMessages) {

        adminChatMessages.innerHTML = `
            <div class="chat-placeholder">
                <strong>Loading messages...</strong>
            </div>
        `;
    }


    if (adminChatInput) {
        adminChatInput.value = '';
    }


    if (adminSendChat) {
        adminSendChat.disabled = true;
    }


    /* Join SignalR */

    try {

        if (connection) {

            await connection.invoke(
                'JoinChat',
                Number(chatSessionId)
            );
        }

    } catch (error) {

        console.warn(
            'JoinChat failed:',
            error
        );
    }


    loadChatHistory(chatSessionId);
}


    /* =========================================================
       CLOSE CHAT
    ========================================================= */

    async function closeDrawer() {

        if (adminChatDrawer) {

            adminChatDrawer.classList.remove(
                'open'
            );

            adminChatDrawer.setAttribute(
                'aria-hidden',
                'true'
            );
        }


        const leavingSession =
            currentChatSessionId;


        if (adminChatMessages) {

            adminChatMessages.innerHTML = `
                <div class="chat-placeholder">

                    <div class="chat-placeholder-icon">
                        💬
                    </div>

                    <strong>Select a chat</strong>

                    <span>
                        Choose a conversation from the left to view messages.
                    </span>

                </div>
            `;
        }


        if (adminChatInput) {
            adminChatInput.value = '';
        }


        if (adminSendChat) {
            adminSendChat.disabled = true;
        }


        try {

            if (
                connection &&
                leavingSession
            ) {

                await connection.invoke(
                    'LeaveChat',
                    Number(leavingSession)
                );
            }

        } catch (error) {

            console.warn(
                'LeaveChat failed:',
                error
            );
        }


        currentChatSessionId = null;
        currentChatUserId = null;
    }


    /* =========================================================
       LOAD CHAT HISTORY
       EXISTING BACKEND ENDPOINT - UNCHANGED
    ========================================================= */

    async function loadChatHistory(chatSessionId) {

        try {

            const response =
                await fetch(
                    `/Admin/Chat/GetChat?chatSessionId=${encodeURIComponent(chatSessionId)}`,
                    {
                        method: 'GET',

                        headers: {
                            'Accept': 'application/json'
                        },

                        credentials: 'same-origin'
                    }
                );


            if (!response.ok) {

                if (adminChatMessages) {

                    adminChatMessages.innerHTML = `
                        <div class="chat-placeholder">
                            <strong>Unable to load chat</strong>
                            <span>
                                Failed to load chat (${response.status}).
                            </span>
                        </div>
                    `;
                }

                return;
            }


            const data =
                await response.json();


            const user =
                data.user ??
                data.User ??
                null;


            const task =
                data.task ??
                data.Task ??
                null;


            const messages =
                data.messages ??
                data.Messages ??
                [];


            currentChatUserId =
                user?.id ??
                user?.Id ??
                null;


            /* Task context */

            if (task) {

                const title =
                    task.title ??
                    task.Title ??
                    '';


                const status =
                    task.status ??
                    task.Status ??
                    '';


                const context =
                    `${title} · ${status}`;


                const drawerContext =
                    document.getElementById(
                        'drawerContext'
                    );


                if (drawerContext) {

                    drawerContext.textContent =
                        context;
                }
            }


            if (!adminChatMessages) {
                return;
            }


            adminChatMessages.innerHTML = '';


            if (
                !messages ||
                messages.length === 0
            ) {

                adminChatMessages.innerHTML = `
                    <div class="chat-placeholder">

                        <div class="chat-placeholder-icon">
                            💬
                        </div>

                        <strong>No messages yet</strong>

                        <span>
                            Start the conversation by sending a message.
                        </span>

                    </div>
                `;

            } else {

                messages.forEach(function (message) {

                    const element =
                        buildMessageElement(
                            message,
                            currentChatUserId
                        );

                    adminChatMessages.appendChild(
                        element
                    );
                });
            }


            scrollToBottom();


            if (adminSendChat) {
                adminSendChat.disabled = false;
            }

        } catch (error) {

            console.error(
                'Error loading chat:',
                error
            );


            if (adminChatMessages) {

                adminChatMessages.innerHTML = `
                    <div class="chat-placeholder">
                        <strong>Error loading chat</strong>
                        <span>
                            Please try again.
                        </span>
                    </div>
                `;
            }
        }
    }


    /* =========================================================
       BUILD MESSAGE
    ========================================================= */

    function buildMessageElement(
        message,
        chatUserId
    ) {

        const senderId =
            message.senderId ??
            message.SenderId ??
            '';


        const messageText =
            message.message ??
            message.Message ??
            '';


        const sentAt =
            message.sentAt ??
            message.SentAt ??
            null;


        /*
         * String comparison prevents
         * number/string ID mismatch.
         */

        const isUser =
            senderId &&
            chatUserId &&
            String(senderId) === String(chatUserId);


        const row =
            document.createElement('div');


        row.className =
            'message-row ' +
            (isUser ? 'user' : 'admin');


        const bubble =
            document.createElement('div');


        bubble.className =
            'message-bubble ' +
            (isUser ? 'user' : 'admin');


        const isInitialTaskMessage =
            /^\s*New chat started for Task #\d+/i.test(messageText);

        if (isInitialTaskMessage) {
            renderAdminInitialTaskMessage(bubble, messageText);
        } else {
            bubble.innerHTML = `
                <div>${escapeHtml(messageText)}</div>

                <div class="message-meta">
                    ${sentAt ? new Date(sentAt).toLocaleString() : new Date().toLocaleString()}
                </div>
            `;
        }


        row.appendChild(bubble);


        return row;
    }



    /* =========================================================
       INITIAL TASK MESSAGE FORMAT
       Frontend-only: keeps the task-start message organized.
    ========================================================= */

    function renderAdminInitialTaskMessage(bubble, messageText) {
        const normalized = String(messageText || '')
            .replace(/&#xA;|&#xa;|&#10;/gi, '\n')
            .replace(/\s+(?=(Task Title|Scenario|Status|Priority|Start Date|Expected End Date|Amount)\s*:)/gi, '\n')
            .replace(/^\s*(New chat started for Task #\d+)\s*/i, '$1\n')
            .trim();

        const lines = normalized.split(/\n+/).map(line => line.trim()).filter(Boolean);

        if (!lines.length || !/^New chat started for Task #\d+/i.test(lines[0])) {
            bubble.textContent = messageText;
            return;
        }

        bubble.classList.add('admin-initial-task-message');

        const heading = document.createElement('div');
        heading.className = 'admin-initial-task-title';
        heading.textContent = lines.shift();
        bubble.appendChild(heading);

        const details = document.createElement('div');
        details.className = 'admin-initial-task-details';

        lines.forEach(function (line) {
            const row = document.createElement('div');
            row.className = 'admin-initial-task-row';

            const separator = line.indexOf(':');

            if (separator > 0) {
                const label = document.createElement('span');
                label.className = 'admin-initial-task-label';
                label.textContent = line.slice(0, separator).trim();

                const value = document.createElement('span');
                value.className = 'admin-initial-task-value';
                value.textContent = line.slice(separator + 1).trim();

                row.appendChild(label);
                row.appendChild(value);
            } else {
                row.textContent = line;
            }

            details.appendChild(row);
        });

        if (details.children.length) {
            bubble.appendChild(details);
        }
    }

    /* =========================================================
       HTML SAFETY
    ========================================================= */

    function escapeHtml(value) {

        if (!value) {
            return '';
        }


        return String(value)

            .replace(/&/g, '&amp;')

            .replace(/</g, '&lt;')

            .replace(/>/g, '&gt;')

            .replace(/"/g, '&quot;')

            .replace(/'/g, '&#39;');
    }


    /* =========================================================
       SCROLL
    ========================================================= */

    function scrollToBottom() {

        if (!adminChatMessages) {
            return;
        }


        adminChatMessages.scrollTop =
            adminChatMessages.scrollHeight;
    }


    /* =========================================================
       SEND MESSAGE
       EXISTING SIGNALR + HTTP FALLBACK FLOW
    ========================================================= */

    async function sendMessage() {

        if (!currentChatSessionId) {
            return;
        }


        if (!adminChatInput) {
            return;
        }


        const text =
            adminChatInput.value.trim();


        if (!text) {
            return;
        }


        if (isSending) {
            return;
        }


        isSending = true;


        if (adminSendChat) {
            adminSendChat.disabled = true;
        }


        try {

            /* Prefer SignalR */

            if (connection) {

                try {

                    await connection.invoke(
                        'SendMessage',
                        Number(currentChatSessionId),
                        text
                    );


                    adminChatInput.value = '';

                } catch (error) {

                    console.warn(
                        'SignalR send failed, using HTTP fallback.',
                        error
                    );


                    await fallbackSend(text);
                }

            } else {

                await fallbackSend(text);
            }

        } catch (error) {

            console.error(
                'Error sending message:',
                error
            );


            alert(
                'Error sending message.'
            );

        } finally {

            isSending = false;


            if (adminSendChat) {

                adminSendChat.disabled =
                    adminChatInput.value.trim() === '';
            }
        }
    }


    /* =========================================================
       HTTP FALLBACK
       EXISTING BACKEND ENDPOINT - UNCHANGED
    ========================================================= */

    async function fallbackSend(text) {

        const token =
            document.querySelector(
                '#antiForgeryForm input[name="__RequestVerificationToken"]'
            )?.value || '';


        const payload = {
            chatSessionId:
                Number(currentChatSessionId),

            message:
                text
        };


        const response =
            await fetch(
                '/Admin/Chat/SendMessage',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json',

                        'RequestVerificationToken':
                            token
                    },

                    credentials:
                        'same-origin',

                    body:
                        JSON.stringify(payload)
                }
            );


        if (!response.ok) {

            const responseText =
                await response.text();


            console.error(
                'Send failed',
                response.status,
                responseText
            );


            alert(
                'Failed to send message.'
            );


            return;
        }


        /* Optimistic UI */

        const optimisticMessage = {

            SenderId:
                'ADMIN',

            Message:
                text,

            SentAt:
                new Date().toISOString()
        };


        const element =
            buildMessageElement(
                optimisticMessage,
                currentChatUserId
            );


        if (adminChatMessages) {

            adminChatMessages.appendChild(
                element
            );

            scrollToBottom();
        }


        adminChatInput.value = '';
    }

});