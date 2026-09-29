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


    // ================= PROFILE DETAILS =================
    const editProfileButton = document.getElementById("editProfileButton");
    const cancelProfileEdit = document.getElementById("cancelProfileEdit");
    const profileDetailsForm = document.getElementById("profileDetailsForm");
    const profileEditActions = document.getElementById("profileEditActions");
    const profileDetailsMessage = document.getElementById("profileDetailsMessage");
    const profileCompletionValue = document.getElementById("profileCompletionValue");
    const profileCompletionBar = document.getElementById("profileCompletionBar");
    const profileCompletionMessage = document.getElementById("profileCompletionMessage");
    const profileFields = profileDetailsForm?.querySelectorAll("input") || [];
    const profileOriginal = {};

    profileFields.forEach(function (field) {
        profileOriginal[field.name] = field.value;
    });

    function setProfileEditing(enabled) {
        profileFields.forEach(function (field) {
            field.disabled = !enabled;
        });
        if (profileEditActions) profileEditActions.hidden = !enabled;
        if (editProfileButton) editProfileButton.hidden = enabled;
        if (enabled) document.getElementById("profileFullName")?.focus();
    }

    function updateCompletion(percent, complete) {
        if (profileCompletionValue) profileCompletionValue.textContent = percent + "%";
        if (profileCompletionBar) profileCompletionBar.style.width = percent + "%";
        if (profileCompletionMessage) {
            profileCompletionMessage.classList.toggle("complete", complete);
            profileCompletionMessage.textContent = complete
                ? ""
                : "To complete your profile, fill in all the fields.";
        }
    }

    editProfileButton?.addEventListener("click", function () {
        setProfileEditing(true);
        setMessage(profileDetailsMessage, "");
    });

    cancelProfileEdit?.addEventListener("click", function () {
        profileFields.forEach(function (field) { field.value = profileOriginal[field.name] || ""; });
        setProfileEditing(false);
        setMessage(profileDetailsMessage, "");
    });

    profileDetailsForm?.addEventListener("submit", async function (event) {
        event.preventDefault();
        const button = document.getElementById("saveProfileButton");
        if (button) button.disabled = true;
        setMessage(profileDetailsMessage, "");

        try {
            const body = new URLSearchParams();
            profileFields.forEach(function (field) { body.set(field.name, field.value); });
            const result = await post("/User/Profile/UpdateProfile", body);
            profileFields.forEach(function (field) { profileOriginal[field.name] = field.value; });
            updateCompletion(result.profileCompletionPercentage, result.isProfileComplete);
            setMessage(profileDetailsMessage, result.message, "success");
            setProfileEditing(false);
            const heroName = document.querySelector(".profile-hero-copy h1");
            if (heroName) heroName.textContent = result.fullName;
        } catch (error) {
            setMessage(profileDetailsMessage, error.message, "error");
        } finally {
            if (button) button.disabled = false;
        }
    });

    // Keep the shared account modal avatar synchronized with the profile photo.
    function syncAccountModalPhoto() {
        const modalAvatar = document.querySelector("#profileModal .profile-avatar");
        const heroPhoto = document.querySelector("#profileHeroAvatar img");
        if (!modalAvatar) return;

        if (heroPhoto?.src) {
            modalAvatar.classList.add("has-photo");
            modalAvatar.innerHTML = "";
            const img = document.createElement("img");
            img.src = heroPhoto.src;
            img.alt = "Profile picture";
            modalAvatar.appendChild(img);
        } else {
            modalAvatar.classList.remove("has-photo");
            const name = document.getElementById("profileFullName")?.value || "Student";
            modalAvatar.textContent = name.charAt(0).toUpperCase();
        }
    }

    syncAccountModalPhoto();

    // ================= PROFILE PHOTO =================
    const photoModal = document.getElementById("profilePhotoModal");
    const openPhotoButton = document.getElementById("changeProfilePhotoButton");
    const closePhotoButton = document.getElementById("closeProfilePhotoModal");
    const uploadPhotoButton = document.getElementById("uploadPhotoButton");
    const cameraPhotoButton = document.getElementById("cameraPhotoButton");
    const capturePhotoButton = document.getElementById("capturePhotoButton");
    const retakePhotoButton = document.getElementById("retakePhotoButton");
    const savePhotoButton = document.getElementById("savePhotoButton");
    const removePhotoButton = document.getElementById("removePhotoButton");
    const photoFileInput = document.getElementById("profilePhotoFile");
    const photoPreview = document.getElementById("profilePhotoPreview");
    const cameraPreview = document.getElementById("profileCameraPreview");
    const cameraCanvas = document.getElementById("profileCameraCanvas");
    const photoMessage = document.getElementById("profilePhotoMessage");
    let photoBlob = null;
    let cameraStream = null;

    function closeCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        cameraStream = null;

        if (cameraPreview) {
            cameraPreview.srcObject = null;
            cameraPreview.hidden = true;
        }

        // Capture/Retake controls belong only to an active camera session.
        if (capturePhotoButton) capturePhotoButton.hidden = true;
        if (retakePhotoButton) retakePhotoButton.hidden = true;
    }

    function showPhotoPreview(blobOrFile) {
        if (!blobOrFile || !photoPreview) return;
        const url = URL.createObjectURL(blobOrFile);
        photoPreview.innerHTML = "<img src='" + url + "' alt='Selected profile picture' />";
        photoBlob = blobOrFile;
        if (savePhotoButton) savePhotoButton.disabled = false;
        if (capturePhotoButton) capturePhotoButton.hidden = true;
        if (retakePhotoButton) retakePhotoButton.hidden = true;
    }

    openPhotoButton?.addEventListener("click", function () {
        if (!photoModal) return;

        // Every new modal session starts cleanly.
        closeCamera();
        photoModal.hidden = false;
        photoBlob = null;

        if (photoFileInput) photoFileInput.value = "";
        if (savePhotoButton) savePhotoButton.disabled = true;
        setMessage(photoMessage, "");
    });

    closePhotoButton?.addEventListener("click", function () {
        closeCamera();
        photoBlob = null;
        if (photoFileInput) photoFileInput.value = "";
        if (savePhotoButton) savePhotoButton.disabled = true;
        photoModal.hidden = true;
    });

    photoModal?.addEventListener("click", function (event) {
        if (event.target === photoModal) {
            closeCamera();
            photoBlob = null;
            if (photoFileInput) photoFileInput.value = "";
            if (savePhotoButton) savePhotoButton.disabled = true;
            photoModal.hidden = true;
        }
    });

    uploadPhotoButton?.addEventListener("click", function () { photoFileInput?.click(); });

    photoFileInput?.addEventListener("change", function () {
        const file = photoFileInput.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setMessage(photoMessage, "Photo must be 5 MB or smaller.", "error"); return; }
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMessage(photoMessage, "Use JPG, PNG or WEBP.", "error"); return; }
        closeCamera(); showPhotoPreview(file); setMessage(photoMessage, "Photo ready to save.", "success");
    });

    cameraPhotoButton?.addEventListener("click", async function () {
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
            cameraPreview.srcObject = cameraStream;
            cameraPreview.hidden = false;
            capturePhotoButton.hidden = false;
            retakePhotoButton.hidden = true;
            savePhotoButton.disabled = true;
            setMessage(photoMessage, "Camera ready. Take your photo.", "success");
        } catch (error) {
            setMessage(photoMessage, "Camera access was unavailable or denied. Please allow camera access or use Upload Photo.", "error");
        }
    });

    capturePhotoButton?.addEventListener("click", function () {
        if (!cameraPreview.videoWidth) return;
        cameraCanvas.width = cameraPreview.videoWidth;
        cameraCanvas.height = cameraPreview.videoHeight;
        cameraCanvas.getContext("2d").drawImage(cameraPreview, 0, 0);
        cameraCanvas.toBlob(function (blob) {
            if (blob) {
                showPhotoPreview(blob);
                closeCamera();
                retakePhotoButton.hidden = false;
                setMessage(photoMessage, "Photo captured. You can retake or save it.", "success");
            }
        }, "image/jpeg", 0.9);
    });

    retakePhotoButton?.addEventListener("click", function () {
        closeCamera();
        cameraPhotoButton?.click();
    });

    savePhotoButton?.addEventListener("click", async function () {
        if (!photoBlob) return;
        savePhotoButton.disabled = true;
        const body = new FormData();
        body.append("file", photoBlob, "profile-photo.jpg");
        try {
            const response = await fetch("/User/Profile/UploadProfilePicture", {
                method: "POST", headers: { "RequestVerificationToken": token() }, body
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || "Unable to save photo.");
            const img = document.createElement("img");
            img.src = result.profilePictureUrl + "?v=" + Date.now();
            img.alt = "Profile picture";
            const hero = document.getElementById("profileHeroAvatar");
            hero.innerHTML = ""; hero.appendChild(img); hero.classList.add("has-photo");
            if (removePhotoButton) removePhotoButton.hidden = false;
            syncAccountModalPhoto();
            setMessage(photoMessage, result.message, "success");
            setTimeout(function () { closeCamera(); photoModal.hidden = true; }, 600);
        } catch (error) {
            setMessage(photoMessage, error.message, "error");
            savePhotoButton.disabled = false;
        }
    });

    removePhotoButton?.addEventListener("click", async function () {
        removePhotoButton.disabled = true;
        try {
            const result = await post("/User/Profile/RemoveProfilePicture", new URLSearchParams());
            const hero = document.getElementById("profileHeroAvatar");
            const name = document.getElementById("profileFullName")?.value || "Student";
            hero.classList.remove("has-photo"); hero.textContent = name.charAt(0).toUpperCase();
            removePhotoButton.hidden = true;
            photoBlob = null;
            syncAccountModalPhoto();
            setMessage(photoMessage, result.message, "success");
        } catch (error) {
            setMessage(photoMessage, error.message, "error");
        } finally { removePhotoButton.disabled = false; }
    });
});
