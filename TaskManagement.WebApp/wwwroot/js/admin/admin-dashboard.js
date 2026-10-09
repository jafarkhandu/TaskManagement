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
            subtitle: "Tasks currently counted as In Progress.",
            label: "tasks"
        },
        overdue: {
            title: "Overdue",
            subtitle: "Tasks currently counted as overdue.",
            label: "tasks"
        }
    };

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
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

    // The dashboard's Recent Projects "View All" link previously pointed to '#',
    // so it did not open the Admin Projects page. Keep the existing markup and
    // route the action to the real Admin Projects list here.
    const viewAllProjectsLink = document.querySelector('.projects-card .card-header a[href="#"]');
    viewAllProjectsLink?.addEventListener("click", event => {
        event.preventDefault();
        window.location.href = "/Admin/Projects";
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
