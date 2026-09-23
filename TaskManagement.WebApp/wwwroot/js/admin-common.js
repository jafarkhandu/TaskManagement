document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       LOGOUT
    ===================================================== */

    const logoutForms =
        document.querySelectorAll(
            ".admin-logout-form, .sidebar-logout-form"
        );


    logoutForms.forEach(function (form) {

        form.addEventListener("submit", async function (event) {

            event.preventDefault();


            const button =
                form.querySelector("button[type='submit']");


            if (button) {

                button.disabled = true;

                button.classList.add("logging-out");

            }


            const token =
                form.querySelector(
                    'input[name="__RequestVerificationToken"]'
                )?.value;


            if (!token) {

                console.error(
                    "Anti-forgery token not found."
                );

                window.location.href =
                    "/Account/Login";

                return;
            }


            try {

                const response =
                    await fetch(
                        form.action,
                        {
                            method: "POST",

                            headers: {
                                "RequestVerificationToken":
                                    token,

                                "X-Requested-With":
                                    "XMLHttpRequest"
                            },

                            body:
                                new URLSearchParams({
                                    "__RequestVerificationToken":
                                        token
                                })
                        }
                    );


                if (!response.ok) {

                    throw new Error(
                        "Logout request failed."
                    );

                }


                const result =
                    await response.json();


                if (
                    result.success === true
                ) {

                    window.location.replace(
                        result.redirectUrl ||
                        "/Account/Login"
                    );

                    return;

                }


                throw new Error(
                    result.message ||
                    "Logout failed."
                );

            }
            catch (error) {

                console.error(
                    "Logout error:",
                    error
                );


                if (button) {

                    button.disabled = false;

                    button.classList.remove(
                        "logging-out"
                    );

                }


                alert(
                    "Logout failed. Please try again."
                );

            }

        });

    });


    /* =====================================================
       CTRL + K SEARCH
    ===================================================== */

    const searchInput =
        document.getElementById(
            "adminGlobalSearch"
        );


    document.addEventListener(
        "keydown",
        function (event) {

            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "k"
            ) {

                event.preventDefault();

                if (searchInput) {

                    searchInput.focus();

                }

            }

        }
    );


    /* =====================================================
       ADMIN NOTIFICATION
    ===================================================== */

    const notificationButton =
        document.getElementById(
            "adminNotificationButton"
        );

    const notificationDot =
        document.getElementById(
            "adminNotificationDot"
        );


    function setNotificationState(
        hasNotification
    ) {

        if (!notificationButton)
            return;


        notificationButton.classList.toggle(
            "has-notification",
            hasNotification
        );


        if (notificationDot) {

            notificationDot.hidden =
                !hasNotification;

        }

    }


    /*
     * No fake notification.
     * Until a real Admin notification arrives,
     * the bell remains clean.
     */

    setNotificationState(false);

});