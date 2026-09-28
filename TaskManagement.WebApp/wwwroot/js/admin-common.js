document.addEventListener("DOMContentLoaded", function () {

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


});