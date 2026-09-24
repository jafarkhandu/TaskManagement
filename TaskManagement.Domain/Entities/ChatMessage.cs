namespace TaskManagement.Domain.Entities
{
    public class ChatMessage
    {
        public int Id { get; set; }

        public int ChatSessionId { get; set; }

        public string SenderId { get; set; } = string.Empty;

        public string Message { get; set; } = string.Empty;

        public DateTime SentAt { get; set; } = DateTime.UtcNow;

        public bool IsRead { get; set; } = false;
    }
}