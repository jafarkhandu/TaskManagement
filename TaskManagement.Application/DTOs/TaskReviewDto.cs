namespace TaskManagement.Application.DTOs
{
    public class TaskReviewDto
    {
        public int ReviewId { get; set; }
        public int TaskId { get; set; }
        public int TaskAssignmentId { get; set; }
        public string TaskTitle { get; set; } = string.Empty;
        public string Scenario { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string ProjectTitle { get; set; } = string.Empty;
        public string? RepositoryUrl { get; set; }
        public string ReviewStatus { get; set; } = string.Empty;
        public string? RejectionReason { get; set; }
        public string? PaymentStatus { get; set; }
        public DateTime SubmittedAt { get; set; }
        public string? PaymentMethod { get; set; }
        public string? UpiId { get; set; }
        public string? AccountHolderName { get; set; }
        public string? BankName { get; set; }
        public string? AccountNumber { get; set; }
        public string? IfscCode { get; set; }
    }
}