(function loadGlobalMessages() {
    if (!document.querySelector('script[data-global-messages="true"]')) {
        const script = document.createElement("script");
        script.src = "/js/global-messages.js";
        script.dataset.globalMessages = "true";
        document.head.appendChild(script);
    }
})();

﻿document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       LOGOUT
    ===================================================== */

    const logoutForms =
        document.querySelectorAll(
            ".admin-logout-form, .sidebar-logout-form"
        );


    logoutForms.forEach(function (form) {

        form.addEventListener("submit", async function (event) {

            event.preventDefault();


            const button =
                form.querySelector("button[type='submit']");


            if (button) {

                button.disabled = true;

                button.classList.add("logging-out");

            }


            const token =
                form.querySelector(
                    'input[name="__RequestVerificationToken"]'
                )?.value;


            if (!token) {

                console.error(
                    "Anti-forgery token not found."
                );

                window.location.href =
                    "/Account/Login";

                return;
            }


            try {

                const response =
                    await fetch(
                        form.action,
                        {
                            method: "POST",

                            headers: {
                                "RequestVerificationToken":
                                    token,

                                "X-Requested-With":
                                    "XMLHttpRequest"
                            },

                            body:
                                new URLSearchParams({
                                    "__RequestVerificationToken":
                                        token
                                })
                        }
                    );


                if (!response.ok) {

                    throw new Error(
                        "Logout request failed."
                    );

                }


                const result =
                    await response.json();


                if (
                    result.success === true
                ) {

                    window.location.replace(
                        result.redirectUrl ||
                        "/Account/Login"
                    );

                    return;

                }


                throw new Error(
                    result.message ||
                    "Logout failed."
                );

            }
            catch (error) {

                console.error(
                    "Logout error:",
                    error
                );


                if (button) {

                    button.disabled = false;

                    button.classList.remove(
                        "logging-out"
                    );

                }


                alert(
                    "Logout failed. Please try again."
                );

            }

        });

    });


    /* =====================================================
       CTRL + K SEARCH
    ===================================================== */

    const searchInput =
        document.getElementById(
            "adminGlobalSearch"
        );


    document.addEventListener(
        "keydown",
        function (event) {

            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "k"
            ) {

                event.preventDefault();

                if (searchInput) {

                    searchInput.focus();

                }

            }

        }
    );


    /* =====================================================
       ADMIN CHAT NOTIFICATIONS
    ===================================================== */

    const notificationButton =
        document.getElementById("adminNotificationButton");

    const notificationPanel =
        document.getElementById("adminNotificationPanel");

    const closeNotifications =
        document.getElementById("closeAdminNotifications");

    const notificationList =
        document.getElementById("adminChatNotificationList");

    const notificationSummary =
        document.getElementById("adminChatNotificationSummary");

    const notificationDot =
        document.getElementById("adminNotificationDot");

    function closeAdminNotifications() {
        notificationPanel?.classList.remove("show");
        notificationPanel?.setAttribute("aria-hidden", "true");
    }

    function escapeChatNotificationText(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    async function loadAdminChatNotifications() {
        if (!notificationList)
            return;

        try {
            const response = await fetch(
                "/Admin/Chat",
                {
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );

            if (!response.ok)
                throw new Error("Unable to load admin chats.");

            const html = await response.text();
            const documentHtml =
                new DOMParser().parseFromString(html, "text/html");

            const chats =
                Array.from(
                    documentHtml.querySelectorAll(".admin-chat-item")
                ).map(item => ({
                    id: item.dataset.chatSessionId,
                    user: item.querySelector(".admin-chat-username")?.textContent.trim() || "User",
                    message: item.querySelector(".admin-chat-preview")?.textContent.trim() || "New chat message",
                    time: item.querySelector(".admin-chat-time")?.textContent.trim() || "",
                    unread: parseInt(item.dataset.unread || "0", 10) || 0
                })).filter(chat => chat.unread > 0);

            const unreadTotal =
                chats.reduce((total, chat) => total + chat.unread, 0);

            if (notificationDot) {
                notificationDot.hidden = unreadTotal === 0;
            }

            notificationButton?.classList.toggle(
                "has-notification",
                unreadTotal > 0
            );

            notificationSummary.textContent =
                unreadTotal > 0
                    ? unreadTotal + (unreadTotal === 1 ? " unread message" : " unread messages")
                    : "No unread chat messages";

            if (!chats.length) {
                notificationList.innerHTML = `
                    <div class="admin-chat-notification-empty">
                        <span>✓</span>
                        <strong>No unread chats</strong>
                        <small>New messages from students will appear here.</small>
                    </div>
                `;
                return;
            }

            notificationList.innerHTML = chats.map(chat => `
                <a class="admin-notification-item admin-chat-notification-item"
                   href="/Admin/Chat#chat-${encodeURIComponent(chat.id)}">
                    <span class="admin-notification-item-icon">💬</span>
                    <span>
                        <strong>${escapeChatNotificationText(chat.user)}</strong>
                        <small>${escapeChatNotificationText(chat.message)}</small>
                    </span>
                    <span class="admin-chat-notification-count">${chat.unread}</span>
                </a>
            `).join("");

        } catch (error) {
            console.warn("Admin chat notifications could not be loaded:", error);

            notificationSummary.textContent = "Chat notifications unavailable";

            notificationList.innerHTML = `
                <div class="admin-chat-notification-empty">
                    <span>!</span>
                    <strong>Could not load chats</strong>
                    <small>Open Chat to check your conversations.</small>
                </div>
            `;
        }
    }

    notificationButton?.addEventListener("click", async event => {
        event.stopPropagation();

        const isOpen =
            notificationPanel?.classList.toggle("show") ?? false;

        notificationPanel?.setAttribute(
            "aria-hidden",
            isOpen ? "false" : "true"
        );

        if (isOpen) {
            await loadAdminChatNotifications();
        }
    });

    closeNotifications?.addEventListener("click", event => {
        event.stopPropagation();
        closeAdminNotifications();
    });

    notificationPanel?.addEventListener("click", event => {
        event.stopPropagation();
    });

    document.addEventListener("click", event => {
        if (
            notificationPanel &&
            !notificationPanel.contains(event.target) &&
            !notificationButton?.contains(event.target)
        ) {
            closeAdminNotifications();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            notificationPanel?.classList.contains("show")
        ) {
            closeAdminNotifications();
        }
    });

    /* Refresh the badge periodically using the existing Admin Chat page.
       No new backend endpoint is required. */
    loadAdminChatNotifications();
    window.setInterval(loadAdminChatNotifications, 30000);



    /* =====================================================
       ADMIN REAL-TIME NOTIFICATIONS
       Shared by every Admin page.
    ===================================================== */

    const adminChatSidebarDot =
        document.getElementById("adminChatSidebarDot");

    const adminChatSidebarLink =
        document.getElementById("adminChatSidebarLink");

    function setAdminChatSidebarDot(show) {
        if (adminChatSidebarDot) {
            adminChatSidebarDot.hidden = !show;
        }
    }

    async function refreshAdminChatSidebarDot() {
        try {
            const response = await fetch(
                "/Admin/Chat",
                {
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                return;
            }

            const html = await response.text();
            const parsed = new DOMParser().parseFromString(html, "text/html");

            const hasUnreadChat = Array.from(
                parsed.querySelectorAll(".admin-chat-item")
            ).some(item =>
                (parseInt(item.dataset.unread || "0", 10) || 0) > 0
            );

            setAdminChatSidebarDot(hasUnreadChat);
        }
        catch (error) {
            console.warn(
                "Admin chat sidebar notification check failed:",
                error
            );
        }
    }

    async function markAllAdminChatNotificationsRead() {
        const token =
            document.querySelector(
                'input[name="__RequestVerificationToken"]'
            )?.value || "";

        try {
            await fetch(
                "/Admin/Chat/MarkAllChatNotificationsRead",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "RequestVerificationToken": token,
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: token
                        ? new URLSearchParams({
                            "__RequestVerificationToken": token
                        })
                        : undefined
                }
            );
        }
        catch (error) {
            console.warn(
                "Unable to clear admin chat notifications:",
                error
            );
        }
    }

    function ensureAdminSignalR() {
        if (window.signalR) {
            return Promise.resolve();
        }

        if (window.__adminSignalRLoading) {
            return window.__adminSignalRLoading;
        }

        window.__adminSignalRLoading = new Promise(function (resolve, reject) {
            const script = document.createElement("script");

            script.src =
                "https://cdn.jsdelivr.net/npm/@microsoft/signalr@10.0.0/dist/browser/signalr.min.js";
            script.async = true;

            script.onload = resolve;
            script.onerror = reject;

            document.head.appendChild(script);
        });

        return window.__adminSignalRLoading;
    }

    function showAdminRealtimeToast(payload) {
        const type = String(payload?.type || "").toLowerCase();

        const isRejected =
            type.includes("rejected") ||
            String(payload?.title || "").toLowerCase().includes("rejected");

        const isApproved =
            type.includes("accepted") ||
            type.includes("approved") ||
            String(payload?.title || "").toLowerCase().includes("approved");

        const isChat =
            type.includes("chat") ||
            String(payload?.title || "").toLowerCase().includes("chat");

        const isCompleted =
            type === "admintaskcompleted" ||
            String(payload?.title || "").toLowerCase().includes("task completed");

        const toast = document.createElement("div");
        toast.className =
            "admin-realtime-toast" +
            (isRejected ? " is-rejected" : "") +
            (isApproved ? " is-approved" : "") +
            (isChat ? " is-chat" : "") +
            (isCompleted ? " is-completed" : "");

        const icon = isRejected
            ? "×"
            : isApproved || isCompleted
                ? "✓"
                : isChat
                    ? "✉"
                    : "•";

        const title =
            payload?.title ||
            (isChat ? "New Chat Message" : "New Notification");

        const message =
            payload?.message ||
            (isCompleted
                ? "A user completed a task."
                : isChat
                    ? "A user sent a new message."
                    : "You have a new administrator notification.");

        const repositoryUrl =
            typeof payload?.completionRepositoryUrl === "string"
                ? payload.completionRepositoryUrl.trim()
                : "";

        toast.innerHTML = `
            <div class="admin-realtime-toast-glow"></div>
            <div class="admin-realtime-toast-icon" aria-hidden="true">
                ${icon}
            </div>
            <div class="admin-realtime-toast-content">
                <strong>${escapeChatNotificationText(title)}</strong>
                <span>${escapeChatNotificationText(message)}</span>
                ${repositoryUrl
                    ? `<a class="admin-realtime-toast-repository"
                           href="${escapeChatNotificationText(repositoryUrl)}"
                           target="_blank"
                           rel="noopener noreferrer">
                           🔗 Open Git Repository
                       </a>`
                    : ""}
            </div>
            <button type="button"
                    class="admin-realtime-toast-close"
                    aria-label="Close notification">×</button>
            <div class="admin-realtime-toast-progress"></div>
        `;

        document.body.appendChild(toast);

        const close =
            toast.querySelector(".admin-realtime-toast-close");

        let timer = window.setTimeout(removeToast, 5200);

        function removeToast() {
            window.clearTimeout(timer);
            toast.classList.add("is-leaving");

            window.setTimeout(function () {
                toast.remove();
            }, 360);
        }

        close?.addEventListener("click", removeToast);

        if (payload?.notificationId && window.__adminNotificationConnection) {
            window.__adminNotificationConnection
                .invoke(
                    "AcknowledgeNotification",
                    Number(payload.notificationId)
                )
                .catch(function () {
                    // Delivery is already persisted server-side.
                });
        }
    }

    async function startAdminRealtimeNotifications() {
        try {
            await ensureAdminSignalR();

            if (!window.signalR) {
                return;
            }

            if (window.__adminNotificationConnection) {
                return;
            }

            const connection =
                new signalR.HubConnectionBuilder()
                    .withUrl("/notificationHub")
                    .withAutomaticReconnect()
                    .build();

            window.__adminNotificationConnection = connection;

            connection.on(
                "AdminLiveNotification",
                function (payload) {
                    const type =
                        String(payload?.type || "")
                            .toLowerCase();

                    if (type.includes("chat")) {
                        setAdminChatSidebarDot(true);
                    }

                    showAdminRealtimeToast(payload);
                }
            );

            connection.on(
                "AdminMissedNotificationsReceived",
                function (notifications) {
                    if (!Array.isArray(notifications)) {
                        return;
                    }

                    notifications.forEach(function (notification, index) {
                        const type =
                            String(notification?.type || "")
                                .toLowerCase();

                        if (type.includes("chat")) {
                            setAdminChatSidebarDot(true);
                        }

                        window.setTimeout(function () {
                            showAdminRealtimeToast(notification);
                        }, index * 450);
                    });
                }
            );

            connection.onreconnected(function () {
                refreshAdminChatSidebarDot();
            });

            await connection.start();

        }
        catch (error) {
            console.warn(
                "Admin real-time notification connection failed:",
                error
            );
        }
    }

    const isAdminChatPage =
        window.location.pathname
            .toLowerCase()
            .startsWith("/admin/chat");

    refreshAdminChatSidebarDot();

    window.setInterval(
        refreshAdminChatSidebarDot,
        30000
    );

    startAdminRealtimeNotifications();


});