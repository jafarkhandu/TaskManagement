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


            connection.on('ReceiveMessage', function (payload) {

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

                    } else {

                        /* Increase unread badge */

                        if (item) {

                            const badge =
                                item.querySelector('.admin-chat-badge');


                            if (badge) {

                                const value =
                                    parseInt(
                                        badge.textContent || '0',
                                        10
                                    ) || 0;

                                badge.textContent =
                                    String(value + 1);

                            } else {

                                const row =
                                    item.querySelector(
                                        '.chat-item-message-row'
                                    );

                                if (row) {

                                    const newBadge =
                                        document.createElement('span');

                                    newBadge.className =
                                        'admin-chat-badge';

                                    newBadge.textContent = '1';

                                    row.appendChild(newBadge);
                                }
                            }
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


    function applyChatFilters() {

        const search =
            chatSearchInput?.value
                ?.trim()
                .toLowerCase() || '';


        const items =
            adminChatList?.querySelectorAll(
                '.admin-chat-item'
            ) || [];


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

                matchesFilter =
                    unread > 0;

            } else if (activeFilter === 'hold') {

                matchesFilter =
                    status.includes('hold');

            } else if (activeFilter === 'open') {

                matchesFilter =
                    !status.includes('hold') &&
                    !status.includes('pending') &&
                    !status.includes('completed') &&
                    !status.includes('closed');
            }


            const matchesSearch =
                !search ||
                text.includes(search);


            item.style.display =
                matchesFilter && matchesSearch
                    ? ''
                    : 'none';
        });
    }


    /* =========================================================
       CHAT LIST CLICK
    ========================================================= */

    if (adminChatList) {

        adminChatList.addEventListener(
            'click',
            function (event) {

                const item =
                    event.target.closest(
                        '.admin-chat-item'
                    );

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
       OPEN CHAT
    ========================================================= */

    async function openChat(item) {

    const chatSessionId = item.dataset.chatSessionId;

    if (!chatSessionId) {
        return;
    }

    currentChatSessionId = chatSessionId;

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


        const safeMessage =
            escapeHtml(messageText);


        const date =
            sentAt
                ? new Date(sentAt)
                : new Date();


        bubble.innerHTML = `
            <div>${safeMessage}</div>

            <div class="message-meta">
                ${date.toLocaleString()}
            </div>
        `;


        row.appendChild(bubble);


        return row;
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