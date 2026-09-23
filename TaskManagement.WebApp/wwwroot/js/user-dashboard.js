document.addEventListener("DOMContentLoaded", () => {

    const quotes = [
        ["A little progress each day adds up to big results.", "Keep Going"],
        ["Success is built one completed task at a time.", "Stay Consistent"],
        ["Focus on progress, not perfection.", "Keep Moving"],
        ["Small steps today create bigger results tomorrow.", "Stay Focused"],
        ["Your future is created by what you do today.", "Make It Count"],
        ["Plan your work. Work your plan.", "Stay Disciplined"],
        ["Consistency turns ordinary effort into extraordinary results.", "Keep Building"],
        ["One task finished is one step closer to the goal.", "One Step More"]
    ];

    const quote = document.getElementById("dashboardQuote");
    const author = document.getElementById("dashboardQuoteAuthor");

    if (quote && author) {
        const last = Number(sessionStorage.getItem("lastDashboardQuote"));

        let index;

        do {
            index = Math.floor(Math.random() * quotes.length);
        } while (quotes.length > 1 && index === last);

        quote.textContent = quotes[index][0];
        author.textContent = `— ${quotes[index][1]}`;

        sessionStorage.setItem("lastDashboardQuote", index);
    }

    // Live toast UI
    function showLiveToast(payload) {

        if (!payload || !payload.notificationId)
            return;

        const toastId = `live-toast-${payload.notificationId}`;

        // Prevent duplicates
        if (document.getElementById(toastId))
            return;

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'live-toast';

        toast.innerHTML = `
            <div class="live-toast-inner">

                <div class="live-toast-icon">🔔</div>

                <div class="live-toast-body">
                    <strong>New assignment for you</strong>
                    <div class="live-toast-sub">Click to view</div>

                    <div class="live-toast-progress">
                        <div></div>
                    </div>
                </div>

                <button type="button"
                        class="live-toast-close"
                        aria-label="Close notification">
                    ×
                </button>

            </div>
        `;

        toast.addEventListener('click', (event) => {

            if (event.target.closest('.live-toast-close')) {
                return;
            }

            window.location.href =
                `/User/Notifications/Details/${payload.notificationId}`;
        });

        document.body.appendChild(toast);

        toast.querySelector('.live-toast-close')
            ?.addEventListener('click', (event) => {

                event.stopPropagation();

                toast.classList.add('live-toast-hidden');

                setTimeout(() => {
                    toast.remove();
                }, 450);

            });

        // Start entrance animation
        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        // Auto dismiss after 5s
        const progress = toast.querySelector('.live-toast-progress > div');

        // Start progress
        requestAnimationFrame(() => {
            progress.style.transition = 'width 5s linear';
            progress.style.width = '100%';
        });

        // Remove after 5.2s
        setTimeout(() => {
            toast.classList.add('live-toast-hidden');
            setTimeout(() => toast.remove(), 300);
        }, 5200);

    }

    const body = document.body;


    /* =====================================================
       MODALS
    ===================================================== */

    function openModal(id) {

        const modal = document.getElementById(id);

        if (!modal)
            return;

        modal.classList.add("show");

        body.style.overflow = "hidden";
    }


    function closeModal(modal) {

        if (!modal)
            return;

        modal.classList.remove("show");

        body.style.overflow = "";
    }


    document.querySelectorAll("[data-modal]")
        .forEach(button => {

            button.addEventListener("click", () => {

                openModal(button.dataset.modal);

            });

        });


    document.querySelectorAll("[data-close]")
        .forEach(button => {

            button.addEventListener("click", () => {

                closeModal(
                    button.closest(".modal")
                );

            });

        });


    document.querySelectorAll(".modal")
        .forEach(modal => {

            modal.addEventListener("click", event => {

                if (event.target === modal) {
                    closeModal(modal);
                }

            });

        });


    document.addEventListener("keydown", event => {

        if (event.key !== "Escape")
            return;

        document.querySelectorAll(".modal.show")
            .forEach(closeModal);

    });


    /* =====================================================
       NOTIFICATIONS
    ===================================================== */

    const notificationButton =
        document.getElementById("notificationButton");

    const notificationPopup =
        document.getElementById("notificationPopup");

    notificationPopup?.addEventListener("click", (event) => {

        const heading = event.target.closest(".popup-title strong");

        if (!heading)
            return;

        window.location.href = "/User/Notifications";
    });

    const closeNotifications =
        document.getElementById("closeNotifications");


    function getAntiForgeryToken() {

        return document.querySelector(
            'input[name="__RequestVerificationToken"]'
        )?.value || "";
    }


    function escapeHtml(value) {

        const div = document.createElement("div");

        div.textContent = value ?? "";

        return div.innerHTML;
    }


    function formatDate(value) {

        if (!value)
            return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime()))
            return value;

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }


    function renderAssignmentNotifications(notifications) {

        if (!notificationPopup)
            return;

        const title = `
        <div class="popup-title">
            <strong>Notifications</strong>

            <div class="popup-title-actions">
                <button type="button"
                        id="clearPopupNotifications"
                        class="clear-popup-button">
                    Clear
                </button>

                <button type="button"
                        id="closeNotifications">
                    ×
                </button>
            </div>
        </div>
    `;

        if (!notifications || notifications.length === 0) {

            notificationPopup.innerHTML = title + `
            <div class="notification-empty">

                <span>✓</span>

                <strong>
                    You're all caught up
                </strong>

                <small>
                    No new task assignments.
                </small>

            </div>
        `;

            document
                .getElementById("closeNotifications")
                ?.addEventListener("click", () => {

                    notificationPopup.classList.remove("show");

                });

            return;
        }

        // Compact entries only: icon + heading + chevron
        const items = notifications.map(n => `
            <div class="notification-item compact-notification"
                 data-notification-id="${n.notificationId}">

                <span>\uD83D\uDD14</span>

                <div class="notification-compact-content">
                    <strong>New assignment for you</strong>
                    <small>${formatDate(n.createdAt)}</small>
                </div>

                <div class="notification-chevron">›</div>

            </div>
        `).join("");


        notificationPopup.innerHTML = title + items;

        document
            .getElementById("clearPopupNotifications")
            ?.addEventListener("click", (event) => {

                event.stopPropagation();

                const items =
                    notificationPopup.querySelectorAll(
                        ".compact-notification"
                    );

                if (!items.length)
                    return;

                // Remember cleared notifications
                const clearedIds = JSON.parse(
                    sessionStorage.getItem(
                        "clearedPopupNotifications"
                    ) || "[]"
                );

                items.forEach(item => {

                    const id =
                        Number(item.dataset.notificationId);

                    if (
                        id &&
                        !clearedIds.includes(id)
                    ) {
                        clearedIds.push(id);
                    }
                });

                sessionStorage.setItem(
                    "clearedPopupNotifications",
                    JSON.stringify(clearedIds)
                );

                // Slide out one by one
                items.forEach((item, index) => {

                    item.style.transition =
                        "transform 0.45s cubic-bezier(.2,.8,.2,1), opacity 0.45s ease";

                    item.style.transitionDelay =
                        `${index * 120}ms`;

                    item.style.transform =
                        "translateX(120%)";

                    item.style.opacity = "0";
                });

                // Wait for all animations to finish
                const animationTime =
                    ((items.length - 1) * 120) + 600;

                setTimeout(() => {

                    renderAssignmentNotifications([]);

                    updateNotificationBadge(0);

                }, animationTime);

            });

        document
            .querySelector(".notifications-page-link")
            ?.addEventListener("click", () => {
                window.location.href = "/User/Notifications";
            });


        // Make items clickable to open exact details
        document
            .querySelectorAll(".compact-notification")
            .forEach(item => item.addEventListener("click", e => {

                const notificationId = item.dataset.notificationId;

                if (notificationId) {
                    window.location.href = `/User/Notifications/Details/${notificationId}`;
                }

            }));
    }


    async function loadAssignmentNotifications() {

        try {

            const response =
                await fetch("/User/Notifications/Pending");

            if (!response.ok)
                return;

            const result =
                await response.json();

            if (result.success) {

                const clearedIds = JSON.parse(
                    sessionStorage.getItem("clearedPopupNotifications") || "[]"
                );

                const visibleNotifications =
                    result.notifications.filter(
                        n => !clearedIds.includes(n.notificationId)
                    );

                renderAssignmentNotifications(
                    visibleNotifications
                );

                updateNotificationBadge(
                    visibleNotifications.length
                );
            }

        }
        catch (error) {

            console.error(
                "Notification loading failed:",
                error
            );

        }
    }


    function updateNotificationBadge(count) {

        if (!notificationButton)
            return;

        const hasNotifications =
            Number(count) > 0;

        notificationButton.classList.toggle(
            "has-notifications",
            hasNotifications
        );
    }


    async function respondToAssignment(
        assignmentId,
        action,
        button
    ) {

        const buttons =
            document.querySelectorAll(
                `[data-assignment-id="${assignmentId}"]`
            );

        buttons.forEach(element => {

            if (
                element.tagName === "BUTTON"
            ) {
                element.disabled = true;
            }

        });


        const token =
            getAntiForgeryToken();


        try {

            const response =
                await fetch(
                    `/User/Notifications/${action}`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded; charset=UTF-8",

                            "RequestVerificationToken":
                                token
                        },

                        body:
                            `assignmentId=${encodeURIComponent(
                                assignmentId
                            )}`
                    }
                );


            const result =
                await response.json();


            if (!response.ok || !result.success) {

                throw new Error(
                    result.message ||
                    "Unable to process assignment."
                );
            }


            await loadAssignmentNotifications();

            if (action === "Accept") {
                alert("Task accepted successfully.");
            }

            if (notificationPopup) {

                notificationPopup.classList.add("show");

            }

        }
        catch (error) {

            console.error(
                "Assignment response failed:",
                error
            );

            alert(
                error.message ||
                "Unable to process assignment."
            );


            buttons.forEach(element => {

                if (
                    element.tagName === "BUTTON"
                ) {
                    element.disabled = false;
                }

            });
        }
    }


    notificationButton?.addEventListener(
        "click",
        async event => {

            event.stopPropagation();

            notificationPopup?.classList.toggle("show");

            if (
                notificationPopup?.classList.contains("show")
            ) {

                await loadAssignmentNotifications();

            }

        }
    );


    closeNotifications?.addEventListener(
        "click",
        () => {

            notificationPopup?.classList.remove("show");

        }
    );


    document.addEventListener(
        "click",
        event => {

            if (
                notificationPopup &&
                !notificationPopup.contains(event.target) &&
                !notificationButton?.contains(event.target)
            ) {

                notificationPopup.classList.remove("show");

            }

        }
    );


    // Load notifications when dashboard opens.
    // This handles users who were offline.
    loadAssignmentNotifications();

    /* =====================================================
        LIVE TASK ASSIGNMENT - SIGNALR
    ===================================================== */

    if (window.signalR) {

        const notificationConnection =
            new signalR.HubConnectionBuilder()
                .withUrl("/notificationHub")
                .withAutomaticReconnect()
                .build();


        notificationConnection.on(
            "TaskAssignmentReceived",
            async (payload) => {

                console.log("TaskAssignmentReceived RECEIVED:", payload);

                try {
                    // Update badge / pending list (offline deliveries)
                    await loadAssignmentNotifications();

                    // Show a live toast for real-time delivery
                    if (payload && payload.notificationId) {
                        showLiveToast(payload);
                    }
                }
                catch (err) {
                    console.error('Error handling TaskAssignmentReceived:', err);
                }

            }
        );


        notificationConnection
            .start()
            .catch(error => {

                console.error(
                    "SignalR connection failed:",
                    error
                );

            });

    }


    /* =====================================================
       TASK MODALS
    ===================================================== */

    const taskTitle =
        document.getElementById("taskTitle");

    const taskInfo =
        document.getElementById("taskInfo");


    document.querySelectorAll(".task-item")
        .forEach(task => {

            task.addEventListener("click", () => {

                const title =
                    task.dataset.title || "Task";

                const status =
                    task.dataset.status || "Unknown";

                if (taskTitle)
                    taskTitle.textContent = title;

                if (taskInfo) {

                    taskInfo.textContent =
                        `Task #${task.dataset.id} · Status: ${status}`;

                }

                openModal("taskModal");

            });

        });


    /* =====================================================
       ACTIVITY
    ===================================================== */

    document.querySelectorAll(".activity-item")
        .forEach(item => {

            item.addEventListener("click", () => {

                if (taskTitle)
                    taskTitle.textContent =
                        item.dataset.title || "Task";

                if (taskInfo)
                    taskInfo.textContent =
                        `Task #${item.dataset.id}`;

                openModal("taskModal");

            });

        });




    /* =====================================================
       SEARCH
    ===================================================== */

    const search =
        document.getElementById("globalSearch");


    search?.addEventListener("input", () => {

        const query =
            search.value
                .trim()
                .toLowerCase();


       document.querySelectorAll(
            ".task-item, .activity-item"
        )
            .forEach(item => {

                const text =
                    item.textContent.toLowerCase();

                item.style.display =
                    !query || text.includes(query)
                        ? ""
                        : "none";

            });

    });


    /* =====================================================
       CTRL + K
    ===================================================== */

    document.addEventListener("keydown", event => {

        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "k"
        ) {

            event.preventDefault();

            search?.focus();

        }

    });


    /* =====================================================
       TASK FILTERS
    ===================================================== */

    const taskItems =
        document.querySelectorAll(".task-item");


    document.querySelectorAll(".stat")
        .forEach(stat => {

            stat.addEventListener("click", () => {

                const filter =
                    stat.dataset.stat;


                taskItems.forEach(task => {

                    const status =
                        task.dataset.status
                            .toLowerCase();


                    let show = true;


                    if (filter === "progress") {

                        show =
                            status === "in progress";

                    }


                    if (filter === "completed") {

                        show =
                            status === "completed";

                    }


                    if (filter === "hold") {

                        show =
                            status === "on hold";

                    }


                    task.style.display =
                        show ? "" : "flex";

                });


                document
                    .querySelector(".focus")
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

            });

        });


    /* =====================================================
       RESET TASK FILTER
    ===================================================== */

    document
        .getElementById("resetFilter")
        ?.addEventListener("click", () => {

            taskItems.forEach(task => {

                task.style.display = "";

            });

        });


    document
        .getElementById("showAllTasks")
        ?.addEventListener("click", () => {

            taskItems.forEach(task => {

                task.style.display = "";

            });

        });


    /* =====================================================
       LATEST TASKS
    ===================================================== */

    document
        .getElementById("latestButton")
        ?.addEventListener("click", () => {

            document
                .querySelector(".activity")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

        });


    /* =====================================================
       THEME
    ===================================================== */

    const themeButton =
        document.getElementById("themeButton");


    themeButton?.addEventListener("click", () => {

        const current =
            getComputedStyle(document.documentElement)
                .getPropertyValue("--bg")
                .trim();

        if (current === "#071321") {

            document.documentElement.style.setProperty(
                "--bg",
                "#101d30"
            );

        } else {

            document.documentElement.style.setProperty(
                "--bg",
                "#071321"
            );

        }

    });


    /* =====================================================
       SETTINGS
    ===================================================== */

    const animationSwitch =
        document.getElementById("animationSwitch");

    const compactSwitch =
        document.getElementById("compactSwitch");


    animationSwitch?.addEventListener(
        "change",
        () => {

            if (animationSwitch.checked) {

                body.classList.remove(
                    "no-motion"
                );

            } else {

                body.classList.add(
                    "no-motion"
                );

            }

        }
    );


    compactSwitch?.addEventListener(
        "change",
        () => {

            if (compactSwitch.checked) {

                document.documentElement
                    .style
                    .setProperty(
                        "--sidebar-width",
                        "220px"
                    );

            } else {

                document.documentElement
                    .style
                    .setProperty(
                        "--sidebar-width",
                        "235px"
                    );

            }

        }
    );


    /* =====================================================
       HERO PARALLAX
       Lightweight requestAnimationFrame
    ===================================================== */

    const hero =
        document.querySelector(".hero");

    const heroPhoto =
        document.querySelector(".hero-photo");


    let animationFrame = null;


    hero?.addEventListener("mousemove", event => {

        if (window.innerWidth < 900)
            return;


        if (animationFrame)
            cancelAnimationFrame(animationFrame);


        animationFrame =
            requestAnimationFrame(() => {

                const rect =
                    hero.getBoundingClientRect();


                const x =
                    (event.clientX - rect.left)
                    / rect.width
                    - .5;


                const y =
                    (event.clientY - rect.top)
                    / rect.height
                    - .5;


                if (heroPhoto) {

                    heroPhoto.style.transform =
                        `scale(1.055)
                         translate3d(${x * -6}px,
                                     ${y * -4}px,
                                     0)`;

                }

            });

    });


    hero?.addEventListener("mouseleave", () => {

        if (heroPhoto) {

            heroPhoto.style.transform =
                "scale(1.03) translate3d(0,0,0)";

        }

    });


    /* =====================================================
       PROJECT PROGRESS ANIMATION
    ===================================================== */

    document
        .querySelectorAll(".progress i")
        .forEach(progress => {

            const finalWidth =
                progress.style.width;

            progress.style.width = "0%";


            requestAnimationFrame(() => {

                setTimeout(() => {

                    progress.style.width =
                        finalWidth;

                }, 250);

            });

        });


    /* =====================================================
       INITIAL REVEAL
    ===================================================== */

    const reveal =
        document.querySelectorAll(
            ".hero, .stat, .glass-card, .project, .goal"
        );


    reveal.forEach((element, index) => {

        element.animate(
            [
                {
                    opacity: 0,
                    transform: "translateY(12px)"
                },
                {
                    opacity: 1,
                    transform: "translateY(0)"
                }
            ],
            {
                duration: 500,
                delay: Math.min(index * 45, 450),
                easing: "cubic-bezier(.2,.8,.2,1)",
                fill: "both"
            }
        );
        /* =====================================================
   LOGOUT
===================================================== */

        const logoutForm = document.getElementById("logoutForm");

        logoutForm?.addEventListener("submit", async (event) => {

            event.preventDefault();

            const button = logoutForm.querySelector(".logout-button");

            const token = logoutForm.querySelector(
                'input[name="__RequestVerificationToken"]'
            );

            if (!token) {
                console.error("Anti-forgery token not found.");
                return;
            }

            button.disabled = true;

            button.querySelector("span:last-child").textContent =
                "Logging out...";

            try {

                const response = await fetch("/Account/Logout", {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded; charset=UTF-8"
                    },

                    body:
                        `__RequestVerificationToken=${encodeURIComponent(token.value)}`
                });

                if (!response.ok) {
                    throw new Error("Logout request failed.");
                }

                const result = await response.json();

                if (result.success) {

                    window.location.href =
                        result.redirectUrl || "/Account/Login";

                } else {

                    button.disabled = false;

                    button.querySelector("span:last-child").textContent =
                        "Logout";

                    alert(result.message || "Logout failed.");

                }

            } catch (error) {

                console.error("Logout error:", error);

                button.disabled = false;

                button.querySelector("span:last-child").textContent =
                    "Logout";

                alert("Unable to logout. Please try again.");

            }

        });
    });

});