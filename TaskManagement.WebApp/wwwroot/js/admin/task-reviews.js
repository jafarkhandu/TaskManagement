(() => {
const cfg = window.taskReviewConfig || {};
let activeReview = null;
const token = () => document.querySelector('#reviewAntiForgery input[name="__RequestVerificationToken"]')?.value || '';

function post(url, data) {
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'RequestVerificationToken': token(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: new URLSearchParams(data)
    });
}

function fillPaymentModal(x) {
    const isLate = Boolean(x.isLate);

    document.getElementById('paymentTaskTitle').textContent = x.taskTitle || 'Payment Details';
    document.getElementById('paymentUserName').textContent = x.userName || '-';
    document.getElementById('paymentAmount').textContent =
        '₹ ' + (isLate ? '0.00' : Number(x.amount || 0).toFixed(2));

    const eligibility = document.getElementById('paymentEligibility');
    if (eligibility) {
        eligibility.textContent = isLate
            ? 'WITHHELD · LATE SUBMISSION'
            : 'ELIGIBLE · FULL PAYMENT';
        eligibility.classList.toggle('payment-withheld', isLate);
        eligibility.classList.toggle('payment-eligible', !isLate);
    }

    const warning = document.getElementById('paymentReviewWarning');
    if (warning) {
        warning.innerHTML = isLate
            ? '<b>Payment withheld:</b> this task was submitted after the deadline. The payable amount is ₹0.00.'
            : 'Payment is handled by the admin outside this workflow. Use <b>Pay Now</b> only after you have actually settled the amount.';
        warning.classList.toggle('payment-review-warning-late', isLate);
    }

    document.getElementById('paymentMethod').textContent = isLate
        ? 'Not required'
        : (x.paymentMethod || 'Not set');
    document.getElementById('paymentUpi').textContent = x.upiId || '-';
    document.getElementById('paymentHolder').textContent = x.accountHolderName || '-';
    document.getElementById('paymentBank').textContent = x.bankName || '-';
    document.getElementById('paymentAccount').textContent = x.accountNumber || '-';
    document.getElementById('paymentIfsc').textContent = x.ifscCode || '-';

    const qr = document.getElementById('paymentQrImage');
    const upiPanel = document.getElementById('paymentUpiPanel');
    const bankPanel = document.getElementById('paymentBankPanel');

    const method = String(x.paymentMethod || '').trim().toUpperCase();
    const isUpi = !isLate && method === 'UPI' && !!x.upiId;
    const hasBankDetails =
        !!x.accountHolderName ||
        !!x.bankName ||
        !!x.accountNumber ||
        !!x.ifscCode;

    // Show only the payment method the user has actually configured.
    // UPI: QR + UPI ID only. Bank: bank details only.
    if (isUpi) {
        if (upiPanel) upiPanel.style.display = 'flex';
        if (bankPanel) bankPanel.style.display = 'none';

        if (qr) {
            qr.src = '/Admin/Users/PaymentQr?upiId=' + encodeURIComponent(x.upiId) + '&v=' + Date.now();
            qr.style.display = 'block';
            qr.alt = 'UPI payment QR for ' + x.upiId;
        }
    } else {
        if (upiPanel) upiPanel.style.display = 'none';
        if (bankPanel) bankPanel.style.display = hasBankDetails ? 'grid' : 'none';

        if (qr) {
            qr.removeAttribute('src');
            qr.style.display = 'none';
        }
    }
}

async function openPaymentModal(reviewId) {
    const response = await fetch('/Admin/TaskReviews/Details?id=' + encodeURIComponent(reviewId), {
        credentials: 'same-origin',
        cache: 'no-store'
    });
    const data = await response.json();

    if (!response.ok || !data.success)
        throw new Error(data.message || 'Unable to load payment details.');

    activeReview = data.data;
    fillPaymentModal(activeReview);

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById('paymentReviewModal')
    ).show();
}

document.querySelectorAll('.review-card').forEach(card => {
    card.addEventListener('click', async event => {
        const actionButton = event.target.closest('[data-action]');
        const action = actionButton?.dataset.action;
        if (!action) return;

        activeReview = { reviewId: Number(card.dataset.reviewId) };

        if (action === 'reject') {
            document.getElementById('rejectReason').value = '';
            bootstrap.Modal.getOrCreateInstance(
                document.getElementById('rejectReviewModal')
            ).show();
            return;
        }

        if (action === 'approve' && card.dataset.late === 'true') {
            if (actionButton) {
                actionButton.disabled = true;
            }

            // Late submissions never enter the payment modal. The existing
            // settlement endpoint already converts them to Completed + ₹0 +
            // Withheld, so this keeps the new path centralized on the backend.
            const settled = await settle(false, false);

            if (!settled && actionButton) {
                actionButton.disabled = false;
            }

            return;
        }

        try {
            const response = await post(cfg.approveUrl, { id: activeReview.reviewId });
            const data = await response.json();

            if (!response.ok || !data.success)
                throw new Error(data.message || 'Unable to approve review.');

            await openPaymentModal(activeReview.reviewId);
        }
        catch (error) {
            alert(error.message);
        }
    });
});

document.getElementById('confirmReject')?.addEventListener('click', async () => {
    const reason = document.getElementById('rejectReason').value.trim();
    const errorBox = document.getElementById('rejectError');

    if (!reason) {
        errorBox.textContent = 'Rejection reason is required.';
        return;
    }

    try {
        const response = await post(cfg.rejectUrl, {
            id: activeReview?.reviewId || 0,
            reason
        });
        const data = await response.json();

        if (!response.ok || !data.success)
            throw new Error(data.message || 'Unable to reject task.');

        location.reload();
    }
    catch (error) {
        errorBox.textContent = error.message;
    }
});

async function settle(payNow, closePaymentModal = true) {
    if (!activeReview?.reviewId) return false;

    try {
        const response = await post(cfg.settleUrl, {
            id: activeReview.reviewId,
            payNow: String(payNow)
        });
        const data = await response.json();

        if (!response.ok || !data.success)
            throw new Error(data.message || 'Unable to settle payment.');

        if (closePaymentModal) {
            bootstrap.Modal.getOrCreateInstance(
                document.getElementById('paymentReviewModal')
            ).hide();
        }

        location.reload();
        return true;
    }
    catch (error) {
        alert(error.message);
        return false;
    }
}

document.getElementById('payNow')?.addEventListener('click', () => settle(true));
document.getElementById('payLater')?.addEventListener('click', () => settle(false));

// Dashboard "Pay Now" can land directly on the payment modal.
const dashboardPaymentId = Number(
    new URLSearchParams(window.location.search).get('paymentId') || 0
);

if (dashboardPaymentId) {
    openPaymentModal(dashboardPaymentId).catch(error => {
        alert(error.message);
    });
}
})();

// Reference-style scenario and full-queue interactions.
function openScenarioModal(button) {
    const title = button.dataset.taskTitle || 'Scenario';
    const scenario = button.dataset.scenario || 'No scenario provided.';
    const titleEl = document.getElementById('scenarioModalTitle');
    const textEl = document.getElementById('scenarioModalText');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = scenario.trim() || 'No scenario provided.';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('scenarioModal')).show();
}

document.addEventListener('click', async event => {
    const fullAction = event.target.closest('.all-review-action');
    if (fullAction) {
        activeReview = { reviewId: Number(fullAction.dataset.reviewId || 0) };
        const action = fullAction.dataset.action;
        if (!activeReview.reviewId) return;

        if (action === 'reject') {
            document.getElementById('rejectReason').value = '';
            bootstrap.Modal.getOrCreateInstance(
                document.getElementById('rejectReviewModal')
            ).show();
            return;
        }

        if (action === 'approve' && fullAction.dataset.late === 'true') {
            fullAction.disabled = true;
            const settled = await settle(false, false);
            if (!settled) fullAction.disabled = false;
            return;
        }

        try {
            const response = await post(cfg.approveUrl, { id: activeReview.reviewId });
            const data = await response.json();
            if (!response.ok || !data.success)
                throw new Error(data.message || 'Unable to approve review.');
            await openPaymentModal(activeReview.reviewId);
        } catch (error) {
            alert(error.message);
        }
        return;
    }

    const scenarioButton = event.target.closest('.scenario-open-btn');
    if (scenarioButton) {
        openScenarioModal(scenarioButton);
        return;
    }

    const payButton = event.target.closest('.pending-pay-btn');
    if (payButton) {
        const id = Number(payButton.dataset.reviewId || 0);
        if (!id) return;
        openPaymentModal(id).catch(error => alert(error.message));
    }
});

function filterReviewQueue() {
    const query = (document.getElementById('allReviewsSearch')?.value || '').trim().toLowerCase();
    const status = document.getElementById('allReviewsStatus')?.value || '';
    const priority = document.getElementById('allReviewsPriority')?.value || '';

    document.querySelectorAll('#allReviewsList .all-review-item').forEach(item => {
        const matchesQuery = !query || item.dataset.search.includes(query);
        const matchesStatus = !status || item.dataset.status === status;
        const matchesPriority = !priority || item.dataset.priority.includes(priority);
        item.style.display = matchesQuery && matchesStatus && matchesPriority ? '' : 'none';
    });
}

function filterPaymentQueue() {
    const query = (document.getElementById('allPaymentsSearch')?.value || '').trim().toLowerCase();
    document.querySelectorAll('#allPaymentsList .all-payment-item').forEach(item => {
        item.style.display = !query || item.dataset.search.includes(query) ? '' : 'none';
    });
}

document.getElementById('allReviewsSearch')?.addEventListener('input', filterReviewQueue);
document.getElementById('allReviewsStatus')?.addEventListener('change', filterReviewQueue);
document.getElementById('allReviewsPriority')?.addEventListener('change', filterReviewQueue);
document.getElementById('allPaymentsSearch')?.addEventListener('input', filterPaymentQueue);
