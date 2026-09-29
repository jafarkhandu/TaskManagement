document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       COMMON ELEMENTS
    ====================================================== */

    const createForm =
        document.getElementById("createProjectForm");

    const addProjectModal =
        document.getElementById("addProjectModal");

    const projectSearch =
        document.getElementById("projectSearch");

    const statusFilter =
        document.getElementById("statusFilter");

    const resetFilters =
        document.getElementById("resetFilters");

    const projectList =
        document.getElementById("projectsList");


    /* =====================================================
       CREATE PROJECT
    ====================================================== */

    if (createForm) {

        createForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                clearMessages();

                const startDate =
                    document.getElementById("StartDate")?.value;

                const endDate =
                    document.getElementById("EndDate")?.value;

                if (
                    startDate &&
                    endDate &&
                    startDate > endDate
                ) {
                    showError(
                        "Start date cannot be later than end date."
                    );

                    return;
                }

                const submitButton =
                    createForm.querySelector(
                        'button[type="submit"]'
                    );

                if (submitButton) {
                    submitButton.disabled = true;
                }

                try {

                    const formData =
                        new FormData(createForm);

                    const response =
                        await fetch(
                            createForm.action,
                            {
                                method: "POST",
                                body: formData,
                                headers: {
                                    "X-Requested-With":
                                        "XMLHttpRequest"
                                }
                            }
                        );

                    const contentType =
                        response.headers.get(
                            "content-type"
                        ) || "";

                    if (
                        !contentType.includes(
                            "application/json"
                        )
                    ) {

                        if (response.ok) {
                            window.location.reload();
                            return;
                        }

                        throw new Error(
                            "Unexpected server response."
                        );
                    }

                    const result =
                        await response.json();

                    if (
                        !response.ok ||
                        !result.success
                    ) {

                        showError(
                            result.message ||
                            "Unable to create project."
                        );

                        return;
                    }

                    /*
                     * Refresh only the project section.
                     * Full page reload is avoided.
                     */

                    await refreshProjectsFragment();

                    resetCreateForm();

                    showSuccess(
                        result.message ||
                        "Project created successfully."
                    );

                    setTimeout(function () {

                        if (
                            addProjectModal &&
                            typeof bootstrap !== "undefined"
                        ) {

                            const modal =
                                bootstrap.Modal
                                    .getInstance(
                                        addProjectModal
                                    );

                            if (modal) {
                                modal.hide();
                            }
                        }

                        clearMessages();

                    }, 700);

                }
                catch (error) {

                    console.error(
                        "Create project error:",
                        error
                    );

                    showError(
                        "Something went wrong while creating the project."
                    );

                }
                finally {

                    if (submitButton) {
                        submitButton.disabled = false;
                    }

                }

            }
        );

    }


    /* =====================================================
       SEARCH
    ====================================================== */

    if (projectSearch) {

        projectSearch.addEventListener(
            "input",
            filterProjects
        );

    }


    /* =====================================================
       STATUS FILTER
    ====================================================== */

    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            filterProjects
        );

    }


    /* =====================================================
       RESET FILTERS
    ====================================================== */

    if (resetFilters) {

        resetFilters.addEventListener("click", function () {

            // Clear search
            if (projectSearch) {
                projectSearch.value = "";
            }

            // Reset status dropdown
            if (statusFilter) {
                statusFilter.value = "";
            }

            // Apply reset
            filterProjects();

        });

    }
    /* =====================================================
       VIEW PROJECT DETAILS - EXPAND CARD
    ====================================================== */

    document.addEventListener("click", async function (event) {

        const button = event.target.closest(".view-project-btn");

        if (!button) {
            return;
        }

        const projectId = button.dataset.projectId;

        if (!projectId) {
            return;
        }

        const article = button.closest(".project-item");

        if (!article) {
            return;
        }

        const existingDetails =
            article.querySelector(".project-expanded-details");

        /* =================================================
           CLOSE CURRENTLY OPEN CARD
        ================================================= */

        if (existingDetails) {

            existingDetails.remove();

            article.classList.remove("project-expanded");

            button.innerHTML = `
            <span>⊙</span>
            View Details
        `;

            return;
        }


        /* =================================================
           CLOSE OTHER OPEN CARDS
        ================================================= */

        document
            .querySelectorAll(".project-item.project-expanded")
            .forEach(function (openArticle) {

                const details =
                    openArticle.querySelector(
                        ".project-expanded-details"
                    );

                if (details) {
                    details.remove();
                }

                openArticle.classList.remove(
                    "project-expanded"
                );

                const openButton =
                    openArticle.querySelector(
                        ".view-project-btn"
                    );

                if (openButton) {

                    openButton.innerHTML = `
                    <span>⊙</span>
                    View Details
                `;

                }

            });


        /* =================================================
           LOAD PROJECT DETAILS
        ================================================= */

        try {

            button.disabled = true;

            const response = await fetch(
                "/Admin/Projects/Details?id=" +
                encodeURIComponent(projectId)
            );

            const result = await response.json();

            if (!response.ok || !result.success) {

                alert(
                    result.message ||
                    "Unable to load project details."
                );

                return;
            }


            const project = result.data;


            /* =================================================
               CREATE EXPANDED SECTION INSIDE SAME CARD
            ================================================= */

            const detailsContainer =
                document.createElement("div");

            detailsContainer.className =
                "project-expanded-details";


            detailsContainer.innerHTML = `

            <div class="project-expanded-divider"></div>

            <div class="project-expanded-header">

                <div>
                    <span class="expanded-label">
                        PROJECT DETAILS
                    </span>

                    <h3>
                        ${escapeHtml(
                project.projectTitle || "Project"
            )}
                    </h3>
                </div>

                <span class="expanded-status">
                    ${escapeHtml(
                project.status || "-"
            )}
                </span>

            </div>


            <div class="project-expanded-grid">

                <div class="expanded-detail-box">

                    <span>Description</span>

                    <strong>
                        ${escapeHtml(
                project.description ||
                "No description provided."
            )}
                    </strong>

                </div>


                <div class="expanded-detail-box">

                    <span>Tech Stack</span>

                    <strong>
                        ${escapeHtml(
                project.techStack || "-"
            )}
                    </strong>

                </div>


                <div class="expanded-detail-box">

                    <span>Start Date</span>

                    <strong>
                        ${formatDate(project.startDate)}
                    </strong>

                </div>


                <div class="expanded-detail-box">

                    <span>End Date</span>

                    <strong>
                        ${formatDate(project.endDate)}
                    </strong>

                </div>


                <div class="expanded-detail-box">

                    <span>Status</span>

                    <strong>
                        ${escapeHtml(
                project.status || "-"
            )}
                    </strong>

                </div>

            </div>

        `;


            /* =================================================
               ADD INSIDE THE SAME PROJECT CARD
            ================================================= */

            article.appendChild(detailsContainer);

            article.classList.add(
                "project-expanded"
            );


            /* =================================================
               CHANGE BUTTON
            ================================================= */

            button.innerHTML = `
            <span>⌃</span>
            Hide Details
        `;

        }
        catch (error) {

            console.error(
                "Project details error:",
                error
            );

            alert(
                "Unable to load project details."
            );

        }
        finally {

            button.disabled = false;

        }

    });

    /* =====================================================
       MANAGE TASKS
    ====================================================== */

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    ".manage-task-btn"
                );

            if (!button) {
                return;
            }

            const projectId =
                button.dataset.projectId;

            if (!projectId) {
                return;
            }

            window.location.href =
                "/Admin/Tasks/Project/" +
                encodeURIComponent(projectId);

        }
    );


    /* =====================================================
       MORE BUTTON
       EDIT / DELETE
    ====================================================== */

    /* =====================================================
   PROJECT ACTION MENU
====================================================== */

    document.addEventListener("click", function (event) {

        const moreButton =
            event.target.closest(".project-more-btn");

        if (!moreButton) {
            return;
        }

        event.stopPropagation();

        // Close any existing action menu
        document
            .querySelectorAll(".project-more-menu")
            .forEach(function (menu) {
                menu.remove();
            });

        const projectId =
            moreButton.dataset.projectId;

        if (!projectId) {
            return;
        }

        const projectCard =
            moreButton.closest(".project-item");

        if (!projectCard) {
            return;
        }

        const menu =
            document.createElement("div");

        /*
         * IMPORTANT:
         * Keep project-more-menu class because your
         * existing Edit/Delete handlers use it.
         */
        menu.className =
            "project-more-menu project-actions-popover";

        menu.innerHTML = `

        <div class="project-actions-title">
            Project Actions
        </div>

        <div class="project-actions-divider"></div>


        <!-- EDIT -->

        <button type="button"
                class="project-action-row project-action-edit"
                data-project-id="${escapeHtml(projectId)}">

            <span class="project-action-icon edit-icon">
                ✎
            </span>

            <span class="project-action-content">

                <strong>
                    Edit Project
                </strong>

                <small>
                    Update project details
                </small>

            </span>

            <span class="project-action-arrow">
                ›
            </span>

        </button>


        <!-- DELETE -->

        <button type="button"
                class="project-action-row project-action-delete"
                data-project-id="${escapeHtml(projectId)}">

            <span class="project-action-icon delete-icon">
                ×
            </span>

            <span class="project-action-content">

                <strong>
                    Delete Project
                </strong>

                <small>
                    Remove this project
                </small>

            </span>

            <span class="project-action-arrow">
                ›
            </span>

        </button>

    `;


        /*
         * Put the menu INSIDE the project card.
         */
        projectCard.appendChild(menu);


        /*
         * Position it below the three-dot button.
         */
        const buttonRect =
            moreButton.getBoundingClientRect();

        const cardRect =
            projectCard.getBoundingClientRect();

        menu.style.top =
            `${buttonRect.bottom - cardRect.top + 8}px`;

        menu.style.right =
            `${cardRect.right - buttonRect.right}px`;


        /*
         * Animation
         */
        requestAnimationFrame(function () {

            menu.classList.add("show");

        });

    });

    /* =====================================================
       EDIT PROJECT
    ====================================================== */

    document.addEventListener(
        "click",
        async function (event) {

            const button =
                event.target.closest(
                    ".project-action-edit"
                );

            if (!button) {
                return;
            }

            const projectId =
                button.dataset.projectId;

            if (!projectId) {
                return;
            }

            document
                .querySelectorAll(
                    ".project-more-menu"
                )
                .forEach(function (menu) {
                    menu.remove();
                });

            try {

                const response =
                    await fetch(
                        "/Admin/Projects/GetById?id=" +
                        encodeURIComponent(projectId)
                    );

                if (!response.ok) {

                    alert(
                        "Unable to load project for editing."
                    );

                    return;
                }

                const project =
                    await response.json();

                if (!project) {

                    alert(
                        "Project not found."
                    );

                    return;
                }

                setInputValue(
                    "EditId",
                    project.id
                );

                setInputValue(
                    "EditProjectTitle",
                    project.projectTitle
                );

                setInputValue(
                    "EditDescription",
                    project.description
                );

                setInputValue(
                    "EditTechStack",
                    project.techStack
                );

                setInputValue(
                    "EditStatus",
                    project.status
                );

                // Edit members count removed

                setInputValue(
                    "EditStartDate",
                    formatInputDate(
                        project.startDate
                    )
                );

                setInputValue(
                    "EditEndDate",
                    formatInputDate(
                        project.endDate
                    )
                );

                const editModal =
                    document.getElementById(
                        "editProjectModal"
                    );

                if (
                    editModal &&
                    typeof bootstrap !== "undefined"
                ) {

                    bootstrap.Modal
                        .getOrCreateInstance(
                            editModal
                        )
                        .show();

                }

            }
            catch (error) {

                console.error(
                    "Edit project load error:",
                    error
                );

                alert(
                    "Unable to load project for editing."
                );

            }

        }
    );


    /* =====================================================
       UPDATE PROJECT
    ====================================================== */

    const editForm =
        document.getElementById(
            "editProjectForm"
        );

    if (editForm) {

        editForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                const submitButton =
                    editForm.querySelector(
                        'button[type="submit"]'
                    );

                if (submitButton) {
                    submitButton.disabled = true;
                }

                try {

                    const formData =
                        new FormData(editForm);

                    const response =
                        await fetch(
                            editForm.action,
                            {
                                method: "POST",
                                body: formData,
                                headers: {
                                    "X-Requested-With":
                                        "XMLHttpRequest"
                                }
                            }
                        );

                    const contentType =
                        response.headers.get(
                            "content-type"
                        ) || "";

                    if (
                        !contentType.includes(
                            "application/json"
                        )
                    ) {

                        if (response.ok) {
                            await refreshProjectsFragment();
                            closeModal(
                                "editProjectModal"
                            );
                            return;
                        }

                        throw new Error(
                            "Unexpected server response."
                        );
                    }

                    const result =
                        await response.json();

                    if (
                        !response.ok ||
                        !result.success
                    ) {

                        alert(
                            result.message ||
                            "Unable to update project."
                        );

                        return;
                    }

                    await refreshProjectsFragment();

                    closeModal(
                        "editProjectModal"
                    );

                }
                catch (error) {

                    console.error(
                        "Update project error:",
                        error
                    );

                    alert(
                        "Something went wrong while updating the project."
                    );

                }
                finally {

                    if (submitButton) {
                        submitButton.disabled = false;
                    }

                }

            }
        );

    }


    /* =====================================================
       DELETE PROJECT
    ====================================================== */

    document.addEventListener(
        "click",
        async function (event) {

            const button =
                event.target.closest(
                    ".project-action-delete"
                );

            if (!button) {
                return;
            }

            const projectId =
                button.dataset.projectId;

            if (!projectId) {
                return;
            }

            document
                .querySelectorAll(
                    ".project-more-menu"
                )
                .forEach(function (menu) {
                    menu.remove();
                });

            const confirmed =
                window.confirm(
                    "Are you sure you want to delete this project?"
                );

            if (!confirmed) {
                return;
            }

            try {

                const token =
                    getAntiForgeryToken(
                        "createProjectForm"
                    );

                const formData =
                    new FormData();

                if (token) {

                    formData.append(
                        "__RequestVerificationToken",
                        token
                    );

                }

                formData.append(
                    "id",
                    projectId
                );

                const response =
                    await fetch(
                        "/Admin/Projects/Delete",
                        {
                            method: "POST",
                            body: formData,
                            headers: {
                                "X-Requested-With":
                                    "XMLHttpRequest"
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
                        "Unable to delete project."
                    );

                    return;
                }

                await refreshProjectsFragment();

            }
            catch (error) {

                console.error(
                    "Delete project error:",
                    error
                );

                alert(
                    "Something went wrong while deleting the project."
                );

            }

        }
    );


    /* =====================================================
       MODAL RESET
    ====================================================== */

    if (addProjectModal) {

        addProjectModal.addEventListener(
            "hidden.bs.modal",
            function () {

                resetCreateForm();

                clearMessages();

            }
        );

    }


    /* =====================================================
       FUNCTIONS
    ====================================================== */


    function filterProjects() {

        if (!projectList) {
            return;
        }

        const search = (projectSearch?.value || "")
            .trim()
            .toLowerCase();

        const selectedStatus = (statusFilter?.value || "")
            .trim()
            .toLowerCase();

        const projects = projectList.querySelectorAll(
            ".project-item"
        );

        let visibleCount = 0;

        projects.forEach(function (project) {

            const title = (
                project.dataset.title || ""
            ).toLowerCase();

            const description = (
                project.dataset.description || ""
            ).toLowerCase();

            const techStack = (
                project.dataset.tech || ""
            ).toLowerCase();

            const projectStatus = (
                project.dataset.status || ""
            ).toLowerCase();

            // Search condition
            const matchesSearch =
                search === "" ||
                title.includes(search) ||
                description.includes(search) ||
                techStack.includes(search);

            // Status condition
            const matchesStatus =
                selectedStatus === "" ||
                projectStatus === selectedStatus;

            const shouldShow =
                matchesSearch && matchesStatus;

            project.style.display =
                shouldShow ? "flex" : "none";

            if (shouldShow) {
                visibleCount++;
            }

        });

        updateEmptyFilterMessage(
            visibleCount,
            projects.length
        );
    }


    function updateEmptyFilterMessage(
        visibleCount,
        totalCount
    ) {

        let message =
            document.getElementById(
                "noFilterResults"
            );

        if (
            visibleCount === 0 &&
            totalCount > 0
        ) {

            if (!message) {

                message =
                    document.createElement(
                        "div"
                    );

                message.id =
                    "noFilterResults";

                message.className =
                    "empty-project-state";

                message.innerHTML = `

                    <div class="empty-project-icon">
                        ⌕
                    </div>

                    <h3>
                        No projects found
                    </h3>

                    <p>
                        Try changing your search or filter.
                    </p>

                `;

                if (projectList) {
                    projectList.appendChild(
                        message
                    );
                }

            }

            message.style.display =
                "block";

        }
        else if (message) {

            message.style.display =
                "none";

        }

    }


    async function refreshProjectsFragment() {

        try {

            const response =
                await fetch(
                    window.location.href,
                    {
                        cache: "no-store"
                    }
                );

            if (!response.ok) {
                throw new Error(
                    "Unable to refresh projects."
                );
            }

            const html =
                await response.text();

            const parser =
                new DOMParser();

            const documentFragment =
                parser.parseFromString(
                    html,
                    "text/html"
                );

            const newProjectList =
                documentFragment.getElementById(
                    "projectsList"
                );

            const currentProjectList =
                document.getElementById(
                    "projectsList"
                );

            if (
                newProjectList &&
                currentProjectList
            ) {

                currentProjectList.innerHTML =
                    newProjectList.innerHTML;

            }

            /*
             * Update statistics.
             */

            const statisticIds = [
                "totalProjects",
                "activeProjects",
                "inProgressProjects",
                "completedProjects"
            ];

            statisticIds.forEach(
                function (id) {

                    const newElement =
                        documentFragment.getElementById(
                            id
                        );

                    const currentElement =
                        document.getElementById(
                            id
                        );

                    if (
                        newElement &&
                        currentElement
                    ) {

                        currentElement.textContent =
                            newElement.textContent;

                    }

                }
            );

            /*
             * Re-apply current filters.
             */

            filterProjects();

        }
        catch (error) {

            console.error(
                "Refresh projects error:",
                error
            );

            window.location.reload();

        }

    }


    function resetCreateForm() {

        if (!createForm) {
            return;
        }

        createForm.reset();

        const status =
            document.getElementById(
                "Status"
            );

        if (status) {
            status.value =
                "Planning";
        }

        // Members count field removed from create form

    }


    function closeModal(
        modalId
    ) {

        const modalElement =
            document.getElementById(
                modalId
            );

        if (
            modalElement &&
            typeof bootstrap !== "undefined"
        ) {

            const modal =
                bootstrap.Modal
                    .getInstance(
                        modalElement
                    );

            if (modal) {
                modal.hide();
            }

        }

    }


    function setInputValue(
        id,
        value
    ) {

        const element =
            document.getElementById(id);

        if (element) {

            element.value =
                value ?? "";

        }

    }


    function getAntiForgeryToken(
        formId
    ) {

        const form =
            document.getElementById(
                formId
            );

        if (!form) {
            return "";
        }

        const token =
            form.querySelector(
                'input[name="__RequestVerificationToken"]'
            );

        return token
            ? token.value
            : "";

    }


    function showError(
        message
    ) {

        const element =
            document.getElementById(
                "projectFormError"
            );

        if (!element) {
            return;
        }

        element.textContent =
            message;

        element.style.display =
            "block";

    }


    function showSuccess(
        message
    ) {

        const element =
            document.getElementById(
                "projectFormSuccess"
            );

        if (!element) {
            return;
        }

        element.textContent =
            message;

        element.style.display =
            "block";

    }


    function clearMessages() {

        const error =
            document.getElementById(
                "projectFormError"
            );

        const success =
            document.getElementById(
                "projectFormSuccess"
            );

        if (error) {

            error.textContent =
                "";

            error.style.display =
                "none";

        }

        if (success) {

            success.textContent =
                "";

            success.style.display =
                "none";

        }

    }


    function formatDate(
        value
    ) {

        if (!value) {
            return "-";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return value;

        }

        return date.toLocaleDateString(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

    }


    function formatInputDate(
        value
    ) {

        if (!value) {
            return "";
        }

        /*
         * Handles:
         * 2026-09-18
         * 2026-09-18T00:00:00
         */

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(value)
                .substring(0, 10);

        }

        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, "0");

        const day =
            String(
                date.getDate()
            ).padStart(2, "0");

        return `${year}-${month}-${day}`;

    }


    function getStatusClass(
        status
    ) {

        return String(
            status || "Planning"
        )
            .toLowerCase()
            .replaceAll(
                " ",
                "-"
            );

    }


    function createTechTags(
        techStack
    ) {

        if (!techStack) {
            return "";
        }

        return techStack
            .split(",")
            .map(
                function (tech) {

                    const cleanTech =
                        tech.trim();

                    if (!cleanTech) {
                        return "";
                    }

                    return `
                        <span class="tech-tag">
                            ${escapeHtml(cleanTech)}
                        </span>
                    `;

                }
            )
            .join("");

    }


    function escapeHtml(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }

        return String(value)
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );

    }

});