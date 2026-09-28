document.addEventListener("DOMContentLoaded", () => {
    const range = document.getElementById("reportRange");

    range?.addEventListener("change", () => {
        const value = range.value || "all";
        const url = new URL(window.location.href);
        url.searchParams.set("range", value);
        window.location.href = url.toString();
    });

    document.getElementById("printReport")?.addEventListener("click", () => {
        window.print();
    });

    document.getElementById("exportExcel")?.addEventListener("click", () => {
        const projectRows = [...document.querySelectorAll("#projectReportTable tbody tr")]
            .map(row => [...row.children].map(cell => cell.innerText.trim()));

        const studentRows = [...document.querySelectorAll("#studentReportTable tbody tr")]
            .map(row => [...row.children].map(cell => cell.innerText.trim()));

        const csv = [
            ["CIIT TaskHub Report"],
            [],
            ["Project-wise Report"],
            ["Project", "Tasks", "Completed", "In Progress", "Overdue"],
            ...projectRows,
            [],
            ["Student Workload"],
            ["Student", "Assigned", "Completed", "Pending / Active"],
            ...studentRows
        ].map(row => row.map(value => {
            const text = String(value ?? "").replace(/"/g, '""');
            return '"' + text + '"';
        }).join(",")).join("\r\n");

        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "CIIT-TaskHub-Report.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    });
});
