using System;
using System.Collections.Generic;

namespace TaskManagement.Application.DTOs
{
    public class DashboardViewModel
    {
        public int TotalProjects { get; set; }

        public int TotalTasks { get; set; }

        public int InProgressTasks { get; set; }

        public int OverdueTasks { get; set; }

        public List<ProjectSummaryDto> RecentProjects { get; set; } = new List<ProjectSummaryDto>();

        public List<DeadlineDto> UpcomingDeadlines { get; set; } = new List<DeadlineDto>();

        public TaskOverviewDto TaskOverview { get; set; } = new TaskOverviewDto();

        public List<ProjectDistributionDto> ProjectDistribution { get; set; } = new List<ProjectDistributionDto>();
    }

    public class ProjectSummaryDto
    {
        public int Id { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime EndDate { get; set; }
        public int TaskCount { get; set; }
        public List<UserLookupDto> AssignedUsers { get; set; } = new List<UserLookupDto>();
    }

    public class DeadlineDto
    {
        public int TaskId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string ProjectTitle { get; set; } = string.Empty;
        public DateTime ExpectedEndDate { get; set; }
        public string Priority { get; set; } = string.Empty;
    }

    public class TaskOverviewDto
    {
        public int CreatedCount { get; set; }
        public int CompletedCount { get; set; }
    }

    public class ProjectDistributionDto
    {
        public string ProjectTitle { get; set; } = string.Empty;
        public int TaskCount { get; set; }
    }
}
