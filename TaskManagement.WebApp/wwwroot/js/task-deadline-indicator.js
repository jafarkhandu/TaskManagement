(function () {
    'use strict';

    if (window.__taskDeadlineIndicatorInitialized)
        return;

    window.__taskDeadlineIndicatorInitialized = true;

    const DAY_MS = 24 * 60 * 60 * 1000;
    const INDICATOR_WINDOW_MS = 2 * DAY_MS;

    function normalizeStatus(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[_-]/g, ' ')
            .replace(/\s+/g, ' ');
    }

    function parseDeadline(value) {
        if (!value) return null;

        const raw = String(value).trim();

        // Task dates are entered as date-only values. Treat the selected
        // end date as valid through 23:59:59 local time, so overdue starts
        // on the following calendar day.
        const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
        if (dateOnly) {
            return new Date(
                Number(dateOnly[1]),
                Number(dateOnly[2]) - 1,
                Number(dateOnly[3]) + 1,
                0, 0, 0, 0
            );
        }

        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return null;

        return new Date(
            parsed.getFullYear(),
            parsed.getMonth(),
            parsed.getDate() + 1,
            0, 0, 0, 0
        );
    }

    function formatRemaining(milliseconds) {
        const totalMinutes = Math.max(
            0,
            Math.floor(milliseconds / 60000)
        );

        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = totalMinutes % 60;

        if (days > 0) return days + 'd ' + hours + 'h';
        if (hours > 0) return hours + 'h ' + minutes + 'm';
        return minutes + 'm';
    }

    function getIndicator(card) {
        return card.querySelector('.task-deadline-indicator');
    }

    function ensureIndicator(card) {
        let indicator = getIndicator(card);

        if (indicator) return indicator;

        indicator = document.createElement('div');
        indicator.className = 'task-deadline-indicator';
        indicator.setAttribute('role', 'status');
        indicator.setAttribute('aria-live', 'polite');

        const anchor =
            card.querySelector('.task-meta') ||
            card.querySelector('.task-card-info') ||
            card.querySelector('.task-card-bottom');

        if (anchor) {
            anchor.insertAdjacentElement('afterend', indicator);
        } else {
            card.appendChild(indicator);
        }

        return indicator;
    }

    function removeIndicator(card) {
        getIndicator(card)?.remove();
    }

    function updateCard(card, now) {
        const status = normalizeStatus(card.dataset.status);
        const isCompleted = status === 'completed';
        const isCancelled = status === 'cancelled';

        if (isCompleted || isCancelled) {
            removeIndicator(card);
            return;
        }

        const deadline = parseDeadline(card.dataset.endDate);

        if (!deadline) {
            removeIndicator(card);
            return;
        }

        const remaining = deadline.getTime() - now.getTime();

        if (remaining <= 0) {
            // Overdue streak is calendar-day based, not a rolling 24-hour count.
            // Example: due Oct 1 -> Oct 2 = 1 day overdue, Oct 3 = 2 days.
            const dueDate = new Date(
                deadline.getFullYear(),
                deadline.getMonth(),
                deadline.getDate() - 1,
                0, 0, 0, 0
            );

            const currentDate = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                0, 0, 0, 0
            );

            const overdueDays = Math.max(
                1,
                Math.round(
                    (currentDate.getTime() - dueDate.getTime()) / DAY_MS
                )
            );

            const indicator = ensureIndicator(card);
            indicator.className = 'task-deadline-indicator is-overdue';
            indicator.innerHTML =
                '<span class="task-deadline-icon">🔥</span>' +
                '<span class="task-deadline-copy">' +
                    '<strong>OVERDUE</strong>' +
                    '<small>' +
                        overdueDays +
                        (overdueDays === 1 ? ' DAY' : ' DAYS') +
                        ' OVERDUE' +
                    '</small>' +
                '</span>';

            return;
        }

        if (remaining > INDICATOR_WINDOW_MS) {
            removeIndicator(card);
            return;
        }

        const indicator = ensureIndicator(card);
        const endDate = deadline;
        const currentDate = now;

        const dueToday =
            endDate.getFullYear() === currentDate.getFullYear() &&
            endDate.getMonth() === currentDate.getMonth() &&
            endDate.getDate() === currentDate.getDate();

        indicator.className =
            'task-deadline-indicator ' +
            (dueToday ? 'is-today' : 'is-tomorrow');

        indicator.innerHTML =
            '<span class="task-deadline-icon">' +
                (dueToday ? '⏰' : '⏳') +
            '</span>' +
            '<span class="task-deadline-copy">' +
                '<strong>' +
                    (dueToday ? 'DUE TODAY' : 'DEADLINE TOMORROW') +
                '</strong>' +
                '<small>' +
                    formatRemaining(remaining) +
                    ' remaining' +
                '</small>' +
            '</span>';
    }

    function updateAll() {
        const now = new Date();

        document
            .querySelectorAll('.task-card[data-end-date]')
            .forEach(card => updateCard(card, now));
    }

    // Board pages can replace task cards without observing the entire DOM.
    // Call this after a board re-render when needed.
    window.refreshTaskDeadlineIndicators = updateAll;

    function initialize() {
        updateAll();

        // The UI displays hours/minutes, so a 30-second refresh is enough.
        // Avoids needless DOM work every second.
        window.setInterval(updateAll, 30000);

        window.addEventListener(
            'taskmanager:task-status-changed',
            event => {
                const taskId = Number(
                    event.detail?.taskId ??
                    event.detail?.TaskId ??
                    0
                );

                if (!taskId) return;

                const card = document.querySelector(
                    '.task-card[data-task-id="' + taskId + '"]'
                );

                if (card) {
                    const status =
                        event.detail?.newStatus ??
                        event.detail?.NewStatus ??
                        card.dataset.status;

                    card.dataset.status = status || '';
                    updateCard(card, new Date());
                }
            }
        );
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
