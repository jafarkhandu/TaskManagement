document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("paymentDetailsForm");
    const methodInput = document.getElementById("paymentMethod");
    const methodButtons = document.querySelectorAll(".method-option");
    const upiFields = document.getElementById("upiFields");
    const bankFields = document.getElementById("bankFields");
    const message = document.getElementById("paymentMessage");
    const saveButton = document.getElementById("savePaymentButton");
    const status = document.getElementById("paymentStatus");
    const statusText = document.getElementById("paymentStatusText");

    function setMethod(method) {
        methodInput.value = method;

        methodButtons.forEach(button => {
            button.classList.toggle("selected", button.dataset.method === method);
        });

        upiFields.classList.toggle("hidden", method !== "UPI");
        bankFields.classList.toggle("hidden", method !== "Bank");

        if (method === "UPI") {
            document.getElementById("upiId")?.focus();
        } else {
            document.getElementById("accountHolderName")?.focus();
        }
    }

    function showMessage(text, type) {
        message.textContent = text || "";
        message.className = "payment-message";
        if (type) message.classList.add(type);
    }

    methodButtons.forEach(button => {
        button.addEventListener("click", () => setMethod(button.dataset.method));
    });

    document.getElementById("ifscCode")?.addEventListener("input", event => {
        event.target.value = event.target.value
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 11)
            .toUpperCase();
    });

    document.getElementById("accountNumber")?.addEventListener("input", event => {
        event.target.value = event.target.value
            .replace(/\s/g, "")
            .slice(0, 30);
    });

    form?.addEventListener("submit", async event => {
        event.preventDefault();

        showMessage("", "");

        const confirmation = document.getElementById("confirmOriginalDetails");
        if (!confirmation?.checked) {
            showMessage("Please confirm that these are your own original payment details.", "error");
            confirmation?.focus();
            return;
        }

        if (methodInput.value === "UPI") {
            const upi = document.getElementById("upiId")?.value.trim() || "";
            const upiPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{1,254}@[A-Za-z][A-Za-z0-9.-]{1,63}$/;
            if (!upiPattern.test(upi)) {
                showMessage("Enter a valid UPI ID before saving.", "error");
                return;
            }
        } else {
            const holder = document.getElementById("accountHolderName")?.value.trim() || "";
            const bank = document.getElementById("bankName")?.value.trim() || "";
            const account = document.getElementById("accountNumber")?.value.trim() || "";
            const ifsc = document.getElementById("ifscCode")?.value.trim().toUpperCase() || "";

            if (!/^[A-Za-z][A-Za-z .'-]{1,99}$/.test(holder)) {
                showMessage("Enter a valid account holder name.", "error");
                return;
            }

            if (!/^[A-Za-z0-9][A-Za-z0-9 &'().,-]{1,99}$/.test(bank)) {
                showMessage("Enter a valid bank name.", "error");
                return;
            }

            if (!/^[0-9]{9,18}$/.test(account)) {
                showMessage("Account number must contain 9 to 18 digits only.", "error");
                return;
            }

            if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
                showMessage("Enter a valid 11-character IFSC code.", "error");
                return;
            }
        }

        showMessage("Checking your payment details...", "checking");
        saveButton.disabled = true;
        saveButton.innerHTML = "<span>…</span> Saving...";

        try {
            const response = await fetch(form.action, {
                method: "POST",
                headers: {
                    "RequestVerificationToken":
                        form.querySelector('input[name="__RequestVerificationToken"]')?.value || ""
                },
                body: new FormData(form)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to save payment details.");
            }

            showMessage(result.message, "success");
            status.classList.remove("empty");
            status.classList.add("saved");
            statusText.textContent = "Details Saved";
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = "<span>✓</span> Save Payment Details";
        }
    });
});
