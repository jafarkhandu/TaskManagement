namespace TaskManagement.Application.Interfaces
{
    using TaskManagement.Application.DTOs;

    public interface IChatService
    {
        Task<(bool Success, string Error, int ChatSessionId)> StartChatAsync(
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

        Task<(bool Success, string Error)> SendMessageAsync(
            int chatSessionId,
            string senderId,
            string message);

        Task<object?> GetChatAsync(
            int chatSessionId,
            string userId,
            bool isAdmin);

        Task<IEnumerable<AdminChatSessionDto>> GetAdminChatSessionsAsync();
    }
}