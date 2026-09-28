using System;
using System.Collections.Generic;

namespace TaskManagement.Application.DTOs
{
    public class AdminReportsViewModel
    {
        public string Range { get; set; } = "all";
        public DateTime? FromDate { get; set; }
        public DateTime ToDate { get; set; }

        public int TotalProjects { get; set; }
        public int TotalTasks { get; set; }
        public int CompletedTasks { get; set; }
        public int OverdueTasks { get; set; }

        public int PendingTasks { get; set; }
        public int InProgressTasks { get; set; }
        public int OnHoldTasks { get; set; }
        public int CancelledTasks { get; set; }

        public List<AdminReportStatusRow> StatusRows { get; set; } = new();
        public List<AdminReportProjectRow> ProjectRows { get; set; } = new();
        public List<AdminReportStudentRow> StudentRows { get; set; } = new();
    }

    public class AdminReportStatusRow
    {
        public string Status { get; set; } = string.Empty;
        public int Count { get; set; }
        public double Percent { get; set; }
    }

    public class AdminReportProjectRow
    {
        public int ProjectId { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public int TaskCount { get; set; }
        public int Completed { get; set; }
        public int InProgress { get; set; }
        public int Overdue { get; set; }
    }

    public class AdminReportStudentRow
    {
        public string UserId { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public int Assigned { get; set; }
        public int Completed { get; set; }
        public int Pending { get; set; }
    }
}
