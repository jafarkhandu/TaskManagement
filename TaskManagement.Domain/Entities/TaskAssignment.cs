namespace TaskManagement.Domain.Entities
{
    public class TaskAssignment
    {
        public int Id { get; set; }

        public int TaskId { get; set; }

        public string UserId { get; set; } = string.Empty;

        public string Status { get; set; } = "Pending";

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

        public DateTime? RespondedAt { get; set; }
    }
}