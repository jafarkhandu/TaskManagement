document.addEventListener("DOMContentLoaded", function () {

    const cards = Array.from(document.querySelectorAll(".task-card"));

    const taskSearch = document.getElementById("taskSearch");
    const boardSearch = document.getElementById("boardSearch");

    const statusFilter = document.getElementById("statusFilter");
    const priorityFilter = document.getElementById("priorityFilter");

    const resetFilters = document.getElementById("resetFilters");

    const modal = document.getElementById("taskModal");
    const closeModal = document.getElementById("closeTaskModal");

    const modalTaskId = document.getElementById("modalTaskId");
    const modalTitle = document.getElementById("modalTitle");
    const modalScenario = document.getElementById("modalScenario");
    const modalStatus = document.getElementById("modalStatus");
    const modalPriority = document.getElementById("modalPriority")
    const modalStartDate = document.getElementById("modalStartDate");
    const modalEndDate = document.getElementById("modalEndDate");
    const modalAmount = document.getElementById("modalAmount");
    const modalDeadlineWarning = document.getElementById("modalDeadlineWarning");

    const completionModal = document.getElementById('taskCompletionModal');
    const completionTaskTitle = document.getElementById('completionTaskTitle');
    const completionRepositoryUrl = document.getElementById('completionRepositoryUrl');
    const completionRepositoryError = document.getElementById('completionRepositoryError');
    const submitCompletion = document.getElementById('submitCompletion');
    const closeCompletionModalButton = document.getElementById('closeCompletionModal');
    const cancelCompletion = document.getElementById('cancelCompletion');

    let pendingCompletion = null;


    function applyFilters() {

        const searchValue =
            (boardSearch?.value || taskSearch?.value || "")
                .trim()
                .toLowerCase();

        const statusValue =
            statusFilter?.value || "all";

        const priorityValue =
            priorityFilter?.value || "all";

        cards.forEach(card => {

            const title =
                card.dataset.title?.toLowerCase() || "";

            const scenario =
                card.dataset.scenario?.toLowerCase() || "";

            const status =
                card.dataset.status || "";

            const priority =
                card.dataset.priority || "";

            const matchesSearch =
                !searchValue ||
                title.includes(searchValue) ||
                scenario.includes(searchValue) ||
                status.toLowerCase().includes(searchValue);

            const matchesStatus =
                statusValue === "all" ||
                (
                    statusValue === "In Progress"
                        ? (status === "In Progress" || status === "Review Pending")
                        : status === statusValue
                );

            const matchesPriority =
                priorityValue === "all" ||
                priority === priorityValue;

            const visible =
                matchesSearch &&
                matchesStatus &&
                matchesPriority;

            card.style.display =
                visible ? "" : "none";

        });

    }


    boardSearch?.addEventListener(
        "input",
        applyFilters
    );

    taskSearch?.addEventListener(
        "input",
        function () {

            if (boardSearch) {
                boardSearch.value =
                    taskSearch.value;
            }

            applyFilters();
        }
    );


    statusFilter?.addEventListener(
        "change",
        applyFilters
    );

    priorityFilter?.addEventListener(
        "change",
        applyFilters
    );


    resetFilters?.addEventListener(
        "click",
        function () {

            if (taskSearch)
                taskSearch.value = "";

            if (boardSearch)
                boardSearch.value = "";

            if (statusFilter)
                statusFilter.value = "all";

            if (priorityFilter)
                priorityFilter.value = "all";

            applyFilters();

        }
    );


    /* ================= MODAL ================= */

    function getTaskDeadlineState(card, now = new Date()) {
        const raw = String(card?.dataset?.endDate || '').trim();
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

        if (!match) return 'none';

        const dueDate = new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            0, 0, 0, 0
        );

        const currentDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0, 0, 0, 0
        );

        const daysUntilDue = Math.round(
            (dueDate.getTime() - currentDate.getTime()) / 86400000
        );

        const status = String(card.dataset.status || '').trim().toLowerCase();

        if (status === 'completed' || status === 'cancelled')
            return 'none';

        if (daysUntilDue < 0)
            return 'overdue';

        if (daysUntilDue === 0)
            return 'today';

        if (daysUntilDue === 1)
            return 'tomorrow';

        return 'none';
    }

    function updateModalDeadlineWarning(card) {
        if (!modalDeadlineWarning) return;

        const state = getTaskDeadlineState(card);

        if (state === 'today' || state === 'tomorrow') {
            modalDeadlineWarning.textContent =
                '⚠ Submit this task before the deadline. No payment will be made after the deadline.';
            modalDeadlineWarning.hidden = false;
            return;
        }

        if (state === 'overdue') {
            modalDeadlineWarning.textContent =
                '⚠ Deadline exceeded. This task is no longer eligible for payment.';
            modalDeadlineWarning.hidden = false;
            return;
        }

        modalDeadlineWarning.textContent = '';
        modalDeadlineWarning.hidden = true;
    }

    function openTaskModal(card) {

        modalTaskId.textContent =
            "TASK-" + card.dataset.taskId;

        modalTitle.textContent =
            card.dataset.title || "Task";

        modalScenario.textContent =
            card.dataset.scenario || "No description available.";

        modalStatus.textContent =
            card.dataset.status || "Pending";

        modalPriority.textContent =
            card.dataset.priority || "Low";

        modalStartDate.textContent =
            card.dataset.startDate || "—";

        modalEndDate.textContent =
            card.dataset.endDate || "—";

        modalAmount.textContent =
            card.dataset.amount
                ? "₹ " + card.dataset.amount
                : "₹ 0.00";

        updateModalDeadlineWarning(card);

        modal.dataset.openTaskId = String(card.dataset.taskId || '');
        modal.classList.add("show");

        document.body.style.overflow = "hidden";
    }


    // Capture-phase task action handler
    // Use event delegation instead of relying only on the initial button NodeList.
    // This keeps View Details and Chat with Admin working even if the task board
    // is refreshed or its card DOM is replaced.
    document.addEventListener('click', function (event) {
        const viewButton = event.target.closest('.view-task-btn');
        if (viewButton) {
            event.preventDefault();
            event.stopPropagation();

            const card = viewButton.closest('.task-card');
            const taskModal = document.getElementById('taskModal');

            if (!card || !taskModal) return;

            const setText = (id, value) => {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            };

            setText('modalTaskId', 'TASK-' + (card.dataset.taskId || ''));
            setText('modalTitle', card.dataset.title || 'Task');
            setText('modalScenario', card.dataset.scenario || 'No description available.');
            setText('modalStatus', card.dataset.status || 'Pending');
            setText('modalPriority', card.dataset.priority || 'Low');
            setText('modalStartDate', card.dataset.startDate || '—');
            setText('modalEndDate', card.dataset.endDate || '—');
            setText('modalAmount', card.dataset.amount ? '₹ ' + card.dataset.amount : '₹ 0.00');
            updateModalDeadlineWarning(card);

            taskModal.dataset.openTaskId = String(card.dataset.taskId || '');
            taskModal.classList.add('show');
            document.body.style.overflow = 'hidden';
            return;
        }

        const chatButton = event.target.closest('.task-chat-btn');
        if (chatButton) {
            event.preventDefault();
            event.stopPropagation();

            const taskCard = chatButton.closest('.task-card');
            if (!taskCard) return;

            const status = (taskCard.dataset.status || '').toLowerCase();
            if (status === 'completed') return;

            if (window.UserChat && typeof window.UserChat.openForTask === 'function') {
                window.UserChat.openForTask({
                    taskId: taskCard.dataset.taskId,
                    title: taskCard.dataset.title,
                    status: taskCard.dataset.status,
                    taskCard: taskCard
                });
            } else {
                console.error('UserChat is not available. Check _UserChat partial and user-chat.js.');
            }
        }
    }, true);

    // View Details belongs to the task card itself.
    // Bind directly to every button so the existing modal behavior is isolated
    // from global notification/chat click handlers.
    document.querySelectorAll('.view-task-btn').forEach(function (btn) {
        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            const card = btn.closest('.task-card');
            if (!card || !modal) return;

            openTaskModal(card);
        });
    });


    function closeTaskDetails() {

        if (!modal) return;

        modal.classList.remove("show");
        modal.dataset.openTaskId = '';

        if (modalDeadlineWarning) {
            modalDeadlineWarning.textContent = '';
            modalDeadlineWarning.hidden = true;
        }

        document.body.style.overflow = "";
    }


    closeModal?.addEventListener(
        "click",
        closeTaskDetails
    );


    document
        .querySelector(".task-modal-backdrop")
        ?.addEventListener(
            "click",
            closeTaskDetails
        );


    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape" &&
                modal.classList.contains("show")
            ) {
                closeTaskDetails();
            }

        }
    );


    /* ================= CTRL + K ================= */

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "k"
            ) {

                event.preventDefault();

                taskSearch?.focus();
            }

        }
    );

    /* ================= TASK COMPLETION SUBMISSION ================= */

    function setReviewPendingCardState(card) {
        if (!card) return;

        card.dataset.status = 'Review Pending';
        card.classList.add('review-pending-card');
        card.draggable = false;

        card.querySelector('.task-chat-btn')?.remove();

        const cardTop = card.querySelector('.task-card-top');
        if (!cardTop) return;

        let badge = cardTop.querySelector('.task-review-pending');

        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'task-review-pending';
            cardTop.appendChild(badge);
        }

        badge.textContent = 'Review Pending';
    }

    function clearReviewPendingCardState(card) {
        if (!card) return;

        card.classList.remove('review-pending-card');
        card.querySelector('.task-review-pending')?.remove();

        const status = String(card.dataset.status || '').trim().toLowerCase();
        card.draggable = status !== 'completed' && status !== 'review pending';
    }

    function showStatusToast(message, success = true) {
        try {
            const id = 'status-toast-' + Date.now();
            const el = document.createElement('div');

            el.id = id;
            el.style.position = 'fixed';
            el.style.right = '20px';
            el.style.top = '20px';
            el.style.background = success ? '#2ecc71' : '#e74c3c';
            el.style.color = '#fff';
            el.style.padding = '10px 14px';
            el.style.borderRadius = '6px';
            el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
            el.style.zIndex = '10000';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-8px)';
            el.style.transition = 'opacity 250ms ease, transform 250ms ease';
            el.textContent = message;

            document.body.appendChild(el);

            requestAnimationFrame(() => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            });

            setTimeout(() => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(-8px)';

                setTimeout(() => el.remove(), 300);
            }, 3500);
        }
        catch {
            // Toast must never break the task workflow.
        }
    }



    function isValidGitHubRepositoryUrl(value) {
        try {
            const url = new URL(String(value || '').trim());

            if (url.protocol !== 'https:') {
                return false;
            }

            const host = url.hostname.toLowerCase();

            if (host !== 'github.com' && host !== 'www.github.com') {
                return false;
            }

            const segments = url.pathname
                .split('/')
                .filter(Boolean);

            return segments.length >= 2;
        }
        catch {
            return false;
        }
    }

    function openCompletionModal(card, oldStatus) {
        if (!completionModal || !card) return;

        pendingCompletion = {
            card,
            taskId: card.dataset.taskId,
            oldStatus: oldStatus || card.dataset.status || 'In Progress'
        };

        if (completionTaskTitle) {
            completionTaskTitle.textContent = card.dataset.title || 'Task';
        }

        if (completionRepositoryUrl) {
            completionRepositoryUrl.value = '';
        }

        if (completionRepositoryError) {
            completionRepositoryError.textContent = '';
        }

        if (submitCompletion) {
            submitCompletion.disabled = false;
            submitCompletion.innerHTML = '<span class="completion-submit-icon">✓</span><span>Submit for Review</span>';
        }

        completionModal.classList.add('show');
        completionModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        window.setTimeout(() => completionRepositoryUrl?.focus(), 120);
    }

    function closeCompletionSubmissionModal() {
        if (!completionModal) return;

        completionModal.classList.remove('show');
        completionModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        pendingCompletion = null;
    }

    async function submitTaskCompletion() {
        if (!pendingCompletion || !pendingCompletion.card) return;

        const repositoryUrl = (completionRepositoryUrl?.value || '').trim();

        if (!isValidGitHubRepositoryUrl(repositoryUrl)) {
            if (completionRepositoryError) {
                completionRepositoryError.textContent =
                    'Enter a valid GitHub repository URL, for example https://github.com/username/repository';
            }

            completionRepositoryUrl?.focus();
            return;
        }

        const pending = pendingCompletion;
        const card = pending.card;
        const taskId = pending.taskId;
        const oldStatus = pending.oldStatus;
        const targetList = document.getElementById('progressList');

        if (!targetList) {
            if (completionRepositoryError) {
                completionRepositoryError.textContent = 'Unable to open the Completed column.';
            }
            return;
        }

        if (submitCompletion) {
            submitCompletion.disabled = true;
            submitCompletion.innerHTML = '<span class="completion-submit-icon">◌</span><span>Submitting...</span>';
        }

        if (completionRepositoryError) {
            completionRepositoryError.textContent = '';
        }

        const token =
            document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || '';

        try {
            const body = new URLSearchParams({
                taskId: taskId,
                completionRepositoryUrl: repositoryUrl,
                __RequestVerificationToken: token
            });

            const response = await fetch('/User/MyTasks/SubmitForReview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'RequestVerificationToken': token,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body
            });

            const json = await response.json();

            if (!response.ok || !json?.success) {
                throw new Error(json?.message || 'Unable to submit the task for review.');
            }

            const wasAlreadyReviewPending =
                String(card.dataset.status || '').trim().toLowerCase() === 'review pending';

            setReviewPendingCardState(card);

            targetList.querySelector('.empty-column')?.remove();

            // Put a newly submitted review at the end of the review column,
            // matching the refreshed board ordering instead of leaving it at
            // its previous active-task position.
            targetList.appendChild(card);

            const map = {
                'Pending': 'todoCount',
                'In Progress': 'progressCount',
                'On Hold': 'holdCount',
                'Completed': 'completedCount'
            };

            if (!wasAlreadyReviewPending) {
                const oldCount = document.getElementById(map[oldStatus]);
                if (oldCount) {
                    oldCount.textContent = Math.max(
                        0,
                        parseInt(oldCount.textContent || '0', 10) - 1
                    );
                }

                const newCount = document.getElementById('progressCount');
                if (newCount) {
                    newCount.textContent =
                        Number(newCount.textContent || 0) + 1;
                }
            }

            try {
                const idx = cards.findIndex(item => item === card);

                if (idx !== -1) {
                    cards.splice(idx, 1);
                }

                cards.push(card);
            }
            catch {
                // Keep the visible board authoritative.
            }

            closeCompletionSubmissionModal();
            showStatusToast('Task submitted for admin review.');
        }
        catch (error) {
            console.error('Task completion error:', error);

            if (completionRepositoryError) {
                completionRepositoryError.textContent =
                    error.message || 'Unable to complete the task. Please try again.';
            }

            if (submitCompletion) {
                submitCompletion.disabled = false;
                submitCompletion.innerHTML = '<span class="completion-submit-icon">✓</span><span>Submit &amp; Complete</span>';
            }
        }
    }

    closeCompletionModalButton?.addEventListener(
        'click',
        closeCompletionSubmissionModal
    );

    cancelCompletion?.addEventListener(
        'click',
        closeCompletionSubmissionModal
    );

    completionModal?.querySelector('[data-close-completion="true"]')?.addEventListener(
        'click',
        closeCompletionSubmissionModal
    );

    submitCompletion?.addEventListener(
        'click',
        submitTaskCompletion
    );

    completionRepositoryUrl?.addEventListener(
        'keydown',
        function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitTaskCompletion();
            }
        }
    );

    /* ================= LIVE TASK STATUS SYNC ================= */

    (function initLiveTaskStatusSync() {
        function normalizeLiveStatus(status) {
            const value = String(status || '')
                .trim()
                .toLowerCase()
                .replace(/[_-]/g, ' ')
                .replace(/\s+/g, ' ');

            if (['pending', 'todo', 'to do', 'not started', 'new'].includes(value)) return 'Pending';
            if (['in progress', 'inprogress', 'working', 'started'].includes(value)) return 'In Progress';
            if (['on hold', 'onhold', 'hold', 'paused'].includes(value)) return 'On Hold';
            if (['completed', 'complete', 'done', 'finished'].includes(value)) return 'Completed';
            if (value === 'review pending') return 'Review Pending';
            return status || 'Pending';
        }

        function moveCardToStatus(taskId, status) {
            const card = document.querySelector('.task-card[data-task-id="' + taskId + '"]');
            if (!card) return;

            const normalized = normalizeLiveStatus(status);
            const targetMap = {
                Pending: 'todoList',
                'In Progress': 'progressList',
                'Review Pending': 'progressList',
                'On Hold': 'holdList',
                Completed: 'completedList'
            };

            const target = document.getElementById(targetMap[normalized]);
            if (!target) return;

            const oldStatus = card.dataset.status || '';
            if (oldStatus === normalized) return;

            card.dataset.status = normalized;
            if (normalized === 'Review Pending') {
                setReviewPendingCardState(card);
                target.appendChild(card);
            }
            else {
                clearReviewPendingCardState(card);

                if (target.firstElementChild) target.insertBefore(card, target.firstElementChild);
                else target.appendChild(card);
            }

            const countMap = {
                Pending: 'todoCount',
                'In Progress': 'progressCount',
                'Review Pending': 'progressCount',
                'On Hold': 'holdCount',
                Completed: 'completedCount'
            };

            const oldCountId = countMap[oldStatus];
            const newCountId = countMap[normalized];

            if (oldCountId && oldCountId !== newCountId) {
                const el = document.getElementById(oldCountId);
                if (el) el.textContent = Math.max(0, Number(el.textContent || 0) - 1);
            }

            if (newCountId && oldCountId !== newCountId) {
                const el = document.getElementById(newCountId);
                if (el) el.textContent = Number(el.textContent || 0) + 1;
            }

            const isCompleted = normalized === 'Completed' || normalized === 'Review Pending';
            card.draggable = !isCompleted;

            if (isCompleted) {
                card.querySelector('.task-chat-btn')?.remove();
            }

            if (
                modal?.classList.contains('show') &&
                modalDeadlineWarning &&
                modal.dataset.openTaskId === String(taskId)
            ) {
                updateModalDeadlineWarning(card);
            }

            applyFilters();
        }

        window.addEventListener(
            'taskmanager:task-status-changed',
            function (event) {
                const payload = event.detail;
                if (!payload) return;

                const taskId = Number(payload.taskId ?? payload.TaskId ?? 0);
                if (!taskId) return;

                moveCardToStatus(
                    taskId,
                    payload.newStatus ?? payload.NewStatus ?? 'Pending'
                );
            }
        );
    })();

    /* ================= DRAG & DROP STATUS WORKFLOW ================= */


    (function initDragAndDrop() {

        const columnStatusMap = {
            todoList: 'Pending',
            progressList: 'In Progress',
            holdList: 'On Hold',
            completedList: 'Completed'
        };

        const allowedTransitions = {
            'Pending': ['In Progress'],
            'In Progress': ['On Hold', 'Completed'],
            'On Hold': ['In Progress'],
            'Completed': []
        };

        function requestVerificationToken() {
            return document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || '';
        }

        function showStatusToast(message, success = true) {
            try {
                const id = 'status-toast-' + Date.now();
                const el = document.createElement('div');
                el.id = id;
                el.style.position = 'fixed';
                el.style.right = '20px';
                el.style.top = '20px';
                el.style.background = success ? '#2ecc71' : '#e74c3c';
                el.style.color = '#fff';
                el.style.padding = '10px 14px';
                el.style.borderRadius = '6px';
                el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
                el.style.zIndex = 10000;
                el.style.opacity = '0';
                el.style.transition = 'opacity 250ms ease, transform 250ms ease';
                el.textContent = message;
                document.body.appendChild(el);
                requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
                setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
            }
            catch (err) {
                // ignore
            }
        }

        function updateCounts(oldStatus, newStatus) {
            const map = {
                'Pending': 'todoCount',
                'In Progress': 'progressCount',
                'On Hold': 'holdCount',
                'Completed': 'completedCount'
            };

            try {
                const oldEl = document.getElementById(map[oldStatus]);
                const newEl = document.getElementById(map[newStatus]);

                if (oldEl) {
                    const n = parseInt(oldEl.textContent || '0', 10);
                    oldEl.textContent = Math.max(0, n - 1);
                }

                if (newEl) {
                    const n2 = parseInt(newEl.textContent || '0', 10);
                    newEl.textContent = n2 + 1;
                }
            }
            catch (err) {
                // ignore
            }
        }

        const listIds = Object.keys(columnStatusMap);

        listIds.forEach(listId => {
            const listEl = document.getElementById(listId);
            if (!listEl) return;

            listEl.addEventListener('dragover', function (e) {
                e.preventDefault();

                const raw = e.dataTransfer.getData('text/plain');
                if (!raw) {
                    this.classList.remove('drop-allowed', 'drop-denied');
                    return;
                }

                let payload = null;
                try { payload = JSON.parse(raw); } catch { payload = null; }

                const oldStatus = payload?.oldStatus;
                const targetStatus = columnStatusMap[listId];

                if (oldStatus && allowedTransitions[oldStatus] && allowedTransitions[oldStatus].includes(targetStatus)) {
                    e.dataTransfer.dropEffect = 'move';
                    this.classList.add('drop-allowed');
                    this.classList.remove('drop-denied');
                }
                else {
                    e.dataTransfer.dropEffect = 'none';
                    this.classList.add('drop-denied');
                    this.classList.remove('drop-allowed');
                }
            });

            listEl.addEventListener('dragleave', function () {
                this.classList.remove('drop-allowed', 'drop-denied');
            });

            listEl.addEventListener('drop', async function (e) {
                e.preventDefault();
                this.classList.remove('drop-allowed', 'drop-denied');

                const raw = e.dataTransfer.getData('text/plain');
                if (!raw) return;

                let payload = null;
                try { payload = JSON.parse(raw); } catch { payload = null; }
                if (!payload) return;

                const taskId = payload.taskId;
                const oldStatus = payload.oldStatus;
                const newStatus = columnStatusMap[listId];

                if (!taskId || !oldStatus) return;

                if (String(oldStatus).trim().toLowerCase() === 'review pending') {
                    showStatusToast('Review Pending tasks cannot be moved.', false);
                    return;
                }

                if (oldStatus === newStatus) return;

                if (!(allowedTransitions[oldStatus] && allowedTransitions[oldStatus].includes(newStatus))) {
                    showStatusToast('Status transition not allowed.', false);
                    return;
                }

                const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
                if (!card) return;

                // Completion is gated by the repository submission modal.
                // Do not move the card or call the backend until the user submits a valid URL.
                if (newStatus === 'Completed') {
                    openCompletionModal(card, oldStatus);
                    return;
                }

                const originalList = card.closest('.task-list');
                const originalIndex = originalList ? Array.from(originalList.children).indexOf(card) : -1;

                // Optimistically move - place at the top of the target column
                if (this.firstElementChild) {
                    this.insertBefore(card, this.firstElementChild);
                }
                else {
                    this.appendChild(card);
                }

                // Send request
                const token = requestVerificationToken();
                const body = `taskId=${encodeURIComponent(taskId)}&newStatus=${encodeURIComponent(newStatus)}`;

                try {
                    const res = await fetch('/User/MyTasks/ChangeStatus', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'RequestVerificationToken': token
                        },
                        body
                    });

                    if (!res.ok) throw new Error('Server returned an error');

                    const json = await res.json();
                    if (!json || !json.success) throw new Error(json?.message || 'Status update rejected');

                    // Persist UI changes: set status and ensure underlying collection order
                    card.dataset.status = newStatus;

                    // Reorder cards collection so this card appears first among its status group
                    try {
                        const idxInCards = cards.findIndex(c => c === card);
                        if (idxInCards !== -1) {
                            cards.splice(idxInCards, 1);
                        }

                        const insertAt = cards.findIndex(c => c.dataset.status === newStatus);
                        if (insertAt === -1) {
                            cards.push(card);
                        }
                        else {
                            cards.splice(insertAt, 0, card);
                        }
                    }
                    catch (err) {
                        // ignore ordering errors
                    }
                    // Ensure completed tasks are not draggable
                    let isCompletedNow = false;
                    try {
                        isCompletedNow = String(newStatus).toLowerCase() === 'completed';
                        card.draggable = !isCompletedNow;
                    }
                    catch (err) { }

                    // Update chat button visibility based on actual task status.
                    // If task is completed -> remove chat button. If moved back to an active status -> add one.
                    try {
                        const chatBtn = card.querySelector('.task-chat-btn');

                        if (isCompletedNow) {
                            if (chatBtn) {
                                chatBtn.remove();
                            }
                        }
                        else {
                            if (!chatBtn) {
                                const btn = document.createElement('button');
                                btn.type = 'button';
                                btn.className = 'task-chat-btn';
                                btn.dataset.taskId = taskId;
                                btn.innerHTML = '<span>💬</span> Chat with Admin';

                                const viewBtn = card.querySelector('.view-task-btn');
                                if (viewBtn && viewBtn.parentNode) {
                                    viewBtn.parentNode.insertBefore(btn, viewBtn.nextSibling);
                                }
                                else {
                                    card.appendChild(btn);
                                }
                            }
                        }
                    }
                    catch (err) {
                        // ignore DOM update errors
                    }

                    updateCounts(oldStatus, newStatus);
                    showStatusToast('Task moved to ' + newStatus + '.');
                }
                catch (err) {
                    // Revert move
                    if (originalList) {
                        if (originalIndex >= 0 && originalIndex < originalList.children.length) {
                            originalList.insertBefore(card, originalList.children[originalIndex]);
                        }
                        else {
                            originalList.appendChild(card);
                        }
                    }
                    // Restore draggable to original state
                    try {
                        const wasCompleted = String(oldStatus).toLowerCase() === 'completed';
                        card.draggable = !wasCompleted;
                    }
                    catch (err) { }

                    console.error('ChangeStatus error:', err);
                    showStatusToast(err.message || 'Unable to change task status.', false);
                }

            });

        });

        // Initialize draggable state on cards
        document.querySelectorAll('.task-card').forEach(card => {
            const status = String(card.dataset.status || 'Pending').trim().toLowerCase();
            const isLocked = status === 'completed' || status === 'review pending';
            card.draggable = !isLocked;

            card.addEventListener('dragstart', function (e) {
                const currentStatus = String(card.dataset.status || 'Pending').trim().toLowerCase();

                // Review Pending and Completed tasks are permanently non-draggable
                // from the user's board.
                if (currentStatus === 'review pending' || currentStatus === 'completed') {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: card.dataset.taskId, oldStatus: card.dataset.status }));
                e.dataTransfer.effectAllowed = 'move';
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', function () {
                card.classList.remove('dragging');
            });
        });

       })();

// Ensure chat buttons use the shared UserChat implementation (avoid duplicate chat code)
document.addEventListener('DOMContentLoaded', function () {
    document.body.addEventListener('click', function (ev) {
        const btn = ev.target.closest('.task-chat-btn');
        if (!btn) return;

        const taskCard = btn.closest('[data-task-id]');
        if (!taskCard) return;

        // Prevent opening chat for completed tasks (UI-level guard). Backend will also enforce.
        const status = (taskCard.dataset.status || '').toLowerCase();
        if (status === 'completed') {
            console.warn('Chat unavailable for completed task:', taskCard.dataset.taskId);
            return;
        }

        if (window.UserChat && typeof window.UserChat.openForTask === 'function') {
            window.UserChat.openForTask({
                taskId: taskCard.dataset.taskId,
                title: taskCard.dataset.title,
                status: taskCard.dataset.status,
                taskCard: taskCard
            });
            return;
        }

        // Fallback: call StartChat endpoint if shared client not available yet
        (async function () {
            try {
                const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || '';
                const response = await fetch('/User/MyTasks/StartChat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    body: new URLSearchParams({ taskId: taskCard.dataset.taskId, __RequestVerificationToken: token })
                });

                const json = await response.json();
                if (json && json.success) {
                    // reload or open the global chat after starting
                    if (window.UserChat && typeof window.UserChat.openForTask === 'function') {
                        window.UserChat.openForTask({ taskId: taskCard.dataset.taskId, title: taskCard.dataset.title, status: taskCard.dataset.status, taskCard: taskCard });
                    } else {
                        location.reload();
                    }
                }
            } catch (err) {
                console.warn('Fallback StartChat failed', err);
            }
        })();

    });
});

});
