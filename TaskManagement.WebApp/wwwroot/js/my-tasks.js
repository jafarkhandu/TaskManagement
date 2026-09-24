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

});

// =========================================================
// TASK CHAT - DRAWER UI
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

    const drawer = document.getElementById("taskChatDrawer");
    const overlay = document.getElementById("taskChatOverlay");
    const closeButton = document.getElementById("closeTaskChat");
    const startChatButton =
        document.getElementById("startTaskChat");

    const startChatButtonParent =
        startChatButton?.parentElement;

    const taskTitle =
        document.getElementById("chatTaskTitle");
    const taskStatus = document.getElementById("chatTaskStatus");

    function restoreStartChatButton(showButton) {

        if (!startChatButton) {
            return;
        }

        // Put the button back into its original location
        if (
            startChatButtonParent &&
            !startChatButtonParent.contains(startChatButton)
        ) {
            startChatButtonParent.appendChild(
                startChatButton
            );
        }

        startChatButton.style.display =
            showButton ? "" : "none";

        startChatButton.disabled = false;

        startChatButton.innerHTML =
            '<span>✦</span> Start Chat';
    }

    let activeChatTaskId = null;
    let activeChatSessionId = null;

    async function loadChatHistory() {

        if (!activeChatSessionId) {
            return;
        }

        try {

            const response = await fetch(
                `/User/MyTasks/GetChat?chatSessionId=${activeChatSessionId}`
            );

            const result = await response.json();

            if (!result.success) {
                throw new Error(
                    result.message || "Unable to load chat history."
                );
            }

            renderChatHistory(result.data);

        } catch (error) {

            console.error(
                "Chat history error:",
                error
            );
        }
    }

    function renderChatHistory(chatData) {

        const messagesContainer =
            document.getElementById("taskChatMessages");

        if (!messagesContainer) {
            return;
        }

        const messages =
            chatData?.messages || [];

        // Clear previous chat content
        messagesContainer.innerHTML = "";

        // No previous messages
        if (messages.length === 0) {

            messagesContainer.innerHTML = `
        <div class="task-chat-empty">
            <div class="task-chat-empty-icon">💬</div>

            <h4>Start the conversation</h4>

            <p>
                Ask Admin anything about this task.
            </p>
        </div>
    `;

            return;
        }

        // Render old messages
        messages.forEach(message => {

            const wrapper =
                document.createElement("div");

            // For now identify messages using SenderId.
            // Real current-user identification will be connected
            // when SignalR messaging is added.
            wrapper.className = "chat-message admin";

            const bubble =
                document.createElement("div");

            bubble.className =
                "chat-message-bubble";

            bubble.textContent =
                message.message || "";

            const time =
                document.createElement("div");

            time.className =
                "chat-message-time";

            time.textContent =
                formatChatTime(message.sentAt);

            const content =
                document.createElement("div");

            content.appendChild(bubble);
            content.appendChild(time);

            wrapper.appendChild(content);

            messagesContainer.appendChild(wrapper);
        });

        // Automatically scroll to latest message
        messagesContainer.scrollTop =
            messagesContainer.scrollHeight;
    }


    function formatChatTime(value) {

        if (!value) {
            return "";
        }

        const date =
            new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }


    if (!drawer || !overlay) {
        return;
    }

    // Ensure overlay and drawer are direct children of <body> so parent layout/transform
    // rules cannot affect fixed positioning. Move them if they're not already there.
    try {
        if (overlay.parentElement !== document.body) {
            document.body.appendChild(overlay);
        }

        if (drawer.parentElement !== document.body) {
            document.body.appendChild(drawer);
        }
    }
    catch (err) {
        // Non-fatal: keep going; positioning will still use CSS if possible
        console.warn('Task chat: failed to move elements to body', err);
    }

    async function openTaskChat(taskCard) {

        if (!taskCard) {
            return;
        }

        // Capture the task ID locally.
        // This prevents an older request from changing the state
        // of a newly opened task.
        const taskId = taskCard.dataset.taskId;

        activeChatTaskId = taskId;
        activeChatSessionId = null;

        const title =
            taskCard.dataset.title || "Task Support";

        const status =
            taskCard.dataset.status || "—";

        taskTitle.textContent = title;
        taskStatus.textContent = status;

        // Show drawer immediately
        drawer.classList.add("active");
        overlay.classList.add("active");

        document.body.style.overflow = "hidden";

        // Always reset the button for the newly selected task
        if (startChatButton) {
            startChatButton.style.display = "";
            startChatButton.disabled = false;
            startChatButton.innerHTML = '<span>✦</span> Start Chat';
        }

        // Clear previous task messages immediately
        const messagesContainer =
            document.getElementById("taskChatMessages");

        if (messagesContainer) {
            messagesContainer.innerHTML = "";

            // Put Start Chat button back into the drawer
            if (startChatButton) {
                messagesContainer.appendChild(startChatButton);

                startChatButton.style.display = "";
                startChatButton.disabled = false;
                startChatButton.innerHTML =
                    '<span>✦</span> Start Chat';
            }
        }

        try {

            const res = await fetch(
                `/User/MyTasks/CheckActiveSession?taskId=${encodeURIComponent(taskId)}`
            );

            // IMPORTANT:
            // If user already opened another task,
            // ignore this old request completely.
            if (activeChatTaskId !== taskId) {
                return;
            }

            if (!res.ok) {
                throw new Error("Unable to check chat session.");
            }

            const json = await res.json();

            // Again verify that this response belongs
            // to the currently opened task.
            if (activeChatTaskId !== taskId) {
                return;
            }

            if (
                json &&
                json.success &&
                json.exists &&
                json.chatSessionId
            ) {

                // Existing session found
                activeChatSessionId = json.chatSessionId;

                if (startChatButton) {
                    startChatButton.style.display = "none";
                    startChatButton.disabled = false;
                }

                await loadChatHistory();

                return;
            }

            // No existing session
            activeChatSessionId = null;

            if (startChatButton) {

                if (
                    messagesContainer &&
                    !messagesContainer.contains(startChatButton)
                ) {
                    messagesContainer.appendChild(startChatButton);
                }

                startChatButton.style.display = "";
                startChatButton.disabled = false;
                startChatButton.innerHTML =
                    '<span>✦</span> Start Chat';
            }

        }
        catch (err) {

            // Ignore errors from an old task request
            if (activeChatTaskId !== taskId) {
                return;
            }

            console.error(
                "CheckActiveSession failed:",
                err
            );

            // If checking fails, allow manual Start Chat
            activeChatSessionId = null;

            if (startChatButton) {
                startChatButton.style.display = "";
                startChatButton.disabled = false;
                startChatButton.innerHTML =
                    '<span>✦</span> Start Chat';
            }
        }
    }

    function closeTaskChat() {

        drawer.classList.remove("active");
        overlay.classList.remove("active");

        document.body.style.overflow = "";
    }

    // Use event delegation for chat buttons so dynamically created/removed buttons
    // are handled automatically without needing to rebind handlers.
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

        openTaskChat(taskCard);
    });

    closeButton?.addEventListener("click", closeTaskChat);

    overlay.addEventListener("click", closeTaskChat);

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {
            closeTaskChat();
        }

    });

    startChatButton?.addEventListener("click", async () => {

        if (!activeChatTaskId) {
            return;
        }

        startChatButton.disabled = true;
        startChatButton.innerHTML = "Starting...";

        try {

            const tokenInput =
                document.querySelector(
                    'input[name="__RequestVerificationToken"]'
                );

            const response = await fetch(
                "/User/MyTasks/StartChat",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded; charset=UTF-8"
                    },
                    body: new URLSearchParams({
                        taskId: activeChatTaskId,
                        __RequestVerificationToken:
                            tokenInput?.value || ""
                    })
                }
            );

            const result = await response.json();

            if (!result.success) {
                throw new Error(
                    result.message || "Unable to start chat."
                );
            }

            activeChatSessionId = result.chatSessionId;

            console.log(
                "Chat Session ID:",
                activeChatSessionId
            );

            startChatButton.style.display = "none";
            await loadChatHistory();

        } catch (error) {

            console.error(error);

            alert(error.message);

            startChatButton.disabled = false;
            startChatButton.innerHTML =
                "<span>✦</span> Start Chat";
        }
    });


