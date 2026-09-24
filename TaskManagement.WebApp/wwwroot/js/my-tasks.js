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
    const modalAmount = document.getElementById("modalAmount");        ;

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
                status === statusValue;

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

        modal.classList.add("show");

        document.body.style.overflow = "hidden";
    }


    cards.forEach(card => {

        const button =
            card.querySelector(".view-task-btn");

        button?.addEventListener(
            "click",
            function () {

                openTaskModal(card);

            }
        );

    });


    function closeTaskDetails() {

        modal.classList.remove("show");

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

                if (oldStatus === newStatus) return;

                if (!(allowedTransitions[oldStatus] && allowedTransitions[oldStatus].includes(newStatus))) {
                    showStatusToast('Status transition not allowed.', false);
                    return;
                }

                const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
                if (!card) return;

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
                    try {
                        const isCompletedNow = String(newStatus).toLowerCase() === 'completed';
                        card.draggable = !isCompletedNow;
                    }
                    catch (err) { }

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
            const status = card.dataset.status || 'Pending';
            const isCompleted = String(status).toLowerCase() === 'completed';
            card.draggable = !isCompleted;

            card.addEventListener('dragstart', function (e) {
                e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: card.dataset.taskId, oldStatus: card.dataset.status }));
                e.dataTransfer.effectAllowed = 'move';
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', function () {
                card.classList.remove('dragging');
            });
        });

       })();


