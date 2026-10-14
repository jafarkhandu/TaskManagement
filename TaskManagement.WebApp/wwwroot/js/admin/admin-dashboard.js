document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("adminStatModal");
    const closeButton = document.getElementById("adminStatModalClose");
    const title = document.getElementById("adminStatModalTitle");
    const subtitle = document.getElementById("adminStatModalSubtitle");
    const count = document.getElementById("adminStatModalCount");
    const countLabel = document.getElementById("adminStatModalCountLabel");
    const list = document.getElementById("adminStatModalList");
    const data = document.getElementById("adminStatModalData");

    if (!modal || !data) return;

    const stats = {
        projects: {
            title: "Total Projects",
            subtitle: "All projects currently represented on the dashboard.",
            label: "projects"
        },
        tasks: {
            title: "Total Tasks",
            subtitle: "Task distribution available from the dashboard.",
            label: "tasks"
        },
        progress: {
            title: "In Progress",
            subtitle: "Only tasks currently in In Progress status.",
            label: "tasks"
        },
        overdue: {
            title: "Overdue",
            subtitle: "Only tasks currently past their expected end date and not completed.",
            label: "tasks"
        }
    };

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    function formatTaskDate(value) {
        if (!value) return "No due date";

        // Treat the persisted calendar date as a calendar date rather than
        // converting it through UTC. This prevents a one-day shift in the
        // dashboard modal for users in positive UTC offsets.
        const datePart = String(value).split("T")[0];
        const parts = datePart.split("-").map(Number);

        if (parts.length === 3 && parts.every(Number.isFinite)) {
            const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
            return localDate.toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
        }

        return String(value);
    }

    function closeModal() {
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    async function loadAllProjects() {
        try {
            list.innerHTML = '<div class="admin-stat-modal-note"><strong>Loading projects...</strong></div>';

            const response = await fetch("/Admin/Dashboard/AllProjects", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            if (!response.ok) {
                throw new Error("Unable to load projects.");
            }

            const projects = await response.json();

            if (!Array.isArray(projects) || projects.length === 0) {
                list.innerHTML = '<div class="admin-stat-modal-note"><strong>No projects found.</strong></div>';
                return;
            }

            list.innerHTML = projects.map(project => `
                <a class="admin-stat-modal-item"
                   href="${escapeHtml(project.url || "#")}">
                    <span class="admin-stat-modal-item-icon">▱</span>
                    <span class="admin-stat-modal-item-main">
                        <strong>${escapeHtml(project.projectTitle)}</strong>
                        <small>${escapeHtml(project.description || "No description available.")}</small>
                    </span>
                    <span class="admin-stat-modal-item-meta">${Number(project.taskCount) || 0} tasks</span>
                </a>
            `).join("");
        }
        catch (error) {
            console.warn("Admin project summary could not be loaded:", error);
            const template = data.querySelector('[data-stat-template="projects"]');
            list.innerHTML = template?.innerHTML || "";
        }
    }

    async function loadTaskSummary(filter) {
        const loadingLabel = filter === "upcoming"
            ? "Loading upcoming deadlines..."
            : filter === "inprogress"
                ? "Loading In Progress tasks..."
                : "Loading overdue tasks...";

        const emptyLabel = filter === "upcoming"
            ? "No upcoming deadlines found."
            : filter === "inprogress"
                ? "No In Progress tasks found."
                : "No overdue tasks found.";

        try {
            list.innerHTML = `<div class="admin-stat-modal-note"><strong>${loadingLabel}</strong></div>`;

            const response = await fetch(
                `/Admin/Dashboard/TaskSummary?filter=${encodeURIComponent(filter)}`,
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store",
                    headers: {
                        "X-Requested-With": "XMLHttpRequest"
                    }
                }
            );

            if (!response.ok) {
                throw new Error("Unable to load dashboard tasks.");
            }

            const result = await response.json();
            const tasks = Array.isArray(result.tasks) ? result.tasks : [];

            count.textContent = String(tasks.length);

            if (tasks.length === 0) {
                list.innerHTML = `<div class="admin-stat-modal-note"><strong>${emptyLabel}</strong></div>`;
                return;
            }

            const iconClass = filter === "upcoming"
                ? "orange"
                : filter === "overdue"
                    ? "red"
                    : "orange";
            const icon = filter === "overdue" ? "!" : filter === "inprogress" ? "◷" : "▣";

            list.innerHTML = tasks.map(task => {
                const date = formatTaskDate(task.expectedEndDate);
                const priority = task.priority || "No priority";

                return `
                    <a class="admin-stat-modal-item"
                       href="${escapeHtml(task.url || "#")}">
                        <span class="admin-stat-modal-item-icon ${iconClass}">${icon}</span>
                        <span class="admin-stat-modal-item-main">
                            <strong>${escapeHtml(task.title)}</strong>
                            <small>${escapeHtml(task.projectTitle)} · Due ${escapeHtml(date)}</small>
                        </span>
                        <span class="admin-stat-modal-item-meta">${escapeHtml(priority)}</span>
                    </a>
                `;
            }).join("");
        }
        catch (error) {
            console.warn("Admin dashboard task summary could not be loaded:", error);
            list.innerHTML = '<div class="admin-stat-modal-note"><strong>Unable to load these tasks right now.</strong><small>Please try again.</small></div>';
        }
    }

    function openModal(type) {
        const info = stats[type];
        const template = data.querySelector('[data-stat-template="' + type + '"]');
        const card = document.querySelector('[data-admin-stat="' + type + '"]');

        if (!info || !template || !card) return;

        title.textContent = info.title;
        subtitle.textContent = info.subtitle;
        count.textContent =
            card.querySelector(".stat-content strong")?.textContent.trim() || "0";
        countLabel.textContent = info.label;
        list.innerHTML = template.innerHTML;

        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        if (type === "projects") {
            loadAllProjects();
        }
        else if (type === "progress") {
            loadTaskSummary("inprogress");
        }
        else if (type === "overdue") {
            loadTaskSummary("overdue");
        }
    }

    function openUpcomingDeadlines() {
        title.textContent = "Upcoming Deadlines";
        subtitle.textContent = "All tasks with an expected end date from now onward.";
        count.textContent = "0";
        countLabel.textContent = "tasks";
        list.innerHTML = '<div class="admin-stat-modal-note"><strong>Loading upcoming deadlines...</strong></div>';

        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        loadTaskSummary("upcoming");
    }

    document.querySelectorAll(".admin-stat-clickable").forEach(card => {
        card.addEventListener("click", () => openModal(card.dataset.adminStat));

        card.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openModal(card.dataset.adminStat);
            }
        });
    });

    // Task Overview period selector.
    const taskOverviewSelect = document.querySelector('.chart-card .chart-select');
    const taskOverviewLegendValues = document.querySelectorAll('.chart-card .chart-legend strong');

    async function loadTaskOverview(period) {
        if (!taskOverviewSelect || taskOverviewLegendValues.length < 2) {
            return;
        }

        try {
            taskOverviewSelect.disabled = true;

            const response = await fetch(
                `/Admin/Dashboard/TaskOverview?period=${encodeURIComponent(period)}`,
                {
                    method: 'GET',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Unable to load task overview.');
            }

            const result = await response.json();

            if (!result?.success) {
                throw new Error(result?.message || 'Unable to load task overview.');
            }

            taskOverviewLegendValues[0].textContent = String(result.createdCount ?? 0);
            taskOverviewLegendValues[1].textContent = String(result.completedCount ?? 0);
        }
        catch (error) {
            console.warn('Task overview could not be loaded:', error);
        }
        finally {
            taskOverviewSelect.disabled = false;
        }
    }

    taskOverviewSelect?.addEventListener('change', function () {
        const periodMap = {
            'This Week': 'week',
            'This Month': 'month',
            'This Year': 'year'
        };

        loadTaskOverview(periodMap[this.value] || 'month');
    });

    if (taskOverviewSelect) {
        const initialPeriod = taskOverviewSelect.value === 'This Week'
            ? 'week'
            : taskOverviewSelect.value === 'This Year'
                ? 'year'
                : 'month';

        loadTaskOverview(initialPeriod);
    }

    // Recent Projects keeps its existing View All behavior.
    const viewAllProjectsLink = document.querySelector('.projects-card .card-header a[href="#"]');
    viewAllProjectsLink?.addEventListener("click", event => {
        event.preventDefault();
        window.location.href = "/Admin/Projects";
    });

    // Upcoming Deadlines uses the same accessible dashboard modal so all
    // upcoming records can be reviewed without leaving the dashboard.
    const viewAllDeadlinesLink = document.querySelector('.deadlines-card .card-header a[href="#"]');
    viewAllDeadlinesLink?.addEventListener("click", event => {
        event.preventDefault();
        openUpcomingDeadlines();
    });

    closeButton?.addEventListener("click", closeModal);

    modal.addEventListener("click", event => {
        if (event.target === modal) closeModal();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modal.classList.contains("show")) {
            closeModal();
        }
    });
});
