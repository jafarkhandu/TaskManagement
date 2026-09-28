document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const forgotLink = document.getElementById("forgotPasswordLink");
    const panel = document.getElementById("forgotPasswordPanel");
    const backButton = document.getElementById("forgotBackButton");

    if (!panel || !forgotLink || !loginForm) return;

    const emailInput = document.getElementById("Email");
    const forgotEmail = document.getElementById("forgotEmail");
    const message = document.getElementById("forgotMessage");
    const stepEmail = document.getElementById("forgotStepEmail");
    const stepOtp = document.getElementById("forgotStepOtp");
    const stepReset = document.getElementById("forgotStepReset");
    const title = document.getElementById("forgotPanelTitle");
    const subtitle = document.getElementById("forgotPanelSubtitle");

    const sendButton = document.getElementById("sendForgotOtpButton");
    const sendText = document.getElementById("sendForgotOtpText");
    const sendSpinner = document.getElementById("sendForgotOtpSpinner");
    const verifyButton = document.getElementById("verifyForgotOtpButton");
    const resendButton = document.getElementById("resendForgotOtpButton");
    const resetButton = document.getElementById("resetForgotPasswordButton");
    const newPassword = document.getElementById("forgotNewPassword");
    const confirmPassword = document.getElementById("forgotConfirmPassword");
    const countdown = document.getElementById("otpCountdown");
    const otpInputs = [...document.querySelectorAll(".otp-input")];

    let email = "";
    let countdownTimer = null;
    let otpVerified = false;

    const token = () =>
        document.querySelector('input[name="__RequestVerificationToken"]')?.value || "";

    function showMessage(text, type = "danger") {
        message.className = `alert alert-${type} account-alert`;
        message.textContent = text;
        message.classList.remove("d-none");
    }

    function clearMessage() {
        message.className = "alert d-none account-alert";
        message.textContent = "";
    }

    function setStep(step) {
        stepEmail.classList.toggle("d-none", step !== "email");
        stepOtp.classList.toggle("d-none", step !== "otp");
        stepReset.classList.toggle("d-none", step !== "reset");

        if (step === "email") {
            title.textContent = "Forgot password?";
            subtitle.textContent = "Enter your registered email and we'll send you a verification OTP.";
        } else if (step === "otp") {
            title.textContent = "Verify OTP";
            subtitle.textContent = "Enter the 6-digit OTP sent to your registered email.";
        } else {
            title.textContent = "Reset password";
            subtitle.textContent = "Create a new password for your account.";
        }
    }

    function startCountdown(seconds) {
        clearInterval(countdownTimer);
        let remaining = Number(seconds) || 600;

        const tick = () => {
            const minutes = Math.floor(remaining / 60);
            const secondsLeft = remaining % 60;
            countdown.textContent =
                `OTP expires in ${minutes}:${String(secondsLeft).padStart(2, "0")}`;

            if (remaining <= 0) {
                clearInterval(countdownTimer);
                countdown.textContent = "OTP expired. Please request a new one.";
                resendButton.disabled = false;
                return;
            }

            remaining--;
        };

        tick();
        countdownTimer = setInterval(tick, 1000);
    }

    function startResendCooldown(seconds) {
        resendButton.disabled = true;
        let remaining = Number(seconds) || 60;

        const tick = () => {
            if (remaining <= 0) {
                resendButton.disabled = false;
                resendButton.textContent = "Resend OTP";
                return;
            }

            resendButton.textContent = `Resend OTP (${remaining}s)`;
            remaining--;
            setTimeout(tick, 1000);
        };

        tick();
    }

    async function postJson(url, data) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": token()
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Something went wrong.");
        }

        return result;
    }

    function openForgot() {
        clearMessage();
        otpVerified = false;
        email = emailInput?.value.trim() || "";
        forgotEmail.value = email;
        loginForm.classList.add("d-none");
        document.querySelector(".form-bottom")?.classList.add("d-none");
        document.querySelector(".security-note")?.classList.add("d-none");
        panel.classList.remove("d-none");
        panel.setAttribute("aria-hidden", "false");
        setStep("email");
        forgotEmail.focus();
    }

    function closeForgot() {
        clearInterval(countdownTimer);
        clearMessage();
        panel.classList.add("d-none");
        panel.setAttribute("aria-hidden", "true");
        loginForm.classList.remove("d-none");
        document.querySelector(".form-bottom")?.classList.remove("d-none");
        document.querySelector(".security-note")?.classList.remove("d-none");
        setStep("email");
    }

    forgotLink.addEventListener("click", openForgot);
    backButton.addEventListener("click", closeForgot);

    sendButton.addEventListener("click", async () => {
        clearMessage();
        const value = forgotEmail.value.trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            showMessage("Please enter a valid email address.");
            return;
        }

        sendButton.disabled = true;
        sendText.textContent = "Sending...";
        sendSpinner.classList.remove("d-none");

        try {
            const result = await postJson("/Account/SendForgotPasswordOtp", { email: value });
            email = value;
            setStep("otp");
            showMessage(result.message, "success");
            startCountdown(result.expiresInSeconds);
            startResendCooldown(result.resendCooldownSeconds);
            otpInputs[0]?.focus();
        } catch (error) {
            showMessage(error.message);
        } finally {
            sendButton.disabled = false;
            sendText.textContent = "Send OTP";
            sendSpinner.classList.add("d-none");
        }
    });

    otpInputs.forEach((input, index) => {
        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "").slice(0, 1);
            if (input.value && otpInputs[index + 1]) otpInputs[index + 1].focus();
        });

        input.addEventListener("keydown", event => {
            if (event.key === "Backspace" && !input.value && otpInputs[index - 1]) {
                otpInputs[index - 1].focus();
            }
        });

        input.addEventListener("paste", event => {
            event.preventDefault();
            const pasted = (event.clipboardData.getData("text") || "")
                .replace(/\D/g, "").slice(0, 6);

            pasted.split("").forEach((char, i) => {
                if (otpInputs[i]) otpInputs[i].value = char;
            });

            otpInputs[Math.min(pasted.length, 5)]?.focus();
        });
    });

    verifyButton.addEventListener("click", async () => {
        clearMessage();
        const otp = otpInputs.map(input => input.value).join("");

        if (otp.length !== 6) {
            showMessage("Please enter the complete 6-digit OTP.");
            return;
        }

        verifyButton.disabled = true;

        try {
            const result = await postJson("/Account/VerifyForgotPasswordOtp", { email, otp });
            otpVerified = true;
            clearInterval(countdownTimer);
            setStep("reset");
            showMessage(result.message, "success");
            newPassword.focus();
        } catch (error) {
            showMessage(error.message);
        } finally {
            verifyButton.disabled = false;
        }
    });

    resendButton.addEventListener("click", async () => {
        if (resendButton.disabled) return;
        forgotEmail.value = email;
        sendButton.click();
    });

    resetButton.addEventListener("click", async () => {
        clearMessage();

        if (!otpVerified) {
            showMessage("Please verify the OTP first.");
            return;
        }

        if (!newPassword.value || !confirmPassword.value) {
            showMessage("Please enter and confirm your new password.");
            return;
        }

        if (newPassword.value !== confirmPassword.value) {
            showMessage("Passwords do not match.");
            return;
        }

        resetButton.disabled = true;

        try {
            const result = await postJson("/Account/ResetForgotPassword", {
                email,
                newPassword: newPassword.value,
                confirmPassword: confirmPassword.value
            });

            showMessage(result.message, "success");
            setTimeout(() => {
                closeForgot();
                document.getElementById("loginMessage").className =
                    "alert alert-success account-alert";
                document.getElementById("loginMessage").textContent =
                    "Password changed successfully. Please sign in.";
                document.getElementById("loginMessage").classList.remove("d-none");
            }, 900);
        } catch (error) {
            showMessage(error.message);
        } finally {
            resetButton.disabled = false;
        }
    });
});
