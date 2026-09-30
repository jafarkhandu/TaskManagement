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
