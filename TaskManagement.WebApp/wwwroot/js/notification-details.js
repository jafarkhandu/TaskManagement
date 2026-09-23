document.addEventListener("DOMContentLoaded", () => {

    const details = window.notificationDetails;

    if (!details) {
        return;
    }

    const acceptButton =
        document.getElementById("acceptButton");

    const rejectButton =
        document.getElementById("rejectButton");

    const antiForgeryToken =
        document.querySelector(
            '#antiForgeryForm input[name="__RequestVerificationToken"]'
        )?.value || "";


    // =====================================================
    // Prevent duplicate clicks
    // =====================================================

    let processing = false;


    // =====================================================
    // Accept
    // =====================================================

    acceptButton?.addEventListener("click", async () => {

        if (processing) {
            return;
        }

        await respond(
            "Accept",
            acceptButton,
            rejectButton
        );
    });


    // =====================================================
    // Reject
    // =====================================================

    rejectButton?.addEventListener("click", async () => {

        if (processing) {
            return;
        }

        await respond(
            "Reject",
            rejectButton,
            acceptButton
        );
    });


    // =====================================================
    // Server Request
    // =====================================================

    async function respond(
        action,
        clickedButton,
        otherButton
    ) {

        if (!details.assignmentId) {

            showError(
                "This task assignment is invalid."
            );

            return;
        }


        processing = true;


        clickedButton.classList.add("processing");

        clickedButton.disabled = true;

        if (otherButton) {
            otherButton.disabled = true;
        }


        try {

            const response =
                await fetch(
                    `/User/Notifications/${action}`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded; charset=UTF-8",

                            "RequestVerificationToken":
                                antiForgeryToken
                        },

                        body:
                            `assignmentId=${encodeURIComponent(
                                details.assignmentId
                            )}`
                    }
                );


            const result =
                await response.json();


            if (!response.ok || !result.success) {

                throw new Error(
                    result.message ||
                    `Unable to ${action.toLowerCase()} this task.`
                );
            }


            // =============================================
            // Success animation
            // =============================================

            document
                .querySelector(".task-details-card")
                ?.classList.add("task-action-success");


            await wait(450);


            // =============================================
            // Return to notifications
            // =============================================

            window.location.href =
                "/User/Notifications";

        }
        catch (error) {

            console.error(
                "Task assignment action failed:",
                error
            );


            showError(
                error.message ||
                `Unable to ${action.toLowerCase()} this task.`
            );


            clickedButton.classList.remove(
                "processing"
            );

            clickedButton.disabled = false;

            if (otherButton) {
                otherButton.disabled = false;
            }

            processing = false;
        }
    }


    // =====================================================
    // Small helper
    // =====================================================

    function wait(milliseconds) {

        return new Promise(resolve => {

            setTimeout(
                resolve,
                milliseconds
            );

        });
    }


    // =====================================================
    // Error message
    // =====================================================

    function showError(message) {

        let errorBox =
            document.getElementById(
                "taskActionError"
            );


        if (!errorBox) {

            errorBox =
                document.createElement("div");

            errorBox.id =
                "taskActionError";

            errorBox.style.marginTop =
                "14px";

            errorBox.style.padding =
                "11px 13px";

            errorBox.style.border =
                "1px solid rgba(239, 90, 105, .35)";

            errorBox.style.borderRadius =
                "10px";

            errorBox.style.background =
                "rgba(145, 38, 52, .15)";

            errorBox.style.color =
                "#ff9ca5";

            errorBox.style.fontSize =
                "12px";

            errorBox.style.lineHeight =
                "1.5";


            const panel =
                document.querySelector(
                    ".task-action-panel"
                );


            panel?.appendChild(
                errorBox
            );
        }


        errorBox.textContent =
            message;


        errorBox.animate(
            [
                {
                    opacity: 0,
                    transform: "translateY(5px)"
                },
                {
                    opacity: 1,
                    transform: "translateY(0)"
                }
            ],
            {
                duration: 220,
                easing: "ease-out"
            }
        );
    }

});