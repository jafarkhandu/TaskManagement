namespace TaskManagement.Domain.Entities
{
    public class ChatSession
    {
        public int Id { get; set; }

        public int TaskId { get; set; }

        public string UserId { get; set; } = string.Empty;

        public string AdminId { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? ClosedAt { get; set; }

        public bool IsActive { get; set; } = true;
    }
}