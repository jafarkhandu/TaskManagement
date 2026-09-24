using System;

namespace TaskManagement.Application.DTOs
{
    public class AdminChatSessionDto
    {
        public int ChatSessionId { get; set; }

        public string UserId { get; set; } = string.Empty;

        public string UserFullName { get; set; } = string.Empty;

        public int TaskId { get; set; }

        public string TaskTitle { get; set; } = string.Empty;

        public string TaskStatus { get; set; } = string.Empty;

        public int ProjectId { get; set; }

        public string ProjectTitle { get; set; } = string.Empty;

        public string LatestMessage { get; set; } = string.Empty;

        public DateTime? LatestMessageAt { get; set; }

        public int UnreadCount { get; set; }
    }
}
