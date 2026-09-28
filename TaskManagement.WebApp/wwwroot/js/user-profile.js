document.addEventListener("DOMContentLoaded", function () {
    const passwordSection = document.getElementById("passwordSection");
    const openPasswordSection = document.getElementById("openPasswordSection");
    const passwordForm = document.getElementById("passwordChangeForm");
    const otpPanel = document.getElementById("otpPanel");
    const sendOtpButton = document.getElementById("sendOtpButton");
    const verifyOtpButton = document.getElementById("verifyOtpButton");
    const resendOtpButton = document.getElementById("resendOtpButton");
    const otpInput = document.getElementById("otpInput");
    const passwordFormMessage = document.getElementById("passwordFormMessage");
    const otpFormMessage = document.getElementById("otpFormMessage");
    const otpMessage = document.getElementById("otpMessage");
    const otpExpiryCountdown = document.getElementById("otpExpiryCountdown");

    let expiresAt = 0;
    let resendAvailableAt = 0;
    let countdownTimer = null;

    function token() {
        const input = document.querySelector('input[name="__RequestVerificationToken"]');
        return input ? input.value : "";
    }

    function setMessage(element, message, type) {
        if (!element) return;

        element.textContent = message || "";
        element.className = "profile-form-message";

        if (type) {
            element.classList.add(type);
        }
    }

    function formatCountdown(seconds) {
        const safe = Math.max(0, Math.floor(seconds));
        const minutes = Math.floor(safe / 60);
        const remaining = safe % 60;

        return String(minutes).padStart(2, "0") + ":" +
            String(remaining).padStart(2, "0");
    }

    function startCountdown() {
        clearInterval(countdownTimer);

        function tick() {
            const now = Date.now();

            const expirySeconds = Math.max(
                0,
                Math.ceil((expiresAt - now) / 1000)
            );

            const resendSeconds = Math.max(
                0,
                Math.ceil((resendAvailableAt - now) / 1000)
            );

            if (otpExpiryCountdown) {
                otpExpiryCountdown.textContent =
                    formatCountdown(expirySeconds);
            }

            if (resendOtpButton) {
                resendOtpButton.disabled =
                    resendSeconds > 0 ||
                    otpInput.value.length !== 6;

                resendOtpButton.textContent =
                    resendSeconds > 0
                        ? "Resend in " + resendSeconds + "s"
                        : "Resend OTP";
            }

            if (expirySeconds <= 0) {
                clearInterval(countdownTimer);

                setMessage(
                    otpFormMessage,
                    "OTP expired. Request a new OTP.",
                    "error"
                );

                if (verifyOtpButton) {
                    verifyOtpButton.disabled = true;
                }
            }
        }

        tick();
        countdownTimer = setInterval(tick, 1000);
    }

    function formData() {
        return new URLSearchParams({
            currentPassword:
                document.getElementById("currentPassword")?.value || "",
            newPassword:
                document.getElementById("newPassword")?.value || "",
            confirmPassword:
                document.getElementById("confirmPassword")?.value || ""
        });
    }

    async function post(url, body) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded; charset=UTF-8",
                "RequestVerificationToken": token()
            },
            body: body
        });

        let result = {};

        try {
            result = await response.json();
        } catch {
            result = {
                success: false,
                message: "Unexpected server response."
            };
        }

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to complete the request."
            );
        }

        return result;
    }

    openPasswordSection?.addEventListener("click", function () {
        passwordSection?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        document.getElementById("currentPassword")?.focus();
    });

    document.querySelectorAll(".password-toggle").forEach(function (button) {
        button.addEventListener("click", function () {
            const target = document.getElementById(button.dataset.target);

            if (!target) return;

            const showing = target.type === "text";
            target.type = showing ? "password" : "text";
            button.textContent = showing ? "Show" : "Hide";
        });
    });

    otpInput?.addEventListener("input", function () {
        otpInput.value = otpInput.value
            .replace(/\D/g, "")
            .slice(0, 6);

        if (resendOtpButton && resendAvailableAt) {
            resendOtpButton.disabled =
                Date.now() < resendAvailableAt ||
                otpInput.value.length !== 6;
        }
    });

    passwordForm?.addEventListener("submit", async function (event) {
        event.preventDefault();

        setMessage(passwordFormMessage, "");
        setMessage(otpFormMessage, "");

        sendOtpButton.disabled = true;
        sendOtpButton.innerHTML = "<span>…</span> Sending OTP...";

        try {
            const result = await post(
                "/User/Profile/SendPasswordChangeOtp",
                formData()
            );

            expiresAt = new Date(result.expiresAt).getTime();
            resendAvailableAt =
                new Date(result.resendAvailableAt).getTime();

            otpPanel.hidden = false;
            otpInput.value = "";
            verifyOtpButton.disabled = false;

            otpMessage.textContent =
                result.message ||
                "OTP sent to your registered email address.";

            setMessage(
                passwordFormMessage,
                "OTP sent successfully.",
                "success"
            );

            startCountdown();

            otpPanel.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            otpInput.focus();
        } catch (error) {
            setMessage(
                passwordFormMessage,
                error.message,
                "error"
            );
        } finally {
            sendOtpButton.disabled = false;
            sendOtpButton.innerHTML =
                "<span>✉</span> Send OTP to Email";
        }
    });

    verifyOtpButton?.addEventListener("click", async function () {
        if (otpInput.value.length !== 6) {
            setMessage(
                otpFormMessage,
                "Enter the complete 6-digit OTP.",
                "error"
            );
            return;
        }

        verifyOtpButton.disabled = true;
        setMessage(otpFormMessage, "");

        const body = formData();
        body.set("otp", otpInput.value);

        try {
            const result = await post(
                "/User/Profile/VerifyPasswordChangeOtp",
                body
            );

            clearInterval(countdownTimer);

            setMessage(
                otpFormMessage,
                result.message,
                "success"
            );

            passwordForm.reset();
            otpInput.value = "";
            otpPanel.hidden = true;
            expiresAt = 0;
            resendAvailableAt = 0;
        } catch (error) {
            setMessage(
                otpFormMessage,
                error.message,
                "error"
            );

            verifyOtpButton.disabled = false;
        }
    });

    resendOtpButton?.addEventListener("click", async function () {
        if (Date.now() < resendAvailableAt)
            return;

        resendOtpButton.disabled = true;
        setMessage(otpFormMessage, "");

        try {
            const result = await post(
                "/User/Profile/SendPasswordChangeOtp",
                formData()
            );

            expiresAt = new Date(result.expiresAt).getTime();
            resendAvailableAt =
                new Date(result.resendAvailableAt).getTime();

            otpInput.value = "";
            verifyOtpButton.disabled = false;

            setMessage(
                otpFormMessage,
                result.message,
                "success"
            );

            startCountdown();
            otpInput.focus();
        } catch (error) {
            setMessage(
                otpFormMessage,
                error.message,
                "error"
            );
        }
    });
});
