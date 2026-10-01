(() => {
    let connection;
    let loading;

    const loadSignalR = () => {
        if (window.signalR) return Promise.resolve();
        if (loading) return loading;
        loading = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/@microsoft/signalr@10.0.0/dist/browser/signalr.min.js";
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return loading;
    };

    const escapeHtml = value => {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    };

    function showReviewToast(payload) {
        if (!payload || !payload.notificationId) return;

        const type = String(payload.type || "").toLowerCase();
        const rejected = type.includes("rejected");
        const settled = type.includes("paymentsettled");
        const withheld = type.includes("paymentwithheld");
        const approved = type.includes("approved");

        const toast = document.createElement("div");
        toast.className =
            "user-review-realtime-toast " +
            (rejected ? "is-rejected" : withheld ? "is-withheld" : settled ? "is-settled" : approved ? "is-approved" : "");

        const icon = rejected ? "×" : withheld ? "₹" : settled ? "₹" : "✓";

        toast.innerHTML =
            '<div class="user-review-toast-icon">' + icon + '</div>' +
            '<div class="user-review-toast-content">' +
                '<strong>' + escapeHtml(payload.title || "Task Review Update") + '</strong>' +
                '<span>' + escapeHtml(payload.message || "") + '</span>' +
            '</div>' +
            '<button type="button" aria-label="Close">×</button>' +
            '<i></i>';

        document.body.appendChild(toast);

        const remove = () => {
            if (!toast.isConnected) return;
            toast.classList.add("leaving");
            setTimeout(() => toast.remove(), 320);
        };

        toast.querySelector("button")?.addEventListener("click", remove);
        setTimeout(remove, 5200);

        connection?.invoke("AcknowledgeNotification", Number(payload.notificationId))
            .catch(() => {});
    }

    async function start() {
        try {
            await loadSignalR();
            if (!window.signalR || connection) return;

            connection = new signalR.HubConnectionBuilder()
                .withUrl("/notificationHub")
                .withAutomaticReconnect()
                .build();

            connection.on("UserReviewNotificationReceived", showReviewToast);

            connection.on("MissedNotificationsReceived", notifications => {
                if (!Array.isArray(notifications)) return;

                notifications
                    .filter(n =>
                        ["TaskReviewApproved", "TaskReviewRejected", "TaskPaymentSettled", "TaskPaymentWithheld"]
                            .includes(String(n.type || ""))
                    )
                    .forEach((n, index) => {
                        setTimeout(() => showReviewToast(n), index * 220);
                    });
            });

            await connection.start();
            window.__userReviewNotificationConnection = connection;
        }
        catch (error) {
            console.warn("User review realtime notification connection failed:", error);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (document.querySelector('script[src*="/js/users/user-dashboard.js"]')) {
            return;
        }
        start();
    });
})();