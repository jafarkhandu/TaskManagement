(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {

        function getProjectId() {

            const path =
                window.location.pathname;

            const match =
                path.match(/\/Admin\/Tasks\/Project\/(\d+)/i);

            if (match && match[1]) {
                return Number(match[1]);
            }

            return 0;
        }

        const projectId = getProjectId();

        console.log(
            'Current Project ID:',
            projectId
        );

    /*
     * ---------------------------------------------------------
     * COMMON HELPERS
     * ---------------------------------------------------------
     */

    function getAntiForgeryToken() {
        return document.querySelector(
            'input[name="__RequestVerificationToken"]'
        )?.value || '';
    }

    function showError(elementId, message) {
        const element = document.getElementById(elementId);

        if (!element) {
            return;
        }

        element.textContent = message || 'Something went wrong.';
        element.style.display = 'block';
    }

    function hideError(elementId) {
        const element = document.getElementById(elementId);

        if (!element) {
            return;
        }

        element.textContent = '';
        element.style.display = 'none';
    }

    function formatDateForInput(value) {
        if (!value) {
            return '';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return '';
        }

        return date.toISOString().substring(0, 10);
    }

    async function readJsonResponse(response) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    /*
     * ---------------------------------------------------------
     * LOAD PROJECT MEMBERS
     * ---------------------------------------------------------
     */

    async function loadMembers(selectElement) {

        if (!selectElement) {
            console.error('Assigned To select element not found.');
            return;
        }

        if (!projectId) {
            console.error('Project ID not found.');
            return;
        }

        try {

            // Show loading state
            selectElement.innerHTML =
                '<option value="">Loading users...</option>';

            const response = await fetch(
                '/Admin/Tasks/Users?_=' + Date.now(),
                {
                    method: 'GET',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json'
                    },
                    cache: 'no-store'
                }
            );

            console.log(
                'Members API status:',
                response.status
            );

            if (!response.ok) {
                throw new Error(
                    'Members API failed: ' +
                    response.status
                );
            }

            const data =
                await response.json();

            console.log(
                'Members API response:',
                data
            );

            // Support both { success: true, users: [...] } and legacy { success: true, data: [...] }
            const usersArray = Array.isArray(data?.users) ? data.users : Array.isArray(data?.data) ? data.data : null;

            if (!data || data.success !== true || !Array.isArray(usersArray)) {
                selectElement.innerHTML =
                    '<option value="">No users found</option>';

                return;
            }

            // Clear loading option and store fetched users for client-side searching
            selectElement.innerHTML = '<option value="">Select User</option>';

            // Save original users on the select element for later searching/reordering
            try {
                selectElement._users = usersArray.slice();
            } catch (e) {
                selectElement._users = [];
            }

            // Ensure a small search input is available above the select (non-intrusive)
            (function ensureSearchInput(sel) {
                const parent = sel.parentNode;
                if (!parent) return;

                let search = parent.querySelector('.assigned-to-search');
                if (!search) {
                    search = document.createElement('input');
                    search.type = 'search';
                    search.className = 'form-control assigned-to-search';
                    search.placeholder = 'Type name or email to search...';
                    search.style.marginBottom = '6px';
                    parent.insertBefore(search, sel);

                    // Hook up search handler
                    search.addEventListener('input', function () {
                        const q = (this.value || '').trim().toLowerCase();
                        const users = sel._users || [];

                        if (!q) {
                            // restore original order
                            populateOptions(sel, users);
                            return;
                        }

                        const matched = [];
                        const others = [];

                        users.forEach(function (u) {
                            const hay = ((u.fullName || '') + ' ' + (u.email || '')).toLowerCase();
                            if (hay.indexOf(q) !== -1) matched.push(u);
                            else others.push(u);
                        });

                        // matched users first, then others
                        populateOptions(sel, matched.concat(others));
                    });
                }
            })(selectElement);

            // Populate select with users
            function populateOptions(sel, usersList) {
                sel.innerHTML = '<option value="">Select User</option>';
                usersList.forEach(function (user) {
                    const option = document.createElement('option');
                    // Support both shapes: { id, fullName, email } and legacy { userId, fullName, email }
                    option.value = user.id || user.userId || '';
                    const name = user.fullName || user.FullName || '';
                    const email = user.email || user.Email || '';
                    option.textContent = name ? (email ? (name + ' (' + email + ')') : name) : (email || user.id || user.userId || '');
                    sel.appendChild(option);
                });

                if ((usersList || []).length === 0) {
                    sel.innerHTML = '<option value="">No users available</option>';
                }
            }

            populateOptions(selectElement, selectElement._users || []);

        } catch (error) {

            console.error(
                'Unable to load users:',
                error
            );

            selectElement.innerHTML =
                '<option value="">Unable to load users</option>';
        }
    }

    /*
     * ---------------------------------------------------------
     * ADD TASK
     * ---------------------------------------------------------
     */

    const addTaskButton = document.getElementById('addTaskBtn');
    const addTaskForm = document.getElementById('addTaskForm');
    const addAssignedTo = document.getElementById('addAssignedTo');

    /*
 * ADD TASK MODAL
 * Load users after Bootstrap completely opens the modal.
 */
    const addTaskModal =
        document.getElementById('addTaskModal');

    if (addTaskModal) {

        addTaskModal.addEventListener(
            'shown.bs.modal',
            function () {

                hideError('addTaskError');

                loadMembers(addAssignedTo);

            }
        );
    }

    addTaskForm?.addEventListener('submit', async function (event) {
        event.preventDefault();

        hideError('addTaskError');

        const submitButton = addTaskForm.querySelector(
            'button[type="submit"]'
        );

        const originalText = submitButton?.textContent;

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Saving...';
        }

        try {
            const formData = new FormData(addTaskForm);

            /*
             * Project ID is taken from the current
             * Project Tasks page and explicitly sent
             * with the task form.
             */
            formData.set('ProjectId', projectId);

            const response = await fetch(
                addTaskForm.getAttribute('action'),
                {
                    method: 'POST',
                    headers: {
                        'RequestVerificationToken':
                            getAntiForgeryToken(),
                        'X-Requested-With':
                            'XMLHttpRequest'
                    },
                    body: formData
                }
            );

            const data = await readJsonResponse(response);

            if (response.ok && data && data.success) {

                const modalElement =
                    document.getElementById('addTaskModal');

                const modal =
                    bootstrap.Modal.getInstance(modalElement);

                modal?.hide();

                window.location.reload();

                return;
            }

            showError(
                'addTaskError',
                data?.message || 'Unable to create task.'
            );

        } catch (error) {
            console.error('Add task error:', error);

            showError(
                'addTaskError',
                'Unable to create task.'
            );
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent =
                    originalText || 'Save Task';
            }
        }
    });

    /*
     * ---------------------------------------------------------
     * EDIT TASK
     * ---------------------------------------------------------
     */

    document.addEventListener('click', async function (event) {

        const button =
            event.target.closest('.task-edit-btn');

        if (!button) {
            return;
        }

        const taskId =
            button.getAttribute('data-task-id');

        if (!taskId) {
            return;
        }

        try {
            const response = await fetch(
                '/Admin/Tasks/Get?id=' +
                encodeURIComponent(taskId),
                {
                    method: 'GET',
                    headers: {
                        'X-Requested-With':
                            'XMLHttpRequest'
                    }
                }
            );

            if (!response.ok) {
                alert('Unable to load task.');
                return;
            }

            const task = await readJsonResponse(response);

            if (!task) {
                alert('Task not found.');
                return;
            }

            document.getElementById('editTaskId').value =
                task.id;

            document.getElementById('editTitle').value =
                task.title || '';

            document.getElementById('editScenario').value =
                task.scenario || '';

            document.getElementById('editPriority').value =
                task.priority || 'Low';

            document.getElementById('editStatus').value =
                task.status || 'Pending';

            document.getElementById('editStartDate').value =
                formatDateForInput(task.startDate);

            document.getElementById('editExpectedEndDate').value =
                formatDateForInput(task.expectedEndDate);

            document.getElementById('editAmount').value =
                task.amount ?? '';

            const editAssignedTo =
                document.getElementById('editAssignedTo');

            await loadMembers(editAssignedTo);

            // Ensure the select value is the actual user id (for edit submission)
            editAssignedTo.value =
                task.assignedToUserId || '';

            hideError('editTaskError');

            const modalElement =
                document.getElementById('editTaskModal');

            const modal =
                bootstrap.Modal.getOrCreateInstance(
                    modalElement
                );

            modal.show();

        } catch (error) {
            console.error('Edit task load error:', error);

            alert('Unable to load task.');
        }
    });

    /*
     * ---------------------------------------------------------
     * UPDATE TASK
     * ---------------------------------------------------------
     */

    const editTaskForm =
        document.getElementById('editTaskForm');

    editTaskForm?.addEventListener(
        'submit',
        async function (event) {

            event.preventDefault();

            hideError('editTaskError');

            const submitButton =
                editTaskForm.querySelector(
                    'button[type="submit"]'
                );

            const originalText =
                submitButton?.textContent;

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Saving...';
            }

            try {
                const formData =
                    new FormData(editTaskForm);

                const response = await fetch(
                    editTaskForm.getAttribute('action'),
                    {
                        method: 'POST',
                        headers: {
                            'RequestVerificationToken':
                                getAntiForgeryToken(),
                            'X-Requested-With':
                                'XMLHttpRequest'
                        },
                        body: formData
                    }
                );

                const data =
                    await readJsonResponse(response);

                if (response.ok &&
                    data &&
                    data.success) {

                    const modalElement =
                        document.getElementById(
                            'editTaskModal'
                        );

                    const modal =
                        bootstrap.Modal.getInstance(
                            modalElement
                        );

                    modal?.hide();

                    window.location.reload();

                    return;
                }

                showError(
                    'editTaskError',
                    data?.message ||
                    'Unable to update task.'
                );

            } catch (error) {
                console.error(
                    'Update task error:',
                    error
                );

                showError(
                    'editTaskError',
                    'Unable to update task.'
                );
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent =
                        originalText || 'Save';
                }
            }
        }
    );

    /*
     * ---------------------------------------------------------
     * TASK DETAILS
     * ---------------------------------------------------------
     */

    document.addEventListener('click', async function (event) {

        const button =
            event.target.closest('.task-details-btn');

        if (!button) {
            return;
        }

        const taskId =
            button.getAttribute('data-task-id');

        const currentRow =
            button.closest('tr');

        if (!currentRow || !taskId) {
            return;
        }

        const existingRow =
            currentRow.nextElementSibling;

        if (
            existingRow &&
            existingRow.classList.contains('task-expanded')
        ) {
            existingRow.remove();
            return;
        }

        try {
            const response = await fetch(
                '/Admin/Tasks/Details?id=' +
                encodeURIComponent(taskId),
                {
                    method: 'GET',
                    headers: {
                        'X-Requested-With':
                            'XMLHttpRequest'
                    }
                }
            );

            const data =
                await readJsonResponse(response);

            if (
                !response.ok ||
                !data ||
                !data.success
            ) {
                alert(
                    data?.message ||
                    'Unable to load details.'
                );

                return;
            }

            const task = data.data;

            const expandedRow =
                document.createElement('tr');

            expandedRow.className =
                'task-expanded';

            const cell =
                document.createElement('td');

            cell.colSpan = 8;

            const container =
                document.createElement('div');

            const scenarioTitle =
                document.createElement('strong');

            scenarioTitle.textContent =
                'Scenario:';

            const scenario =
                document.createElement('p');

            scenario.textContent =
                task.scenario || '-';

            const assignedTitle =
                document.createElement('strong');

            assignedTitle.textContent =
                'Assigned To:';

            const assigned =
                document.createElement('p');

            assigned.textContent =
                task.assignedToUserName || task.assignedToUserId || '-';

            const amountTitle =
                document.createElement('strong');

            amountTitle.textContent =
                'Amount:';

            const amount =
                document.createElement('p');

            amount.textContent =
                task.amount ?? '0.00';

            container.appendChild(scenarioTitle);
            container.appendChild(scenario);

            container.appendChild(assignedTitle);
            container.appendChild(assigned);

            container.appendChild(amountTitle);
            container.appendChild(amount);

            cell.appendChild(container);
            expandedRow.appendChild(cell);

            currentRow.parentNode.insertBefore(
                expandedRow,
                currentRow.nextSibling
            );

        } catch (error) {
            console.error(
                'Task details error:',
                error
            );

            alert('Unable to load details.');
        }
    });

    /*
     * ---------------------------------------------------------
     * DELETE TASK
     * ---------------------------------------------------------
     */

    document.addEventListener('click', async function (event) {

        const button =
            event.target.closest('.task-delete-btn');

        if (!button) {
            return;
        }

        const taskId =
            button.getAttribute('data-task-id');

        if (!taskId) {
            return;
        }

        const confirmed =
            window.confirm(
                'Are you sure you want to delete this task?'
            );

        if (!confirmed) {
            return;
        }

        try {
            const body =
                'id=' +
                encodeURIComponent(taskId) +
                '&projectId=' +
                encodeURIComponent(projectId);

            const response = await fetch(
                '/Admin/Tasks/Delete',
                {
                    method: 'POST',
                    headers: {
                        'RequestVerificationToken':
                            getAntiForgeryToken(),
                        'X-Requested-With':
                            'XMLHttpRequest',
                        'Content-Type':
                            'application/x-www-form-urlencoded'
                    },
                    body: body
                }
            );

            const data =
                await readJsonResponse(response);

            if (
                response.ok &&
                data &&
                data.success
            ) {
                window.location.reload();
                return;
            }

            alert(
                data?.message ||
                'Unable to delete task.'
            );

        } catch (error) {
            console.error(
                'Delete task error:',
                error
            );

            alert('Unable to delete task.');
        }
    });

    });
})();