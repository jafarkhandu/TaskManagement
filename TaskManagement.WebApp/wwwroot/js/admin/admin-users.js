document.addEventListener("DOMContentLoaded", function () {

    const searchInput =
        document.getElementById("userSearch");

    const clearSearchBtn =
        document.getElementById("clearSearchBtn");

    const tableBody =
        document.getElementById("usersTableBody");

    const noSearchResults =
        document.getElementById("noSearchResults");

    const visibleUserCount =
        document.getElementById("visibleUserCount");

    const tokenElement =
        document.querySelector(
            'input[name="__RequestVerificationToken"]'
        );


    /* =========================================
       SEARCH USERS
    ========================================= */

    function filterUsers() {

        const searchValue =
            searchInput.value
                .trim()
                .toLowerCase();

        const rows =
            tableBody.querySelectorAll(".user-row");

        let visibleCount = 0;


        rows.forEach(function (row) {

            const searchableText =
                row.dataset.search
                    ? row.dataset.search.toLowerCase()
                    : "";


            const matches =
                searchValue === "" ||
                searchableText.includes(searchValue);


            if (matches) {

                row.classList.remove("hidden");

                visibleCount++;

            }
            else {

                row.classList.add("hidden");

            }

        });


        visibleUserCount.textContent =
            visibleCount;


        if (searchValue.length > 0) {

            clearSearchBtn.style.display =
                "inline-block";

        }
        else {

            clearSearchBtn.style.display =
                "none";

        }


        if (rows.length > 0 && visibleCount === 0) {

            noSearchResults.style.display =
                "flex";

        }
        else {

            noSearchResults.style.display =
                "none";

        }

    }


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            filterUsers
        );

    }


    /* =========================================
       CLEAR SEARCH
    ========================================= */

    if (clearSearchBtn) {

        clearSearchBtn.addEventListener(
            "click",
            function () {

                searchInput.value = "";

                filterUsers();

                searchInput.focus();

            }
        );

    }


    /* =========================================
       CTRL + K SEARCH
    ========================================= */

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


    /* =========================================
       ACTIVATE USER
    ========================================= */

    document
        .querySelectorAll(".activate-account-btn")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const userId =
                        button.dataset.userId;


                    if (!userId) {
                        return;
                    }


                    const confirmed =
                        confirm(
                            "Are you sure you want to activate this account?"
                        );


                    if (!confirmed) {
                        return;
                    }


                    button.disabled = true;

                    const originalText =
                        button.textContent;

                    button.textContent =
                        "Activating...";


                    try {

                        const response =
                            await fetch(
                                `/Admin/Users/Activate?id=${encodeURIComponent(userId)}`,
                                {
                                    method: "POST",

                                    headers: {
                                        "RequestVerificationToken":
                                            tokenElement?.value || ""
                                    }
                                }
                            );


                        const result =
                            await response.json();


                        if (
                            !response.ok ||
                            !result.success
                        ) {

                            alert(
                                result.message ||
                                "Unable to activate account."
                            );

                            button.disabled =
                                false;

                            button.textContent =
                                originalText;

                            return;
                        }


                        alert(
                            result.message ||
                            "Account activated successfully."
                        );


                        window.location.reload();

                    }
                    catch (error) {

                        console.error(
                            "Activation error:",
                            error
                        );


                        alert(
                            "Unable to connect to the server."
                        );


                        button.disabled =
                            false;

                        button.textContent =
                            originalText;

                    }

                }
            );

        });


    /* =========================================
       DEACTIVATE USER
    ========================================= */

    document
        .querySelectorAll(".deactivate-account-btn")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const userId =
                        button.dataset.userId;


                    if (!userId) {
                        return;
                    }


                    const confirmed =
                        confirm(
                            "Are you sure you want to deactivate this account?"
                        );


                    if (!confirmed) {
                        return;
                    }


                    button.disabled = true;

                    const originalText =
                        button.textContent;

                    button.textContent =
                        "Deactivating...";


                    try {

                        const response =
                            await fetch(
                                `/Admin/Users/Deactivate?id=${encodeURIComponent(userId)}`,
                                {
                                    method: "POST",

                                    headers: {
                                        "RequestVerificationToken":
                                            tokenElement?.value || ""
                                    }
                                }
                            );


                        const result =
                            await response.json();


                        if (
                            !response.ok ||
                            !result.success
                        ) {

                            alert(
                                result.message ||
                                "Unable to deactivate account."
                            );


                            button.disabled =
                                false;

                            button.textContent =
                                originalText;

                            return;
                        }


                        alert(
                            result.message ||
                            "Account deactivated successfully."
                        );


                        window.location.reload();

                    }
                    catch (error) {

                        console.error(
                            "Deactivation error:",
                            error
                        );


                        alert(
                            "Unable to connect to the server."
                        );


                        button.disabled =
                            false;

                        button.textContent =
                            originalText;

                    }

                }
            );

        });

});