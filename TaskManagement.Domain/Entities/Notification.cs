namespace TaskManagement.Domain.Entities
{
    public class Notification
    {
        public int Id { get; set; }

        public string UserId { get; set; } = string.Empty;

        public int TaskAssignmentId { get; set; }

        public string Type { get; set; } = "TaskAssignment";

        public string Title { get; set; } = string.Empty;

        public bool IsRead { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}