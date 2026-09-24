using System;

namespace TaskManagement.Application.DTOs
{
    public class AdminChatMessageDto
    {
        public int Id { get; set; }

        public string SenderId { get; set; } = string.Empty;

        public string? SenderName { get; set; }

        public string Message { get; set; } = string.Empty;

        public DateTime SentAt { get; set; }

        public bool IsRead { get; set; }
    }
}
