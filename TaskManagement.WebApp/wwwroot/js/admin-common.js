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
       ADMIN NOTIFICATION PANEL
    ===================================================== */

    const notificationButton =
        document.getElementById("adminNotificationButton");

    const notificationPanel =
        document.getElementById("adminNotificationPanel");

    const closeNotifications =
        document.getElementById("closeAdminNotifications");

    function closeAdminNotifications() {
        notificationPanel?.classList.remove("show");
        notificationPanel?.setAttribute("aria-hidden", "true");
    }

    notificationButton?.addEventListener("click", event => {
        event.stopPropagation();

        const isOpen =
            notificationPanel?.classList.toggle("show") ?? false;

        notificationPanel?.setAttribute(
            "aria-hidden",
            isOpen ? "false" : "true"
        );
    });

    closeNotifications?.addEventListener("click", event => {
        event.stopPropagation();
        closeAdminNotifications();
    });

    notificationPanel?.addEventListener("click", event => {
        event.stopPropagation();
    });

    document.addEventListener("click", event => {
        if (
            notificationPanel &&
            !notificationPanel.contains(event.target) &&
            !notificationButton?.contains(event.target)
        ) {
            closeAdminNotifications();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            notificationPanel?.classList.contains("show")
        ) {
            closeAdminNotifications();
        }
    });

    /* Keep the bell clean until the backend provides an Admin notification feed. */
    const notificationDot =
        document.getElementById("adminNotificationDot");

    notificationButton?.classList.remove("has-notification");

    if (notificationDot) {
        notificationDot.hidden = true;
    }

});