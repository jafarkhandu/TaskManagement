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
            subtitle: "Projects currently represented on the dashboard.",
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

    function closeModal() {
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
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
