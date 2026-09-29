document.addEventListener('DOMContentLoaded', () => {

    const listEl = document.getElementById('notificationsList');
    const clearAllBtn = document.getElementById('clearAllNotifications');
    const antiForgeryToken = () => document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || '';

    function formatDate(value) {
        if (!value) return '';
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    async function loadList() {
        try {
            const res = await fetch('/User/Notifications/Pending');
            if (!res.ok) return;
            const json = await res.json();
            if (!json.success) return;

            renderList(json.notifications);
        }
        catch (err) {
            console.error('Failed to load notifications', err);
        }
    }

    function renderList(items) {
        if (!listEl) return;
        if (!items || items.length === 0) {
            listEl.innerHTML = '<div class="notification-empty"><span>✓</span><strong>You\'re all caught up</strong><small>No new task assignments.</small></div>';
            return;
        }

        listEl.innerHTML = '';

        items.forEach(n => {
            const card = document.createElement('div');
            card.className = 'notification-card';
            card.dataset.notificationId = n.notificationId;
            card.dataset.assignmentId = n.assignmentId;

            card.innerHTML = `
                <div class="notification-card-inner">
                    <div class="notification-icon">\uD83D\uDD14</div>
                    <div class="notification-main">
                        <strong>New assignment for you</strong>
                        <small>${formatDate(n.createdAt)}</small>
                    </div>

                    <div class="notification-action">
                        ${n.assignmentStatus === "Accepted"
                                        ? '<span class="notification-status accepted">✓ Accepted</span>'
                                        : n.assignmentStatus === "Rejected"
                                            ? '<span class="notification-status rejected">✕ Rejected</span>'
                                            : '›'
                        }
                    </div>
                </div>
            `;

            // Click opens details
            card.addEventListener('click', () => {
                window.location.href = `/User/Notifications/Details/${n.notificationId}`;
            });

            // Right-click for desktop
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e.pageX, e.pageY, n.notificationId, card);
            });

            // Long press for mobile
            let touchTimer = null;
            card.addEventListener('touchstart', (e) => {
                touchTimer = setTimeout(() => {
                    showContextMenu(e.touches[0].pageX, e.touches[0].pageY, n.notificationId, card);
                }, 600);
            }, { passive: true });

            card.addEventListener('touchend', () => {
                if (touchTimer) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
            });

            listEl.appendChild(card);
        });
    }

    // Simple context menu element
    let contextMenu = null;

    function showContextMenu(x, y, notificationId, cardEl) {
        removeContextMenu();

        contextMenu = document.createElement('div');
        contextMenu.className = 'notification-context-menu';
        contextMenu.style.left = (x) + 'px';
        contextMenu.style.top = (y) + 'px';

        contextMenu.innerHTML = `<div class="cm-item" data-action="delete">Delete</div>`;

        document.body.appendChild(contextMenu);

        const deleteBtn = contextMenu.querySelector('[data-action="delete"]');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await deleteNotification(notificationId, cardEl);
            removeContextMenu();
        });

        // close on outside click
        setTimeout(() => {
            document.addEventListener('click', removeContextMenuOnce);
        }, 0);
    }

    function removeContextMenuOnce() {
        removeContextMenu();
        document.removeEventListener('click', removeContextMenuOnce);
    }

    function removeContextMenu() {
        if (contextMenu) {
            contextMenu.remove();
            contextMenu = null;
        }
    }

    async function deleteNotification(id, cardEl) {
        try {
            const token = antiForgeryToken();
            const body = `id=${encodeURIComponent(id)}`;
            const res = await fetch('/User/Notifications/Delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'RequestVerificationToken': token
                },
                body
            });

            if (!res.ok) throw new Error('Delete failed');

            const json = await res.json();
            if (!json.success) throw new Error(json.message || 'Delete failed');

            // remove card
            if (cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
        }
        catch (err) {
            console.error(err);
            alert(err.message || 'Unable to delete notification');
        }
    }

    async function clearAllNotifications() {

        if (!listEl)
            return;

        const cards = [
            ...listEl.querySelectorAll('.notification-card')
        ];

        if (!cards.length)
            return;

        const clearButton =
            document.getElementById('clearAllNotifications');

        if (clearButton)
            clearButton.disabled = true;


        // ===============================
        // SLIDE OUT ANIMATION
        // ===============================

        cards.forEach((card, index) => {

            card.style.transition =
                'transform .45s cubic-bezier(.16,1,.3,1), opacity .45s ease';

            card.style.transitionDelay =
                `${index * 120}ms`;

            card.style.transform =
                'translateX(120%)';

            card.style.opacity = '0';
        });


        const animationTime =
            ((cards.length - 1) * 120) + 600;


        // ===============================
        // DELETE FROM DATABASE
        // ===============================

        try {

            const token = antiForgeryToken();

            const response = await fetch(
                '/User/Notifications/ClearAll',
                {
                    method: 'POST',
                    headers: {
                        'RequestVerificationToken': token
                    }
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                    'Unable to clear notifications.'
                );
            }


            // ===============================
            // SHOW EMPTY STATE AFTER ANIMATION
            // ===============================

            setTimeout(() => {

                listEl.innerHTML = `
                <div class="notification-empty">

                    <span>✓</span>

                    <strong>
                        You're all caught up
                    </strong>

                    <small>
                        No new task assignments.
                    </small>

                </div>
            `;

                if (clearButton)
                    clearButton.disabled = false;

            }, animationTime);

        }
        catch (error) {

            console.error(
                'Clear All failed:',
                error
            );


            // Restore cards if database operation fails
            cards.forEach(card => {

                card.style.transition = 'none';
                card.style.transitionDelay = '0ms';
                card.style.transform = '';
                card.style.opacity = '';

            });


            if (clearButton)
                clearButton.disabled = false;

            alert(
                error.message ||
                'Unable to clear notifications.'
            );
        }
    }

    // If on details page, wire accept/reject
    if (window.__notificationDetails) {
        const acceptBtn = document.getElementById('acceptButton');
        const rejectBtn = document.getElementById('rejectButton');

        acceptBtn?.addEventListener('click', async (e) => {
            e.preventDefault();
            await respond('Accept', window.__notificationDetails.assignmentId);
        });

        rejectBtn?.addEventListener('click', async (e) => {
            e.preventDefault();
            await respond('Reject', window.__notificationDetails.assignmentId);
        });
    }

    async function respond(action, assignmentId) {
        if (!assignmentId) {
            alert('Invalid assignment');
            return;
        }

        const token = antiForgeryToken();
        try {
            const res = await fetch(`/User/Notifications/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'RequestVerificationToken': token
                },
                body: `assignmentId=${encodeURIComponent(assignmentId)}`
            });

            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed');

            // On success, redirect to list
            window.location.href = '/User/Notifications';
        }
        catch (err) {
            console.error(err);
            alert(err.message || 'Unable to process assignment');
        }
    }

    const clearAllButton =
        document.getElementById('clearAllNotifications');

    clearAllBtn?.addEventListener(
        'click',
        clearAllNotifications
    );

    // Initial load if on list
    if (listEl) loadList();

});
