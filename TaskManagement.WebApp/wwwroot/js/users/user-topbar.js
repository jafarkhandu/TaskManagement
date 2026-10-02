(() => {
    const applyTheme = () => {
        const savedTheme = localStorage.getItem("taskmanager-theme");

        if (savedTheme === "light") {
            document.documentElement.classList.add("light-theme");
        } else {
            document.documentElement.classList.remove("light-theme");
        }
    };

    applyTheme();
    window.__taskManagerThemeInitialized = true;

    document.getElementById("themeButton")?.addEventListener("click", () => {
        const isLight =
            document.documentElement.classList.toggle("light-theme");

        localStorage.setItem(
            "taskmanager-theme",
            isLight ? "light" : "dark"
        );
    });

    const notificationButton =
        document.getElementById("notificationButton");

    notificationButton?.addEventListener("click", () => {
        if (window.__dashboardNotificationHandler) {
            return;
        }

        window.location.href = "/User/Notifications";
    });
})();
