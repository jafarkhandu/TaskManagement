using System.Collections.Generic;

namespace TaskManagement.Application.DTOs
{
    public class UserProfileViewModel
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public string? ProfilePictureUrl { get; set; }

        public int ProfileCompletionPercentage { get; set; }
        public bool IsProfileComplete { get; set; }

        public int TotalTasks { get; set; }
        public int CompletedTasks { get; set; }
        public decimal CompletionRate { get; set; }

        public List<MonthlyPerformanceDto> MonthlyPerformance { get; set; } = new();
    }

    public class MonthlyPerformanceDto
    {
        public string Month { get; set; } = string.Empty;
        public int TotalTasks { get; set; }
        public int CompletedTasks { get; set; }
        public decimal CompletionRate { get; set; }
    }
}
