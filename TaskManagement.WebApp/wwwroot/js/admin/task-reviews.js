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
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (!action) return;

        activeReview = { reviewId: Number(card.dataset.reviewId) };

        if (action === 'reject') {
            document.getElementById('rejectReason').value = '';
            bootstrap.Modal.getOrCreateInstance(
                document.getElementById('rejectReviewModal')
            ).show();
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

async function settle(payNow) {
    if (!activeReview?.reviewId) return;

    try {
        const response = await post(cfg.settleUrl, {
            id: activeReview.reviewId,
            payNow: String(payNow)
        });
        const data = await response.json();

        if (!response.ok || !data.success)
            throw new Error(data.message || 'Unable to settle payment.');

        bootstrap.Modal.getOrCreateInstance(
            document.getElementById('paymentReviewModal')
        ).hide();

        location.reload();
    }
    catch (error) {
        alert(error.message);
    }
}

document.getElementById('payNow')?.addEventListener('click', () => settle(true));
document.getElementById('payLater')?.addEventListener('click', () => settle(false));

document.querySelectorAll('.pending-pay-btn').forEach(button => {
    button.addEventListener('click', async () => {
        const id = Number(button.dataset.reviewId || 0);
        if (!id) return;

        try {
            await openPaymentModal(id);
        }
        catch (error) {
            alert(error.message);
        }
    });
});
})();