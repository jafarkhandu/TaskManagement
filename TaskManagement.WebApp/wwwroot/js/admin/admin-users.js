document.addEventListener("DOMContentLoaded", function () {

    const searchInput =
        document.getElementById("userSearch");

    const clearSearchBtn =
        document.getElementById("clearSearchBtn");

    const tableBody =
        document.getElementById("usersTableBody");

    const noSearchResults =
        document.getElementById("noSearchResults");

    const visibleUserCount =
        document.getElementById("visibleUserCount");

    const tokenElement =
        document.querySelector(
            'input[name="__RequestVerificationToken"]'
        );


    /* =========================================
       SEARCH USERS
    ========================================= */

    function filterUsers() {

        const searchValue =
            searchInput.value
                .trim()
                .toLowerCase();

        const rows =
            tableBody.querySelectorAll(".user-row");

        let visibleCount = 0;


        rows.forEach(function (row) {

            const searchableText =
                row.dataset.search
                    ? row.dataset.search.toLowerCase()
                    : "";


            const matches =
                searchValue === "" ||
                searchableText.includes(searchValue);


            if (matches) {

                row.classList.remove("hidden");

                visibleCount++;

            }
            else {

                row.classList.add("hidden");

            }

        });


        visibleUserCount.textContent =
            visibleCount;


        if (searchValue.length > 0) {

            clearSearchBtn.style.display =
                "inline-block";

        }
        else {

            clearSearchBtn.style.display =
                "none";

        }


        if (rows.length > 0 && visibleCount === 0) {

            noSearchResults.style.display =
                "flex";

        }
        else {

            noSearchResults.style.display =
                "none";

        }

    }


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            filterUsers
        );

    }


    /* =========================================
       CLEAR SEARCH
    ========================================= */

    if (clearSearchBtn) {

        clearSearchBtn.addEventListener(
            "click",
            function () {

                searchInput.value = "";

                filterUsers();

                searchInput.focus();

            }
        );

    }


    /* =========================================
       CTRL + K SEARCH
    ========================================= */

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


    /* =========================================
       ACTIVATE USER
    ========================================= */

    document
        .querySelectorAll(".activate-account-btn")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const userId =
                        button.dataset.userId;


                    if (!userId) {
                        return;
                    }


                    const confirmed =
                        confirm(
                            "Are you sure you want to activate this account?"
                        );


                    if (!confirmed) {
                        return;
                    }


                    button.disabled = true;

                    const originalText =
                        button.textContent;

                    button.textContent =
                        "Activating...";


                    try {

                        const response =
                            await fetch(
                                `/Admin/Users/Activate?id=${encodeURIComponent(userId)}`,
                                {
                                    method: "POST",

                                    headers: {
                                        "RequestVerificationToken":
                                            tokenElement?.value || ""
                                    }
                                }
                            );


                        const result =
                            await response.json();


                        if (
                            !response.ok ||
                            !result.success
                        ) {

                            alert(
                                result.message ||
                                "Unable to activate account."
                            );

                            button.disabled =
                                false;

                            button.textContent =
                                originalText;

                            return;
                        }


                        alert(
                            result.message ||
                            "Account activated successfully."
                        );


                        window.location.reload();

                    }
                    catch (error) {

                        console.error(
                            "Activation error:",
                            error
                        );


                        alert(
                            "Unable to connect to the server."
                        );


                        button.disabled =
                            false;

                        button.textContent =
                            originalText;

                    }

                }
            );

        });


    /* =========================================
       DEACTIVATE USER
    ========================================= */

    document
        .querySelectorAll(".deactivate-account-btn")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const userId =
                        button.dataset.userId;


                    if (!userId) {
                        return;
                    }


                    const confirmed =
                        confirm(
                            "Are you sure you want to deactivate this account?"
                        );


                    if (!confirmed) {
                        return;
                    }


                    button.disabled = true;

                    const originalText =
                        button.textContent;

                    button.textContent =
                        "Deactivating...";


                    try {

                        const response =
                            await fetch(
                                `/Admin/Users/Deactivate?id=${encodeURIComponent(userId)}`,
                                {
                                    method: "POST",

                                    headers: {
                                        "RequestVerificationToken":
                                            tokenElement?.value || ""
                                    }
                                }
                            );


                        const result =
                            await response.json();


                        if (
                            !response.ok ||
                            !result.success
                        ) {

                            alert(
                                result.message ||
                                "Unable to deactivate account."
                            );


                            button.disabled =
                                false;

                            button.textContent =
                                originalText;

                            return;
                        }


                        alert(
                            result.message ||
                            "Account deactivated successfully."
                        );


                        window.location.reload();

                    }
                    catch (error) {

                        console.error(
                            "Deactivation error:",
                            error
                        );


                        alert(
                            "Unable to connect to the server."
                        );


                        button.disabled =
                            false;

                        button.textContent =
                            originalText;

                    }

                }
            );

        });



    /* =========================================
       USER ACTION MENUS
    ========================================= */

    const actionMenus =
        document.querySelectorAll(".user-action-menu");

    function closeActionMenus(exceptMenu = null) {

        actionMenus.forEach(function (menu) {

            if (menu === exceptMenu) {
                return;
            }

            menu.classList.remove("open");

            const trigger =
                menu.querySelector(".user-action-menu-trigger");

            if (trigger) {
                trigger.setAttribute("aria-expanded", "false");
            }

        });

    }

    actionMenus.forEach(function (menu) {

        const trigger =
            menu.querySelector(".user-action-menu-trigger");

        if (!trigger) {
            return;
        }

        trigger.addEventListener("click", function (event) {

            event.stopPropagation();

            const isOpen =
                menu.classList.contains("open");

            closeActionMenus(menu);

            menu.classList.toggle("open", !isOpen);

            trigger.setAttribute(
                "aria-expanded",
                String(!isOpen)
            );

        });

    });

    document.addEventListener("click", function () {
        closeActionMenus();
    });

    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {
            closeActionMenus();

            if (summaryModal && !summaryModal.hidden) {
                closeSummaryModal();
            }
        }

    });


    /* =========================================
       USER SUMMARY CARDS / MODAL
    ========================================= */

    const summaryModal =
        document.getElementById("userSummaryModal");

    const summaryDialogBody =
        document.getElementById("userSummaryDialogBody");

    const summaryModalTitle =
        document.getElementById("userSummaryModalTitle");

    const summaryCards =
        document.querySelectorAll("[data-user-summary]");

    const summaryCloseButtons =
        document.querySelectorAll("[data-user-summary-close]");

    const userRows =
        Array.from(document.querySelectorAll(".user-row"));


    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function getInitials(name) {

        const parts =
            String(name || "U")
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2);

        return parts
            .map(function (part) {
                return part.charAt(0);
            })
            .join("")
            .toUpperCase() || "U";

    }


    function getUsers() {

        return userRows.map(function (row) {

            return {
                name: row.dataset.userName || "Unnamed User",
                email: row.dataset.userEmail || "",
                role: row.dataset.userRole || "User",
                active: row.dataset.userActive === "true",
                photo: row.dataset.userPhoto || ""
            };

        });

    }


    function renderUserItem(user) {

        const safeName =
            escapeHtml(user.name);

        const safeEmail =
            escapeHtml(user.email);

        const safeRole =
            escapeHtml(user.role);

        const avatar =
            user.photo
                ? `<img src="${escapeHtml(user.photo)}" alt="">`
                : escapeHtml(getInitials(user.name));

        const roleClass =
            user.role.toLowerCase() === "admin"
                ? "user-summary-role-admin"
                : user.role.toLowerCase() === "manager"
                    ? "user-summary-role-manager"
                    : "";

        return `
            <div class="user-summary-user">
                <span class="user-summary-user-avatar">
                    ${avatar}
                </span>

                <span class="user-summary-user-info">
                    <span class="user-summary-user-name">
                        ${safeName}
                    </span>

                    <span class="user-summary-user-meta">
                        ${safeEmail || "No email available"}
                    </span>
                </span>

                <span class="user-summary-role ${roleClass}">
                    ${safeRole}
                </span>
            </div>
        `;

    }


    function renderUserList(title, users) {

        if (!users.length) {

            return `
                <section class="user-summary-section">
                    <h3 class="user-summary-section-title">
                        ${escapeHtml(title)}
                    </h3>

                    <div class="user-summary-empty">
                        No users in this category.
                    </div>
                </section>
            `;

        }

        return `
            <section class="user-summary-section">
                <h3 class="user-summary-section-title">
                    ${escapeHtml(title)}
                </h3>

                <div class="user-summary-list">
                    ${users.map(renderUserItem).join("")}
                </div>
            </section>
        `;

    }


    function renderAdministratorList(users) {

        const admins =
            users.filter(function (user) {
                return user.role.toLowerCase() === "admin";
            });

        const managers =
            users.filter(function (user) {
                return user.role.toLowerCase() === "manager";
            });

        return [
            renderUserList("Special Admin", admins),
            renderUserList("Manager", managers)
        ].join("");

    }


    function openSummaryModal(type) {

        if (!summaryModal || !summaryDialogBody || !summaryModalTitle) {
            return;
        }

        const users = getUsers();

        let title = "Users";
        let body = "";

        if (type === "total") {

            title = "All Users";
            body = renderUserList("All Users", users);

        }
        else if (type === "active") {

            title = "Active Users";
            body = renderUserList(
                "Active Users",
                users.filter(function (user) {
                    return user.active;
                })
            );

        }
        else if (type === "inactive") {

            title = "Inactive Users";
            body = renderUserList(
                "Inactive Users",
                users.filter(function (user) {
                    return !user.active;
                })
            );

        }
        else if (type === "administrators") {

            title = "Administrators";
            body = renderAdministratorList(users);

        }

        summaryModalTitle.textContent = title;
        summaryDialogBody.innerHTML = body;

        summaryModal.hidden = false;
        summaryModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("user-summary-modal-open");

        const closeButton =
            summaryModal.querySelector(".user-summary-modal-close");

        closeButton?.focus();

    }


    function closeSummaryModal() {

        if (!summaryModal) {
            return;
        }

        summaryModal.hidden = true;
        summaryModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("user-summary-modal-open");

    }


    summaryCards.forEach(function (card) {

        card.addEventListener("click", function () {

            openSummaryModal(
                card.dataset.userSummary
            );

        });

    });


    summaryCloseButtons.forEach(function (button) {

        button.addEventListener("click", closeSummaryModal);

    });

});