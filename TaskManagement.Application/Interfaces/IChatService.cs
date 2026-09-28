namespace TaskManagement.Application.Interfaces
{
    using TaskManagement.Application.DTOs;

    public interface IChatService
    {
        // Start a chat for a task and user. Returns the session id and whether a new session was created.
        Task<(bool Success, string Error, int ChatSessionId, bool IsNew)> StartChatAsync(
            int taskId,
            string userId);

        /// <summary>
        /// Returns the active ChatSession Id for the given task and user if one exists; otherwise null.
        /// This does not create a session.
        /// Default implementation returns null so adding this method is compatible with hot-reload.
        /// Implementations may override to provide a real lookup.
        /// </summary>
        Task<int?> GetActiveChatSessionIdAsync(
            int taskId,
            string userId)
        {
            return Task.FromResult<int?>(null);
        }

        // Sends a message and returns the created message DTO so hubs/controllers can broadcast the exact saved message.
        Task<(bool Success, string Error, AdminChatMessageDto? Message)> SendMessageAsync(
            int chatSessionId,
            string senderId,
            string message);

        Task<object?> GetChatAsync(
            int chatSessionId,
            string userId,
            bool isAdmin);

        Task<IEnumerable<AdminChatSessionDto>> GetAdminChatSessionsAsync();

        // Returns active chat sessions for a user for the global chat list (user-side DTO, no project info).
        Task<IEnumerable<UserChatSessionDto>> GetUserChatSessionsAsync(string userId);

        // Returns only the user's eligible tasks that do not already have an active chat.
        Task<IEnumerable<UserAvailableChatTaskDto>> GetAvailableChatTasksAsync(
            string userId,
            string? search = null);

        // Mark admin->user messages as read for a given chat session.
        Task<(bool Success, string Error)> MarkMessagesAsReadAsync(int chatSessionId, string userId);
    }
}
