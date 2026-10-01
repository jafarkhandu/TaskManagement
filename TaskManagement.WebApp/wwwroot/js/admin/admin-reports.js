document.addEventListener("DOMContentLoaded", () => {
    const range = document.getElementById("reportRange");
    const exportButton = document.getElementById("exportReport");
    const exportModal = document.getElementById("exportReportModal");
    const printMeta = document.getElementById("reportPrintMeta");

    if (range?.dataset.currentRange) range.value = range.dataset.currentRange;

    const getPeriodLabel = () => range?.selectedOptions?.[0]?.textContent?.trim() || "All Time";
    if (printMeta) printMeta.textContent = "Report period: " + getPeriodLabel();

    range?.addEventListener("change", () => {
        const url = new URL(window.location.href);
        url.searchParams.set("range", range.value || "all");
        window.location.href = url.toString();
    });

    const openExportModal = () => {
        if (!exportModal) return;
        exportModal.hidden = false;
        exportModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("report-export-open");
        exportModal.querySelector("[data-export-format]")?.focus();
    };

    const closeExportModal = () => {
        if (!exportModal) return;
        exportModal.hidden = true;
        exportModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("report-export-open");
        exportButton?.focus();
    };

    exportButton?.addEventListener("click", openExportModal);

    exportModal?.addEventListener("click", event => {
        if (event.target.closest("[data-export-close]")) {
            closeExportModal();
            return;
        }
        const option = event.target.closest("[data-export-format]");
        if (!option) return;

        if (option.dataset.exportFormat === "pdf") {
            closeExportModal();
            window.requestAnimationFrame(() => window.print());
        } else {
            exportCsv();
            closeExportModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && exportModal && !exportModal.hidden) closeExportModal();
    });

    function csvCell(value) {
        const text = String(value ?? "").replace(/\s+/g, " ").trim().replace(/"/g, '""');
        return '"' + text + '"';
    }

    function tableData(selector) {
        return [...document.querySelectorAll(selector + " tbody tr")]
            .filter(row => !row.querySelector(".report-empty"))
            .map(row => [...row.children].map(cell => cell.innerText.trim()));
    }

    function exportCsv() {
        const projectRows = tableData("#projectReportTable");
        const studentRows = tableData("#studentReportTable");
        const statusRows = [...document.querySelectorAll(".status-legend-item")].map(item => [
            item.querySelector(".status-legend-label span")?.textContent?.trim() || "",
            item.querySelector(".status-legend-value strong")?.textContent?.trim() || "",
            item.querySelector(".status-legend-value small")?.textContent?.trim() || ""
        ]);
        const breakdownRows = [...document.querySelectorAll(".breakdown-row")].map(row => [
            row.querySelector("span")?.innerText?.trim() || "",
            row.querySelector("strong")?.textContent?.trim() || ""
        ]);
        const summaryRows = [...document.querySelectorAll(".report-summary-card")].map(card => [
            card.querySelector(".summary-label span:last-child")?.textContent?.trim() || "",
            card.querySelector(":scope > strong")?.textContent?.trim() || ""
        ]);

        const rows = [
            ["CIIT TaskHub Report"], ["Period", getPeriodLabel()], [],
            ["Summary"], ["Metric", "Value"], ...summaryRows, [],
            ["Task Status"], ["Status", "Count", "Percentage"], ...statusRows, [],
            ["Task Breakdown"], ["Status", "Count"], ...breakdownRows, [],
            ["Project Performance"], ["Project", "Tasks", "Progress", "Completed", "In Progress", "Overdue"], ...projectRows, [],
            ["Student Workload"], ["Student", "Assigned", "Completion", "Completed", "Pending / Active"], ...studentRows
        ];

        const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "CIIT-TaskHub-Report.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
});