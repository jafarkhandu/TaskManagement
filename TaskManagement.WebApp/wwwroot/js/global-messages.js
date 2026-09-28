(() => {
    const MESSAGE_LIFETIME = 5000;
    const FADE_TIME = 700;

    function dismissElement(element) {
        if (!element || element.dataset.tmMessageScheduled === "true") return;

        element.dataset.tmMessageScheduled = "true";

        setTimeout(() => {
            element.classList.add("tm-message-hiding");

            setTimeout(() => {
                if (element.isConnected) element.remove();
            }, FADE_TIME);
        }, MESSAGE_LIFETIME);
    }

    function prepareMessages(root = document) {
        root.querySelectorAll?.(".alert:not(.tm-auto-message)").forEach(element => {
            if (element.classList.contains("field-error")) return;
            element.classList.add("tm-auto-message");
            dismissElement(element);
        });
    }

    function ensureToastContainer() {
        let container = document.querySelector(".tm-global-toast-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "tm-global-toast-container";
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message) {
        const toast = document.createElement("div");
        toast.className = "tm-global-toast tm-toast-info";
        toast.setAttribute("role", "alert");
        toast.textContent = message;
        ensureToastContainer().appendChild(toast);
        dismissElement(toast);
    }

    const nativeAlert = window.alert.bind(window);

    window.alert = (message) => {
        showToast(String(message ?? ""));
    };

    function initializeGlobalMessages() {
        if (!document.querySelector('link[data-global-message-style="true"]')) {
            const style = document.createElement("link");
            style.rel = "stylesheet";
            style.href = "/css/global-messages.css";
            style.dataset.globalMessageStyle = "true";
            document.head.appendChild(style);
        }

        prepareMessages();

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {

                if (mutation.type === "attributes" &&
                    mutation.target.matches?.(".alert")) {

                    const alert = mutation.target;

                    if (!alert.classList.contains("d-none") &&
                        !alert.dataset.tmMessageScheduled) {

                        alert.classList.add("tm-auto-message");
                        dismissElement(alert);
                    }
                }

                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches?.(".alert")) {
                            prepareMessages(node.parentElement || document);
                        }

                        prepareMessages(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"]
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeGlobalMessages);
    } else {
        initializeGlobalMessages();
    }
})();