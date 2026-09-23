(function () {

    'use strict';

    document.addEventListener('DOMContentLoaded', function () {

        /* =====================================================
           REAL BACKEND DATA
        ===================================================== */

        const projectId =
            Number(window.currentProjectId || 0);

        const tasks =
            Array.isArray(window.projectTaskData)
                ? window.projectTaskData
                : [];


        console.log('Project ID:', projectId);
        console.log('REAL TASK DATA:', tasks);


        /* =====================================================
           ELEMENTS
        ===================================================== */

        const board =
            document.getElementById('taskBoard');

        const searchInput =
            document.getElementById('taskSearch');

        const statusFilter =
            document.getElementById('taskStatusFilter');

        const priorityFilter =
            document.getElementById('taskPriorityFilter');

        const assigneeFilter =
            document.getElementById('taskAssigneeFilter');

        const resetButton =
            document.getElementById('resetTaskFilters');


        /* =====================================================
           HELPERS
        ===================================================== */

        function escapeHtml(value) {

            if (
                value === null ||
                value === undefined
            ) {
                return '';
            }

            return String(value)
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }


        function formatDate(value) {

            if (!value) {
                return '-';
            }

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return '-';
            }

            return date.toLocaleDateString(
                'en-GB',
                {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }
            );
        }


        function formatInputDate(value) {

            if (!value) {
                return '';
            }

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return '';
            }

            return date.toISOString().substring(0, 10);
        }


        function getInitials(name) {

            if (!name) {
                return '?';
            }

            return name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map(x => x.charAt(0))
                .join('')
                .toUpperCase();
        }


        function priorityClass(priority) {

            return String(priority || 'Low')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '-');
        }


        function getToken() {

            return document.querySelector(
                'input[name="__RequestVerificationToken"]'
            )?.value || '';
        }


        async function readJson(response) {

            try {
                return await response.json();
            }
            catch {
                return null;
            }
        }


        /* =====================================================
           IMPORTANT:
           NORMALIZE REAL BACKEND STATUS
           
           This is the actual fix.
        ===================================================== */

        function normalizeStatus(status) {

            const value =
                String(status || '')
                    .trim()
                    .toLowerCase()
                    .replace(/[_-]/g, ' ')
                    .replace(/\s+/g, ' ');


            if (
                value === 'pending' ||
                value === 'todo' ||
                value === 'to do' ||
                value === 'not started' ||
                value === 'new'
            ) {
                return 'Pending';
            }


            if (
                value === 'in progress' ||
                value === 'inprogress' ||
                value === 'working' ||
                value === 'started'
            ) {
                return 'In Progress';
            }


            if (
                value === 'on hold' ||
                value === 'onhold' ||
                value === 'hold' ||
                value === 'paused'
            ) {
                return 'On Hold';
            }


            if (
                value === 'completed' ||
                value === 'complete' ||
                value === 'done' ||
                value === 'finished'
            ) {
                return 'Completed';
            }


            if (
                value === 'cancelled' ||
                value === 'canceled'
            ) {
                return 'Cancelled';
            }


            /*
             * Unknown status:
             * keep it as Pending visually instead of
             * losing the task from the board.
             */
            return 'Pending';
        }


        /* =====================================================
           PROJECT DETAILS
        ===================================================== */

        async function loadProject() {

            if (!projectId) {
                return;
            }

            try {

                const response =
                    await fetch(
                        '/Admin/Projects/GetById?id=' +
                        encodeURIComponent(projectId),
                        {
                            headers: {
                                'X-Requested-With':
                                    'XMLHttpRequest'
                            }
                        }
                    );


                if (!response.ok) {
                    return;
                }


                const project =
                    await response.json();


                document.getElementById(
                    'projectTitle'
                ).textContent =
                    project.projectTitle ||
                    'Project';


                document.getElementById(
                    'projectInitial'
                ).textContent =
                    getInitials(
                        project.projectTitle
                    ).charAt(0);


                document.getElementById(
                    'projectDescription'
                ).textContent =
                    project.description ||
                    'No project description';


                document.getElementById(
                    'projectStatus'
                ).textContent =
                    project.status || '-';


                document.getElementById(
                    'projectStart'
                ).textContent =
                    formatDate(
                        project.startDate
                    );


                document.getElementById(
                    'projectEnd'
                ).textContent =
                    formatDate(
                        project.endDate
                    );


                document.getElementById(
                    'projectTech'
                ).textContent =
                    project.techStack || '-';


                calculateProjectProgress(
                    project
                );

            }
            catch (error) {

                console.error(
                    'Project loading error:',
                    error
                );

            }
        }


        /* =====================================================
           PROJECT PROGRESS
        ===================================================== */

        function calculateProjectProgress(project) {

            const total =
                tasks.length;


            const completed =
                tasks.filter(
                    task =>
                        normalizeStatus(
                            task.status
                        ) === 'Completed'
                ).length;


            const percent =
                total === 0
                    ? 0
                    : Math.round(
                        (completed / total) * 100
                    );


            document.getElementById(
                'projectProgressPercent'
            ).textContent =
                percent + '%';


            document.getElementById(
                'projectProgressBar'
            ).style.width =
                percent + '%';


            if (project.endDate) {

                const end =
                    new Date(
                        project.endDate
                    );

                const today =
                    new Date();

                today.setHours(
                    0,
                    0,
                    0,
                    0
                );

                end.setHours(
                    0,
                    0,
                    0,
                    0
                );


                const days =
                    Math.ceil(
                        (end - today) /
                        (1000 * 60 * 60 * 24)
                    );


                const element =
                    document.getElementById(
                        'daysRemaining'
                    );


                if (days < 0) {

                    element.textContent =
                        Math.abs(days) +
                        ' days overdue';

                }
                else if (days === 0) {

                    element.textContent =
                        'Due today';

                }
                else {

                    element.textContent =
                        days +
                        ' days left';

                }
            }
        }


        /* =====================================================
           STATS
        ===================================================== */

        function renderStats() {

            const normalized =
                tasks.map(
                    task => ({
                        ...task,
                        normalizedStatus:
                            normalizeStatus(
                                task.status
                            )
                    })
                );


            document.getElementById(
                'totalTasks'
            ).textContent =
                normalized.length;


            document.getElementById(
                'pendingTasks'
            ).textContent =
                normalized.filter(
                    x =>
                        x.normalizedStatus ===
                        'Pending'
                ).length;


            document.getElementById(
                'progressTasks'
            ).textContent =
                normalized.filter(
                    x =>
                        x.normalizedStatus ===
                        'In Progress'
                ).length;


            document.getElementById(
                'holdTasks'
            ).textContent =
                normalized.filter(
                    x =>
                        x.normalizedStatus ===
                        'On Hold'
                ).length;


            document.getElementById(
                'completedTasks'
            ).textContent =
                normalized.filter(
                    x =>
                        x.normalizedStatus ===
                        'Completed'
                ).length;
        }


        /* =====================================================
           ASSIGNEE FILTER
        ===================================================== */

        function populateAssignees() {

            const people =
                new Map();


            tasks.forEach(
                task => {

                    const id =
                        task.assignedToUserId;


                    if (!id) {
                        return;
                    }


                    const name =
                        task.assignedToUserName ||
                        id;


                    people.set(
                        id,
                        name
                    );
                }
            );


            people.forEach(
                function (name, id) {

                    const option =
                        document.createElement(
                            'option'
                        );


                    option.value =
                        id;


                    option.textContent =
                        name;


                    assigneeFilter.appendChild(
                        option
                    );
                }
            );
        }


        /* =====================================================
           KANBAN COLUMNS
        ===================================================== */

        const columns = [

            {
                status: 'Pending',
                title: 'To Do',
                className: ''
            },

            {
                status: 'In Progress',
                title: 'In Progress',
                className: 'in-progress'
            },

            {
                status: 'On Hold',
                title: 'On Hold',
                className: 'on-hold'
            },

            {
                status: 'Completed',
                title: 'Completed',
                className: 'completed'
            }

        ];


        /* =====================================================
           CREATE TASK CARD
        ===================================================== */

        function createTaskCard(task) {

            const card = document.createElement('article');

            const assignee =
                task.assignedToUserName ||
                task.assignedToUserId ||
                'Unassigned';

            card.className = 'task-card';

            card.innerHTML = `
        
        <div class="task-card-top">

            <div>
                <span class="task-id">
                    TASK-${task.id}
                </span>

                <h4 class="task-card-title">
                    ${escapeHtml(task.title || 'Untitled Task')}
                </h4>
            </div>

            <span class="task-priority priority-${priorityClass(task.priority)}">
                ${escapeHtml(task.priority || 'Low')}
            </span>

        </div>


        <p class="task-card-scenario">
            ${escapeHtml(
                task.scenario ||
                'No scenario provided.'
            )}
        </p>


        <div class="task-card-info">

            <div>
                <span class="info-label">
                    Assigned To
                </span>

                <span class="task-assignee">
                    <span class="assignee-avatar">
                        ${escapeHtml(getInitials(assignee))}
                    </span>

                    ${escapeHtml(assignee)}
                </span>
            </div>


            <div>
                <span class="info-label">
                    Deadline
                </span>

                <span>
                    ${formatDate(task.expectedEndDate)}
                </span>
            </div>

        </div>


        <div class="task-card-bottom">

            <strong class="task-amount">
                ₹ ${Number(task.amount || 0).toFixed(2)}
            </strong>

            <div class="task-actions">

                <button
                    type="button"
                    class="task-action task-details-btn"
                    data-task-id="${task.id}">
                    Details
                </button>

                <button
                    type="button"
                    class="task-action task-edit-btn"
                    data-task-id="${task.id}">
                    Edit
                </button>

                <button
                    type="button"
                    class="task-action task-delete-btn delete"
                    data-task-id="${task.id}">
                    Delete
                </button>

            </div>

        </div>
    `;

            return card;
        }

        const allTasksTrigger =
            document.getElementById('allTasksTrigger');


        if (allTasksTrigger) {

            allTasksTrigger.addEventListener(
                'click',
                function () {

                    const container =
                        document.getElementById(
                            'allTasksContainer'
                        );

                    const count =
                        document.getElementById(
                            'allTasksCount'
                        );


                    container.innerHTML = '';


                    if (!tasks.length) {

                        container.innerHTML = `
                    <div class="all-tasks-empty">
                        <div class="empty-icon">✓</div>
                        <h4>No tasks found</h4>
                        <p>
                            This project does not have
                            any tasks yet.
                        </p>
                    </div>
                `;

                        count.textContent =
                            '0 tasks';

                    }
                    else {

                        tasks.forEach(
                            function (task) {

                                const assignee =
                                    task.assignedToUserName ||
                                    task.assignedToUserId ||
                                    'Unassigned';


                                const row =
                                    document.createElement(
                                        'div'
                                    );


                                row.className =
                                    'all-task-row';


                                row.innerHTML = `

                            <div class="all-task-main">

                                <span class="all-task-id">
                                    TASK-${task.id}
                                </span>

                                <strong>
                                    ${escapeHtml(
                                    task.title ||
                                    'Untitled Task'
                                )}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                    task.scenario ||
                                    'No scenario'
                                )}
                                </small>

                            </div>


                            <span class="all-task-status">
                                ${escapeHtml(
                                    task.status ||
                                    'Pending'
                                )}
                            </span>


                            <span class="all-task-priority">
                                ${escapeHtml(
                                    task.priority ||
                                    'Low'
                                )}
                            </span>


                            <span class="all-task-assignee">
                                ${escapeHtml(
                                    assignee
                                )}
                            </span>


                            <strong class="all-task-amount">
                                ₹ ${Number(
                                    task.amount || 0
                                ).toFixed(2)}
                            </strong>


                            <button
                                type="button"
                                class="all-task-view task-details-btn"
                                data-task-id="${task.id}">

                                View

                            </button>

                        `;


                                container.appendChild(
                                    row
                                );

                            }
                        );


                        count.textContent =
                            tasks.length +
                            (
                                tasks.length === 1
                                    ? ' task'
                                    : ' tasks'
                            );

                    }


                    bootstrap.Modal
                        .getOrCreateInstance(
                            document.getElementById(
                                'allTasksModal'
                            )
                        )
                        .show();

                }
            );

        }

        /* =====================================================
           RENDER BOARD
        ===================================================== */

        function renderBoard() {

            if (!board) {
                return;
            }


            const search =
                (
                    searchInput.value ||
                    ''
                )
                    .trim()
                    .toLowerCase();


            const selectedStatus =
                statusFilter.value;


            const selectedPriority =
                priorityFilter.value;


            const selectedAssignee =
                assigneeFilter.value;


            const filtered =
                tasks.filter(
                    function (task) {

                        const title =
                            String(
                                task.title || ''
                            ).toLowerCase();


                        const scenario =
                            String(
                                task.scenario || ''
                            ).toLowerCase();


                        const normalizedStatus =
                            normalizeStatus(
                                task.status
                            );


                        const matchesSearch =
                            !search ||
                            title.includes(search) ||
                            scenario.includes(search);


                        const matchesStatus =
                            !selectedStatus ||
                            normalizedStatus ===
                            selectedStatus;


                        const matchesPriority =
                            !selectedPriority ||
                            task.priority ===
                            selectedPriority;


                        const matchesAssignee =
                            !selectedAssignee ||
                            task.assignedToUserId ===
                            selectedAssignee;


                        return (
                            matchesSearch &&
                            matchesStatus &&
                            matchesPriority &&
                            matchesAssignee
                        );
                    }
                );


            board.innerHTML = '';


            columns.forEach(
                function (column) {

                    const columnTasks =
                        filtered.filter(
                            task =>
                                normalizeStatus(
                                    task.status
                                ) === column.status
                        );


                    const columnElement =
                        document.createElement(
                            'div'
                        );


                    columnElement.className =
                        'task-column ' +
                        column.className;


                    columnElement.innerHTML = `

                        <div class="task-column-header">

                            <span class="column-dot"></span>

                            <h3>
                                ${column.title}
                            </h3>

                            <span class="column-count">
                                ${columnTasks.length}
                            </span>

                            <button type="button"
                                    class="column-add"
                                    data-column-status="${column.status}">
                                +
                            </button>

                        </div>


                        <div class="task-column-body"></div>

                    `;


                    const body =
                        columnElement.querySelector(
                            '.task-column-body'
                        );


                    if (
                        columnTasks.length === 0
                    ) {

                        body.innerHTML = `

                            <div class="column-empty">

                                <span>
                                    ○
                                </span>

                                <strong>
                                    No tasks here
                                </strong>

                                <small>
                                    Tasks will appear here.
                                </small>

                            </div>

                        `;

                    }
                    else {

                        columnTasks.forEach(
                            function (task) {

                                body.appendChild(
                                    createTaskCard(
                                        task
                                    )
                                );

                            }
                        );

                    }


                    board.appendChild(
                        columnElement
                    );

                }
            );


            const emptyState =
                document.getElementById(
                    'taskEmptyState'
                );


            if (filtered.length === 0) {

                board.style.display =
                    'none';

                emptyState.style.display =
                    'block';

            }
            else {

                board.style.display =
                    'grid';

                emptyState.style.display =
                    'none';

            }
        }


        /* =====================================================
            FILTERS
        ===================================================== */

        searchInput.addEventListener(
            'input',
            renderBoard
        );


        statusFilter.addEventListener(
            'change',
            renderBoard
        );


        priorityFilter.addEventListener(
            'change',
            renderBoard
        );


        assigneeFilter.addEventListener(
            'change',
            renderBoard
        );


        resetButton.addEventListener(
            'click',
            function () {

                searchInput.value = '';

                statusFilter.value = '';

                priorityFilter.value = '';

                assigneeFilter.value = '';

                renderBoard();

            }
        );


        /* =====================================================
           LIVE UPDATES - SIGNALR
        ===================================================== */

        if (window.signalR && projectId > 0) {

            const adminNotificationConnection =
                new signalR.HubConnectionBuilder()
                    .withUrl('/notificationHub')
                    .withAutomaticReconnect()
                    .build();


            function adminShowToast(message) {

                try {

                    const el =
                        document.createElement('div');

                    el.className =
                        'admin-status-toast';

                    el.style.position = 'fixed';
                    el.style.right = '20px';
                    el.style.top = '20px';
                    el.style.background = '#2d9cdb';
                    el.style.color = '#fff';
                    el.style.padding = '10px 14px';
                    el.style.borderRadius = '6px';
                    el.style.boxShadow =
                        '0 6px 18px rgba(0,0,0,0.12)';
                    el.style.zIndex = '10000';

                    el.textContent = message;

                    document.body.appendChild(el);

                    setTimeout(
                        function () {

                            el.style.opacity = '0';

                            setTimeout(
                                function () {
                                    el.remove();
                                },
                                300
                            );

                        },
                        3500
                    );

                }
                catch (error) {

                    console.error(
                        'Toast error:',
                        error
                    );

                }

            }


            /* ==========================================
               TASK STATUS CHANGED
            ========================================== */

            adminNotificationConnection.on(
                'TaskStatusChanged',
                function (payload) {

                    console.log(
                        'ADMIN RECEIVED TaskStatusChanged:',
                        payload
                    );


                    if (!payload) {
                        return;
                    }


                    const incomingProjectId =
                        Number(
                            payload.projectId ??
                            payload.ProjectId ??
                            0
                        );


                    if (
                        incomingProjectId !==
                        Number(projectId)
                    ) {
                        return;
                    }


                    const taskId =
                        Number(
                            payload.taskId ??
                            payload.TaskId ??
                            0
                        );


                    const newStatus =
                        payload.newStatus ??
                        payload.NewStatus ??
                        '';


                    if (!taskId || !newStatus) {
                        return;
                    }


                    const taskIndex =
                        tasks.findIndex(
                            function (task) {

                                return Number(task.id) ===
                                    taskId;

                            }
                        );


                    if (taskIndex === -1) {

                        console.warn(
                            'Task not found in admin board:',
                            taskId
                        );

                        return;
                    }


                    /* Remove task from old position */

                    const movedTask =
                        tasks.splice(
                            taskIndex,
                            1
                        )[0];


                    /* Update status */

                    movedTask.status =
                        normalizeStatus(
                            newStatus
                        );


                    /*
                     * Put task at the beginning.
                     * Therefore it appears at the TOP
                     * of the new status column.
                     */

                    tasks.unshift(
                        movedTask
                    );


                    /* Update statistics */

                    renderStats();


                    /* Re-render board */

                    renderBoard();


                    /* Show notification */

                    adminShowToast(
                        `Task ${taskId} moved to ${movedTask.status}`
                    );

                }
            );


            /* ==========================================
               RECONNECT
            ========================================== */

            adminNotificationConnection.onreconnected(
                async function () {

                    console.log(
                        'Admin SignalR reconnected.'
                    );


                    try {

                        await adminNotificationConnection
                            .invoke(
                                'JoinProjectGroup',
                                projectId
                            );


                        console.log(
                            'Rejoined project group:',
                            projectId
                        );

                    }
                    catch (error) {

                        console.error(
                            'Failed to rejoin project group:',
                            error
                        );

                    }

                }
            );


            /* ==========================================
               START SIGNALR
            ========================================== */

            async function startAdminSignalR() {

                try {

                    await adminNotificationConnection
                        .start();


                    console.log(
                        'Admin SignalR connected.'
                    );


                    await adminNotificationConnection
                        .invoke(
                            'JoinProjectGroup',
                            projectId
                        );


                    console.log(
                        'Admin joined project group:',
                        projectId
                    );

                }
                catch (error) {

                    console.error(
                        'Admin SignalR connection failed:',
                        error
                    );


                    setTimeout(
                        startAdminSignalR,
                        5000
                    );

                }

            }


            startAdminSignalR();

        }
        else {

            console.error(
                'SignalR library not loaded.'
            );

        }


        /* =====================================================
           ADD TASK
        ===================================================== */

        const addTaskForm =
            document.getElementById(
                'addTaskForm'
            );


        const addAssignedTo =
            document.getElementById(
                'addAssignedTo'
            );


        async function loadMembers(select) {

            if (!select) {
                return;
            }


            select.innerHTML =
                '<option value="">Loading users...</option>';


            try {

                const response =
                    await fetch(
                        '/Admin/Tasks/Users?_=' +
                        Date.now(),
                        {
                            headers: {
                                'X-Requested-With':
                                    'XMLHttpRequest',
                                'Accept':
                                    'application/json'
                            },
                            cache: 'no-store'
                        }
                    );


                const data =
                    await response.json();


                const users =
                    Array.isArray(data?.users)
                        ? data.users
                        : [];


                select.innerHTML =
                    '<option value="">Select User</option>';


                users.forEach(
                    function (user) {

                        const option =
                            document.createElement(
                                'option'
                            );


                        option.value =
                            user.id ||
                            user.userId ||
                            '';


                        option.textContent =
                            user.fullName ||
                            user.email ||
                            'User';


                        select.appendChild(
                            option
                        );

                    }
                );

            }
            catch (error) {

                console.error(
                    'User loading error:',
                    error
                );

                select.innerHTML =
                    '<option value="">Unable to load users</option>';

            }
        }


        document.getElementById(
            'addTaskModal'
        )?.addEventListener(
            'shown.bs.modal',
            function () {

                loadMembers(
                    addAssignedTo
                );

            }
        );


        addTaskForm?.addEventListener(
            'submit',
            async function (event) {

                event.preventDefault();


                const formData =
                    new FormData(
                        addTaskForm
                    );


                formData.set(
                    'ProjectId',
                    projectId
                );


                try {

                    const response =
                        await fetch(
                            addTaskForm.action,
                            {
                                method: 'POST',
                                headers: {
                                    'X-Requested-With':
                                        'XMLHttpRequest'
                                },
                                body:
                                    formData
                            }
                        );


                    const data =
                        await readJson(
                            response
                        );


                    if (
                        response.ok &&
                        data?.success
                    ) {

                        window.location.reload();

                        return;
                    }


                    const error =
                        document.getElementById(
                            'addTaskError'
                        );


                    error.textContent =
                        data?.message ||
                        'Unable to create task.';


                    error.style.display =
                        'block';

                }
                catch (error) {

                    console.error(
                        'Create task error:',
                        error
                    );

                }

            }
        );


        /* =====================================================
           EDIT
        ===================================================== */

        document.addEventListener(
            'click',
            async function (event) {

                const button =
                    event.target.closest(
                        '.task-edit-btn'
                    );


                if (!button) {
                    return;
                }


                const taskId =
                    button.dataset.taskId;


                try {

                    const response =
                        await fetch(
                            '/Admin/Tasks/Get?id=' +
                            encodeURIComponent(
                                taskId
                            )
                        );


                    const task =
                        await response.json();


                    document.getElementById(
                        'editTaskId'
                    ).value =
                        task.id;


                    document.getElementById(
                        'editProjectId'
                    ).value =
                        projectId;


                    document.getElementById(
                        'editTitle'
                    ).value =
                        task.title || '';


                    document.getElementById(
                        'editScenario'
                    ).value =
                        task.scenario || '';


                    document.getElementById(
                        'editPriority'
                    ).value =
                        task.priority || 'Low';


                    document.getElementById(
                        'editStatus'
                    ).value =
                        task.status || 'Pending';


                    document.getElementById(
                        'editStartDate'
                    ).value =
                        formatInputDate(
                            task.startDate
                        );


                    document.getElementById(
                        'editExpectedEndDate'
                    ).value =
                        formatInputDate(
                            task.expectedEndDate
                        );


                    document.getElementById(
                        'editAmount'
                    ).value =
                        task.amount ?? '';


                    const select =
                        document.getElementById(
                            'editAssignedTo'
                        );


                    await loadMembers(
                        select
                    );


                    select.value =
                        task.assignedToUserId ||
                        '';


                    bootstrap.Modal
                        .getOrCreateInstance(
                            document.getElementById(
                                'editTaskModal'
                            )
                        )
                        .show();

                }
                catch (error) {

                    console.error(
                        'Edit error:',
                        error
                    );

                    alert(
                        'Unable to load task.'
                    );

                }

            }
        );


        /* =====================================================
           UPDATE
        ===================================================== */

        document.getElementById(
            'editTaskForm'
        )?.addEventListener(
            'submit',
            async function (event) {

                event.preventDefault();


                const formData =
                    new FormData(
                        this
                    );


                try {

                    const response =
                        await fetch(
                            this.action,
                            {
                                method: 'POST',
                                headers: {
                                    'X-Requested-With':
                                        'XMLHttpRequest'
                                },
                                body:
                                    formData
                            }
                        );


                    const data =
                        await readJson(
                            response
                        );


                    if (
                        response.ok &&
                        data?.success
                    ) {

                        window.location.reload();

                        return;
                    }


                    const error =
                        document.getElementById(
                            'editTaskError'
                        );


                    error.textContent =
                        data?.message ||
                        'Unable to update task.';


                    error.style.display =
                        'block';

                }
                catch (error) {

                    console.error(
                        'Update error:',
                        error
                    );

                }

            }
        );


        /* =====================================================
           DELETE
        ===================================================== */

        document.addEventListener(
            'click',
            async function (event) {

                const button =
                    event.target.closest(
                        '.task-delete-btn'
                    );


                if (!button) {
                    return;
                }


                const taskId =
                    button.dataset.taskId;


                if (
                    !confirm(
                        'Are you sure you want to delete this task?'
                    )
                ) {
                    return;
                }


                const body =
                    new URLSearchParams();


                body.append(
                    'id',
                    taskId
                );


                body.append(
                    'projectId',
                    projectId
                );


                body.append(
                    '__RequestVerificationToken',
                    getToken()
                );


                try {

                    const response =
                        await fetch(
                            '/Admin/Tasks/Delete',
                            {
                                method: 'POST',
                                headers: {
                                    'X-Requested-With':
                                        'XMLHttpRequest',
                                    'Content-Type':
                                        'application/x-www-form-urlencoded'
                                },
                                body:
                                    body.toString()
                            }
                        );


                    const data =
                        await readJson(
                            response
                        );


                    if (
                        response.ok &&
                        data?.success
                    ) {

                        window.location.reload();

                        return;
                    }


                    alert(
                        data?.message ||
                        'Unable to delete task.'
                    );

                }
                catch (error) {

                    console.error(
                        'Delete error:',
                        error
                    );

                    alert(
                        'Unable to delete task.'
                    );

                }

            }
        );


        /* =====================================================
           DETAILS
        ===================================================== */

        document.addEventListener(
            'click',
            async function (event) {

                const button =
                    event.target.closest(
                        '.task-details-btn'
                    );


                if (!button) {
                    return;
                }


                const taskId =
                    button.dataset.taskId;


                try {

                    const response =
                        await fetch(
                            '/Admin/Tasks/Details?id=' +
                            encodeURIComponent(
                                taskId
                            )
                        );


                    const result =
                        await response.json();


                    if (
                        !result.success
                    ) {

                        alert(
                            result.message ||
                            'Task not found.'
                        );

                        return;
                    }


                    const task =
                        result.data;


                    document.addEventListener('click', async function (event) {

                        const button = event.target.closest('.task-details-btn');

                        if (!button) return;

                        const taskId = button.dataset.taskId;

                        try {

                            const response = await fetch(
                                '/Admin/Tasks/Details?id=' +
                                encodeURIComponent(taskId)
                            );

                            const result = await response.json();

                            if (!result.success) {
                                alert(result.message || 'Task not found.');
                                return;
                            }

                            const task = result.data;

                            document.getElementById('detailTaskId').textContent =
                                'TASK-' + task.id;

                            document.getElementById('detailTaskTitle').textContent =
                                task.title || '-';

                            document.getElementById('detailTaskScenario').textContent =
                                task.scenario || '-';

                            document.getElementById('detailTaskAssignee').textContent =
                                task.assignedToUserName ||
                                task.assignedToUserId ||
                                'Unassigned';

                            document.getElementById('detailTaskPriority').textContent =
                                task.priority || '-';

                            document.getElementById('detailTaskStatus').textContent =
                                task.status || '-';

                            document.getElementById('detailTaskAmount').textContent =
                                '₹ ' + Number(task.amount || 0).toFixed(2);

                            document.getElementById('detailTaskStart').textContent =
                                formatDate(task.startDate);

                            document.getElementById('detailTaskEnd').textContent =
                                formatDate(task.expectedEndDate);

                            const allTasksModalElement =
                                document.getElementById('allTasksModal');

                            const allTasksModal =
                                bootstrap.Modal.getInstance(
                                    allTasksModalElement
                                );

                            if (allTasksModal) {
                                allTasksModal.hide();
                            }



                            const modalElement =
                                document.getElementById('taskDetailsModal');

                            const modal =
                                bootstrap.Modal.getOrCreateInstance(
                                    modalElement
                                );

                            modal.show();

                        }
                        catch (error) {

                            console.error('Details error:', error);

                            alert('Unable to load task details.');

                        }

                    });

                }
                catch (error) {

                    console.error(
                        'Details error:',
                        error
                    );

                }

            }
        );


        /* =====================================================
           COLUMN ADD BUTTON
        ===================================================== */

        document.addEventListener(
            'click',
            function (event) {

                const button =
                    event.target.closest(
                        '.column-add'
                    );


                if (!button) {
                    return;
                }


                const status =
                    button.dataset.columnStatus;


                const modal =
                    document.getElementById(
                        'addTaskModal'
                    );


                const statusSelect =
                    modal.querySelector(
                        'select[name="Status"]'
                    );


                statusSelect.value =
                    status;


                bootstrap.Modal
                    .getOrCreateInstance(
                        modal
                    )
                    .show();

            }
        );


        /* =====================================================
           START
        ===================================================== */

        populateAssignees();

        renderStats();

        loadProject();

        renderBoard();

    });

})();