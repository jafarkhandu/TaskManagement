document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("adminGlobalSearch");
    const searchResults = document.getElementById("adminGlobalSearchResults");

    if (!searchInput || !searchResults) {
        return;
    }

    let debounceTimer = null;
    let activeRequest = null;
    let currentResults = [];

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    function hideResults() {
        searchResults.hidden = true;
        searchResults.innerHTML = "";
        searchInput.setAttribute("aria-expanded", "false");
        currentResults = [];
    }

    function showResults() {
        searchResults.hidden = false;
        searchInput.setAttribute("aria-expanded", "true");
    }

    function renderMessage(message) {
        searchResults.innerHTML = `<div class="admin-search-empty">${escapeHtml(message)}</div>`;
        showResults();
    }

    function renderResults(data) {
        const results = [
            ...(Array.isArray(data?.projects) ? data.projects : []),
            ...(Array.isArray(data?.tasks) ? data.tasks : []),
            ...(Array.isArray(data?.users) ? data.users : [])
        ];

        currentResults = results;

        if (!results.length) {
            renderMessage("No projects, tasks or users found.");
            return;
        }

        searchResults.innerHTML = results.map((result, index) => {
            const type = String(result.type || "");
            const icon = type === "Project"
                ? "P"
                : type === "Task"
                    ? "T"
                    : "U";

            const meta = type === "Project"
                ? `Project${result.status ? " • " + result.status : ""}`
                : type === "Task"
                    ? `Task${result.projectTitle ? " • " + result.projectTitle : ""}`
                    : `User${result.email ? " • " + result.email : ""}`;

            return `
                <a class="admin-search-result"
                   href="${escapeHtml(result.url || "#")}" 
                   role="option"
                   data-search-index="${index}">
                    <span class="admin-search-result-icon" aria-hidden="true">${icon}</span>
                    <span class="admin-search-result-text">
                        <strong>${escapeHtml(result.title || "Result")}</strong>
                        <small>${escapeHtml(meta)}</small>
                    </span>
                </a>
            `;
        }).join("");

        showResults();
    }

    async function performSearch(term) {
        if (activeRequest) {
            activeRequest.abort();
        }

        activeRequest = new AbortController();

        try {
            const response = await fetch(
                "/Admin/Dashboard/Search?term=" + encodeURIComponent(term),
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store",
                    signal: activeRequest.signal,
                    headers: {
                        "X-Requested-With": "XMLHttpRequest"
                    }
                }
            );

            if (!response.ok) {
                throw new Error("Search request failed.");
            }

            const data = await response.json();
            renderResults(data);
        }
        catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            console.warn("Admin global search failed:", error);
            renderMessage("Search is temporarily unavailable.");
        }
        finally {
            activeRequest = null;
        }
    }

    searchInput.setAttribute("role", "combobox");
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.setAttribute("aria-controls", "adminGlobalSearchResults");
    searchInput.setAttribute("aria-autocomplete", "list");

    searchInput.addEventListener("input", function () {
        const term = searchInput.value.trim();

        window.clearTimeout(debounceTimer);

        if (activeRequest) {
            activeRequest.abort();
            activeRequest = null;
        }

        if (!term) {
            hideResults();
            return;
        }

        if (term.length < 2) {
            renderMessage("Type at least 2 characters to search.");
            return;
        }

        renderMessage("Searching...");

        debounceTimer = window.setTimeout(function () {
            performSearch(term);
        }, 250);
    });

    searchInput.addEventListener("focus", function () {
        if (searchInput.value.trim().length >= 2 && searchResults.innerHTML) {
            showResults();
        }
    });

    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            hideResults();
            return;
        }

        if (event.key === "Enter" && currentResults.length > 0) {
            const firstResult = searchResults.querySelector(".admin-search-result");

            if (firstResult) {
                event.preventDefault();
                firstResult.click();
            }
        }
    });

    document.addEventListener("click", function (event) {
        if (!searchResults.contains(event.target) && !searchInput.contains(event.target)) {
            hideResults();
        }
    });
});
