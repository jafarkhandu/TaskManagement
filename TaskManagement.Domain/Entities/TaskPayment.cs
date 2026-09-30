namespace TaskManagement.Domain.Entities
{
    public class TaskPayment
    {
        public int Id { get; set; }
        public int TaskAssignmentId { get; set; }
        public int TaskId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Status { get; set; } = "Pending";
        public DateTime? ApprovedAt { get; set; }
        public DateTime? PaidAt { get; set; }
        public string? SettledByAdminId { get; set; }
    }
}