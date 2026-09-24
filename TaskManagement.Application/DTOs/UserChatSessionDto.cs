using System;

namespace TaskManagement.Application.DTOs
{
    public class UserChatSessionDto
    {
        public int ChatSessionId { get; set; }

        public int TaskId { get; set; }

        public string TaskTitle { get; set; } = string.Empty;

        public string TaskStatus { get; set; } = string.Empty;

        public string? LatestMessage { get; set; }

        public DateTime? LatestMessageAt { get; set; }

        public int UnreadCount { get; set; }
    }
}
