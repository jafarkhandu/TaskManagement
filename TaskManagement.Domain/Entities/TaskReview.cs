namespace TaskManagement.Domain.Entities
{
    public class TaskReview
    {
        public int Id { get; set; }
        public int TaskAssignmentId { get; set; }
        public int TaskId { get; set; }
        public string SubmittedByUserId { get; set; } = string.Empty;
        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

        // Snapshot of the task deadline at the moment the user submits for review.
        // This keeps payment eligibility stable even if an admin edits the task later.
        public DateTime DeadlineAtSubmission { get; set; }

        public string Status { get; set; } = "Pending";
        public string? ReviewedByAdminId { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? RejectionReason { get; set; }
    }
}