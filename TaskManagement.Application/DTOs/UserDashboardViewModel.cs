using System;
using System.Collections.Generic;

namespace TaskManagement.Application.DTOs
{
    public class UserDashboardViewModel
    {
        public string UserName { get; set; } = string.Empty;
        public string UserEmail { get; set; } = string.Empty;

        public int TotalTasks { get; set; }
        public int PendingTasks { get; set; }
        public int InProgressTasks { get; set; }
        public int CompletedTasks { get; set; }
        public int OnHoldTasks { get; set; }
        public int DueSoonTasks { get; set; }
        public int ActiveProjects { get; set; }

        public List<UserTaskSummaryDto> FocusTasks { get; set; } = new();
        public List<UserTaskSummaryDto> RecentTasks { get; set; } = new();
        public List<UserProjectSummaryDto> Projects { get; set; } = new();
    }

    public class UserTaskSummaryDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Scenario { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public DateTime ExpectedEndDate { get; set; }
        public decimal Amount { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
    }

    public class UserProjectSummaryDto
    {
        public int Id { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int TotalTasks { get; set; }
        public int CompletedTasks { get; set; }
        public int ProgressPercent { get; set; }
    }
}