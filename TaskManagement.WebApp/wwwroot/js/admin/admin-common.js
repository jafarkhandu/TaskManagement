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
       GLOBAL ADMIN NOTIFICATIONS
       Chat messages are intentionally excluded from this panel.
    ===================================================== */

    const notificationButton =
        document.getElementById("adminNotificationButton");

    const notificationPanel =
        document.getElementById("adminNotificationPanel");

    const closeNotifications =
        document.getElementById("closeAdminNotifications");

    const notificationList =
        document.getElementById("adminNotificationList");

    const notificationSummary =
        document.getElementById("adminNotificationSummary");

    const notificationDot =
        document.getElementById("adminNotificationDot");

    const clearAllNotificationsButton =
        document.getElementById("clearAllAdminNotifications");

    function closeAdminNotifications() {
        notificationPanel?.classList.remove("show");
        notificationPanel?.setAttribute("aria-hidden", "true");
    }

    function escapeNotificationText(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    function escapeChatNotificationText(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    function setAdminNotificationDot(show) {
        if (notificationDot) {
            notificationDot.hidden = !show;
        }

        notificationButton?.classList.toggle(
            "has-notification",
            !!show
        );
    }

    function notificationIcon(type) {
        const value = String(type || "").toLowerCase();

        if (value === "admintaskcompleted") return "✓";
        if (value === "adminassignmentresponse") return "↔";
        if (value === "adminchatmessage") return "✉";
        return "•";
    }

    function notificationClass(type) {
        const value = String(type || "").toLowerCase();

        if (value === "admintaskcompleted") return " is-completed";
        if (value === "adminassignmentresponse") return " is-approved";
        if (value === "adminchatmessage") return " is-chat";
        return "";
    }

    function notificationMessage(notification) {
        if (notification?.message) {
            return notification.message;
        }

        return "You have a new administrator notification.";
    }

    async function loadAdminNotifications(markReadAfterLoad = false) {
        if (!notificationList) return;

        try {
            const response = await fetch(
                "/Admin/Notifications/Pending",
                {
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error("Unable to load notifications.");
            }

            const json = await response.json();
            const notifications = Array.isArray(json?.notifications)
                ? json.notifications
                : [];

            const unread = notifications.filter(n => !n.isRead);
            const unreadTotal = unread.length;

            if (notificationDot) {
                notificationDot.hidden = unreadTotal === 0;
            }

            notificationButton?.classList.toggle(
                "has-notification",
                unreadTotal > 0
            );

            notificationSummary.textContent =
                unreadTotal > 0
                    ? unreadTotal + (unreadTotal === 1
                        ? " unread notification"
                        : " unread notifications")
                    : "No unread notifications";

            if (!notifications.length) {
                notificationList.innerHTML = `
                    <div class="admin-chat-notification-empty">
                        <span>✓</span>
                        <strong>No notifications</strong>
                        <small>Approved, rejected and completed task updates will appear here.</small>
                    </div>
                `;
                return;
            }

            notificationList.innerHTML = notifications.map(notification => {
                const type = String(notification.type || "");
                const repositoryUrl =
                    typeof notification.completionRepositoryUrl === "string"
                        ? notification.completionRepositoryUrl.trim()
                        : "";

                const repositoryAction = repositoryUrl
                    ? `
                        <a class="admin-notification-repository"
                           href="${escapeNotificationText(repositoryUrl)}"
                           target="_blank"
                           rel="noopener noreferrer">
                            🔗 Repository
                        </a>
                      `
                    : "";

                const notificationId =
                    Number(notification.notificationId) || 0;

                const taskId =
                    Number(notification.taskId) || 0;

                const projectId =
                    Number(notification.projectId) || 0;

                const chatSessionId =
                    Number(notification.chatSessionId) || 0;

                let destination = "";

                if (type.toLowerCase() === "adminchatmessage" && chatSessionId) {
                    destination =
                        "/Admin/Chat#chat-" +
                        encodeURIComponent(chatSessionId);
                }
                else if (taskId) {
                    destination =
                        "/Admin/Tasks/Project/" +
                        encodeURIComponent(projectId) +
                        "?taskId=" +
                        encodeURIComponent(taskId);
                }

                return `
                    <div class="admin-notification-item global-admin-notification${notificationClass(type)}"
                         data-notification-id="${notificationId}"
                         data-destination="${escapeNotificationText(destination)}"
                         role="${destination ? "button" : "article"}"
                         tabindex="${destination ? "0" : "-1"}">
                        <span class="admin-notification-item-icon">
                            ${notificationIcon(type)}
                        </span>
                        <span class="admin-notification-item-content">
                            <strong>${escapeNotificationText(notification.title || "Notification")}</strong>
                            <small>${escapeNotificationText(notificationMessage(notification))}</small>
                            ${repositoryAction}
                        </span>
                        <span class="admin-notification-arrow">›</span>
                    </div>
                `;
            }).join("");

            if (markReadAfterLoad && unreadTotal > 0) {
                await markAllGlobalAdminNotificationsRead(false);
                notificationSummary.textContent = "No unread notifications";

                if (notificationDot) {
                    notificationDot.hidden = true;
                }

                notificationButton?.classList.remove("has-notification");
            }
        }
        catch (error) {
            console.warn("Admin notifications could not be loaded:", error);

            notificationSummary.textContent = "Notifications unavailable";

            notificationList.innerHTML = `
                <div class="admin-chat-notification-empty">
                    <span>!</span>
                    <strong>Could not load notifications</strong>
                    <small>Please try again.</small>
                </div>
            `;
        }
    }

    async function clearAllGlobalAdminNotifications() {
        if (!notificationList) return;

        const cards = [
            ...notificationList.querySelectorAll(".global-admin-notification")
        ];

        if (!cards.length) return;

        if (clearAllNotificationsButton) {
            clearAllNotificationsButton.disabled = true;
        }

        cards.forEach((card, index) => {
            card.style.transition =
                "transform .52s cubic-bezier(.16,1,.3,1), opacity .52s ease, max-height .52s ease, margin .52s ease, padding .52s ease";
            card.style.transitionDelay = `${index * 110}ms`;
            card.style.transform = "translate3d(120%, 0, 0) scale(.96)";
            card.style.opacity = "0";
            card.style.maxHeight = `${card.offsetHeight}px`;
            card.style.overflow = "hidden";

            requestAnimationFrame(() => {
                card.style.maxHeight = "0px";
                card.style.marginTop = "0px";
                card.style.marginBottom = "0px";
                card.style.paddingTop = "0px";
                card.style.paddingBottom = "0px";
            });
        });

        const animationTime = ((cards.length - 1) * 90) + 600;

        try {
            const token =
                document.querySelector(
                    'input[name="__RequestVerificationToken"]'
                )?.value || "";

            const response = await fetch(
                "/Admin/Notifications/ClearAll",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "RequestVerificationToken": token,
                        "X-Requested-With": "XMLHttpRequest",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                    },
                    body: token
                        ? new URLSearchParams({
                            "__RequestVerificationToken": token
                        })
                        : undefined
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to clear notifications."
                );
            }

            window.setTimeout(() => {
                notificationList.innerHTML = `
                    <div class="admin-chat-notification-empty admin-notification-empty-state">
                        <span>✓</span>
                        <strong>You're all caught up</strong>
                        <small>No new administrator notifications.</small>
                    </div>
                `;

                notificationSummary.textContent = "No unread notifications";

                if (notificationDot) {
                    notificationDot.hidden = true;
                }

                notificationButton?.classList.remove("has-notification");

                if (clearAllNotificationsButton) {
                    clearAllNotificationsButton.disabled = false;
                }
            }, animationTime);
        }
        catch (error) {
            cards.forEach(card => {
                card.style.transition = "none";
                card.style.transitionDelay = "0ms";
                card.style.transform = "";
                card.style.opacity = "";
            });

            if (clearAllNotificationsButton) {
                clearAllNotificationsButton.disabled = false;
            }

            console.warn("Clear admin notifications failed:", error);
        }
    }

    async function markAllGlobalAdminNotificationsRead() {
        // Opening the panel should mark notifications as read,
        // but READ is not the same as CLEAR. Cleared notifications
        // are removed from the database by Clear All.
        const token =
            document.querySelector(
                'input[name="__RequestVerificationToken"]'
            )?.value || "";

        try {
            const response = await fetch(
                "/Admin/Notifications/MarkAllRead",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "RequestVerificationToken": token,
                        "X-Requested-With": "XMLHttpRequest",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                    },
                    body: token
                        ? new URLSearchParams({
                            "__RequestVerificationToken": token
                        })
                        : undefined
                }
            );

            if (!response.ok) {
                throw new Error("Unable to mark notifications as read.");
            }
        }
        catch (error) {
            console.warn("Unable to mark admin notifications as read:", error);
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
            await loadAdminNotifications(true);
        }
    });

    closeNotifications?.addEventListener("click", event => {
        event.stopPropagation();
        closeAdminNotifications();
    });

    clearAllNotificationsButton?.addEventListener("click", async event => {
        event.stopPropagation();
        await clearAllGlobalAdminNotifications();
    });

    function openAdminNotificationDestination(item) {
        const destination =
            item?.dataset?.destination || "";

        if (!destination) return;

        closeAdminNotifications();
        window.location.href = destination;
    }

    notificationList?.addEventListener("click", event => {
        const item =
            event.target.closest(".global-admin-notification");

        if (!item) return;

        if (event.target.closest("a, button")) {
            return;
        }

        openAdminNotificationDestination(item);
    });

    notificationList?.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;

        const item =
            event.target.closest(".global-admin-notification");

        if (!item) return;

        event.preventDefault();
        openAdminNotificationDestination(item);
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

    loadAdminNotifications();
    window.setInterval(
        () => loadAdminNotifications(false),
        30000
    );


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
                "/Admin/Chat/UnreadCount",
                {
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                return;
            }

            const result = await response.json();
            setAdminChatSidebarDot(result?.hasUnreadChat === true);
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
                    // Every live admin notification gets the bell red dot,
                    // including chat, completed, approved and rejected events.
                    setAdminNotificationDot(true);

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

                    if (notifications.length > 0) {
                        setAdminNotificationDot(true);
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

            return connection;

        }
        catch (error) {
            console.warn(
                "Admin real-time notification connection failed:",
                error
            );

            return null;
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

    const adminNotificationConnectionReady =
        startAdminRealtimeNotifications();

    window.__adminNotificationConnectionReady =
        adminNotificationConnectionReady;

    adminNotificationConnectionReady.then(function (connection) {
        if (!connection) {
            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                "adminNotificationConnectionReady",
                {
                    detail: {
                        connection: connection
                    }
                }
            )
        );
    });


});