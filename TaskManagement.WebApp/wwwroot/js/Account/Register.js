document.addEventListener("DOMContentLoaded", () => {

    const registerForm = document.getElementById("registerForm");

    if (!registerForm) {
        return;
    }

    const fullNameInput = document.getElementById("FullName");
    const emailInput = document.getElementById("Email");

    const registerButton = document.getElementById("registerButton");
    const registerButtonText = document.getElementById("registerButtonText");
    const registerSpinner = document.getElementById("registerSpinner");

    const registerMessage = document.getElementById("registerMessage");

    const fullNameError = document.getElementById("fullNameError");
    const emailError = document.getElementById("emailError");

    registerForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        clearErrors();
        clearMessage();

        const fullName = fullNameInput.value.trim();
        const email = emailInput.value.trim();

        let isValid = true;

        if (!fullName) {
            fullNameError.textContent =
                "Please enter your full name.";
            isValid = false;
        }
        else if (fullName.length < 2) {
            fullNameError.textContent =
                "Name must contain at least 2 characters.";
            isValid = false;
        }

        if (!email) {
            emailError.textContent =
                "Please enter your email.";
            isValid = false;
        }
        else if (!isValidEmail(email)) {
            emailError.textContent =
                "Please enter a valid email address.";
            isValid = false;
        }

        if (!isValid) {
            return;
        }

        const tokenElement = document.querySelector(
            'input[name="__RequestVerificationToken"]'
        );

        if (!tokenElement) {
            showError(
                "Security token is missing. Please refresh the page."
            );
            return;
        }

        const registerData = {
            fullName: fullName,
            email: email
        };

        setLoading(true);

        try {

            const response = await fetch(
                "/Account/Register",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "RequestVerificationToken":
                            tokenElement.value
                    },

                    body: JSON.stringify(registerData)
                }
            );

            const result = await response.json();

            if (!response.ok) {

                showError(
                    result.message ||
                    "Registration failed. Please try again."
                );

                return;
            }

            showSuccess(
                result.message ||
                "Account request submitted successfully. You will be notified when your account is activated."
            );

            setTimeout(() => {

                window.location.href =
                    result.redirectUrl ||
                    "/Account/Login";

            }, 2000);

        }
        catch (error) {

            console.error(
                "Registration request failed:",
                error
            );

            showError(
                "Unable to connect to the server. Please try again."
            );

        }
        finally {

            setLoading(false);

        }

    });


    function isValidEmail(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    }


    function setLoading(isLoading) {

        registerButton.disabled = isLoading;

        if (isLoading) {

            registerButtonText.textContent =
                "Submitting request...";

            registerSpinner.classList.remove("d-none");

        }
        else {

            registerButtonText.textContent =
                "Create account";

            registerSpinner.classList.add("d-none");

        }

    }


    function showError(message) {

        registerMessage.className =
            "alert alert-danger account-alert";

        registerMessage.textContent = message;

        registerMessage.classList.remove("d-none");

    }


    function showSuccess(message) {

        registerMessage.className =
            "alert alert-success account-alert";

        registerMessage.textContent = message;

        registerMessage.classList.remove("d-none");

    }


    function clearMessage() {

        registerMessage.classList.add("d-none");

        registerMessage.textContent = "";

    }


    function clearErrors() {

        fullNameError.textContent = "";

        emailError.textContent = "";

    }

});