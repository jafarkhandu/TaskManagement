using TaskManagement.Application.DTOs;

namespace TaskManagement.Application.Interfaces
{
    using TaskManagement.Application.DTOs;

    public interface ITaskService
    {
        Task<List<TaskDto>> GetTasksByProjectIdAsync(int projectId);

        Task<TaskDto?> GetByIdAsync(int id);

        Task<TaskDto?> GetDetailsAsync(int id);

        // Returns Success, Error message, and the created Notification Id (0 if none)
        Task<(bool Success, string Error, int NotificationId)> CreateAsync(TaskDto model);

        Task<(bool Success, string Error)> UpdateAsync(TaskDto model);

        Task<(bool Success, string Error)> DeleteAsync(int id);
        Task<List<UserLookupDto>> GetAssignableUsersAsync();

        // Change the status of a task on behalf of a user.
        // Returns Success, Error message, TaskId, ProjectId, OldStatus, NewStatus
        Task<(bool Success, string Error, int TaskId, int ProjectId, string OldStatus, string NewStatus)> ChangeStatusAsync(int taskId, string userId, string newStatus);
    }
}
