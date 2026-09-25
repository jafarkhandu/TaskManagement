namespace TaskManagement.Application.DTOs
{
    public class UserAvailableChatTaskDto
    {
        public int TaskId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? Scenario { get; set; }
    }
}
