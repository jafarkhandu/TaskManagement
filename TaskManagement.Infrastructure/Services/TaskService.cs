using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using TaskManagement.Application.DTOs;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;

namespace TaskManagement.Infrastructure.Services
{
    public class TaskService : ITaskService
    {
        private readonly ApplicationDbContext _db;
        private readonly UserManager<ApplicationUser> _userManager;

        private static readonly string[] AllowedPriorities = new[] { "Low", "Medium", "High", "Critical" };

        private static readonly string[] AllowedStatuses = new[] { "Pending", "In Progress", "Completed", "On Hold", "Cancelled" };

        public TaskService(ApplicationDbContext db, UserManager<ApplicationUser> userManager)
        {
            _db = db;
            _userManager = userManager;
        }

        public async Task<List<TaskDto>> GetTasksByProjectIdAsync(int projectId)
        {
            return await _db.TaskItems
                .AsNoTracking()
                .Where(t => t.ProjectId == projectId)
                .OrderByDescending(t => t.Id)
                .Select(t => new TaskDto
                {
                    Id = t.Id,
                    ProjectId = t.ProjectId,
                    Title = t.Title,
                    Scenario = t.Scenario,
                    AssignedToUserId = t.AssignedToUserId ?? string.Empty,
                    // Project to the user's display name (FullName or Email)
                    AssignedToUserName = _db.Users
                        .Where(u => u.Id == t.AssignedToUserId)
                        .Select(u => (u.FullName != null && u.FullName != "") ? u.FullName : u.Email)
                        .FirstOrDefault() ?? string.Empty,
                    Priority = t.Priority,
                    Status = t.Status,
                    StartDate = t.StartDate,
                    ExpectedEndDate = t.ExpectedEndDate,
                    Amount = t.Amount
                })
                .ToListAsync();
        }

        public async Task<TaskDto?> GetByIdAsync(int id)
        {
            return await _db.TaskItems
                .AsNoTracking()
                .Where(x => x.Id == id)
                .Select(t => new TaskDto
                {
                    Id = t.Id,
                    ProjectId = t.ProjectId,
                    Title = t.Title,
                    Scenario = t.Scenario,
                    AssignedToUserId = t.AssignedToUserId ?? string.Empty,
                    AssignedToUserName = _db.Users
                        .Where(u => u.Id == t.AssignedToUserId)
                        .Select(u => (u.FullName != null && u.FullName != "") ? u.FullName : u.Email)
                        .FirstOrDefault() ?? string.Empty,
                    Priority = t.Priority,
                    Status = t.Status,
                    StartDate = t.StartDate,
                    ExpectedEndDate = t.ExpectedEndDate,
                    Amount = t.Amount
                })
                .FirstOrDefaultAsync();
        }

        public async Task<TaskDto?> GetDetailsAsync(int id)
        {
            return await GetByIdAsync(id);
        }

        public async Task<(bool Success, string Error, int NotificationId)> CreateAsync(TaskDto model)
        {
            var project = await _db.Projects
                .FirstOrDefaultAsync(p => p.Id == model.ProjectId);

            if (project == null)
                return (false, "Project not found.", 0);

            if (!AllowedPriorities.Contains(model.Priority))
                return (false, "Invalid priority.", 0);

            if (!AllowedStatuses.Contains(model.Status))
                return (false, "Invalid status.", 0);

            if (model.StartDate > model.ExpectedEndDate)
                return (false, "Task start date cannot be after expected end date.", 0);

            if (model.StartDate < project.StartDate)
                return (false, "Task start date cannot be before project start date.", 0);

            if (model.ExpectedEndDate > project.EndDate)
                return (false, "Task expected end date cannot be after project end date.", 0);

            var assignedUser = await _userManager.FindByIdAsync(
                model.AssignedToUserId);

            if (assignedUser == null)
                return (false, "Assigned user not found.", 0);

            if (!assignedUser.IsActive)
                return (false, "The selected user is not active.", 0);

            if (await _userManager.IsInRoleAsync(assignedUser, "Admin"))
                return (false, "Assigned user cannot be an administrator.", 0);

            if (!await _userManager.IsInRoleAsync(assignedUser, "User"))
                return (false, "Only users can be assigned to tasks.", 0);

            await using var transaction =
                await _db.Database.BeginTransactionAsync();

            try
            {
                // Task is created, but it is NOT officially assigned yet.
                var task = new TaskItem
                {
                    ProjectId = model.ProjectId,
                    Title = model.Title,
                    Scenario = model.Scenario,

                    // Keep existing field for compatibility.
                    // Official assignment is controlled by TaskAssignment.
                    AssignedToUserId = null,

                    Priority = model.Priority,

                    // Task waits for user's response.
                    Status = "Pending",

                    StartDate = model.StartDate,
                    ExpectedEndDate = model.ExpectedEndDate,
                    Amount = model.Amount
                };

                _db.TaskItems.Add(task);

                await _db.SaveChangesAsync();

                var assignment = new TaskAssignment
                {
                    TaskId = task.Id,
                    UserId = assignedUser.Id,
                    Status = "Pending",
                    AssignedAt = DateTime.UtcNow
                };

                _db.TaskAssignments.Add(assignment);

                await _db.SaveChangesAsync();

                var notification = new Notification
                {
                    UserId = assignedUser.Id,
                    TaskAssignmentId = assignment.Id,
                    Type = "TaskAssignment",
                    Title = "New Task Assignment",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                };

                _db.Notifications.Add(notification);

                await _db.SaveChangesAsync();

                await transaction.CommitAsync();

                return (true, string.Empty, notification.Id);
            }
            catch
            {
                await transaction.RollbackAsync();

                return (
                    false,
                    "Unable to create the task assignment. Please try again.",
                    0
                );
            }
        }

        public async Task<(bool Success, string Error, int TaskId, int ProjectId, string OldStatus, string NewStatus)> ChangeStatusAsync(int taskId, string userId, string newStatus)
        {
            if (string.IsNullOrWhiteSpace(userId))
                return (false, "User not found.", 0, 0, string.Empty, string.Empty);

            if (string.IsNullOrWhiteSpace(newStatus))
                return (false, "Invalid target status.", taskId, 0, string.Empty, string.Empty);

            // Normalize newStatus to canonical allowed value if case-insensitive match exists
            newStatus = AllowedStatuses.FirstOrDefault(s => string.Equals(s, newStatus, StringComparison.OrdinalIgnoreCase)) ?? newStatus;

            if (!AllowedStatuses.Contains(newStatus))
                return (false, "Invalid target status.", taskId, 0, string.Empty, string.Empty);

            var task = await _db.TaskItems.FirstOrDefaultAsync(t => t.Id == taskId);

            if (task == null)
                return (false, "Task not found.", taskId, 0, string.Empty, string.Empty);

            // Ensure the caller owns the task
            if (string.IsNullOrWhiteSpace(task.AssignedToUserId) || task.AssignedToUserId != userId)
                return (false, "Unauthorized to modify this task.", taskId, task.ProjectId, task.Status ?? string.Empty, newStatus);

            var oldStatus = task.Status ?? string.Empty;

            // Completed is terminal
            if (string.Equals(oldStatus, "Completed", StringComparison.OrdinalIgnoreCase))
                return (false, "Completed tasks cannot be modified.", taskId, task.ProjectId, oldStatus, newStatus);

            // No-op
            if (string.Equals(oldStatus, newStatus, StringComparison.OrdinalIgnoreCase))
                return (false, "Task is already in the requested status.", taskId, task.ProjectId, oldStatus, newStatus);

            // Strict workflow transitions
            var allowed = false;
            if (string.Equals(oldStatus, "Pending", StringComparison.OrdinalIgnoreCase) && string.Equals(newStatus, "In Progress", StringComparison.OrdinalIgnoreCase))
                allowed = true;
            else if (string.Equals(oldStatus, "In Progress", StringComparison.OrdinalIgnoreCase) && (string.Equals(newStatus, "On Hold", StringComparison.OrdinalIgnoreCase) || string.Equals(newStatus, "Completed", StringComparison.OrdinalIgnoreCase)))
                allowed = true;
            else if (string.Equals(oldStatus, "On Hold", StringComparison.OrdinalIgnoreCase) && string.Equals(newStatus, "In Progress", StringComparison.OrdinalIgnoreCase))
                allowed = true;

            if (!allowed)
                return (false, "Status transition is not allowed.", taskId, task.ProjectId, oldStatus, newStatus);

            task.Status = newStatus;

            try
            {
                await _db.SaveChangesAsync();
                return (true, string.Empty, taskId, task.ProjectId, oldStatus, newStatus);
            }
            catch
            {
                return (false, "Failed to update task status.", taskId, task.ProjectId, oldStatus, newStatus);
            }
        }

        public async Task<(bool Success, string Error)> UpdateAsync(TaskDto model)
        {
            var task = await _db.TaskItems.FirstOrDefaultAsync(t => t.Id == model.Id);
            if (task == null) return (false, "Task not found.");

            // Ensure task belongs to the project specified
            if (task.ProjectId != model.ProjectId) return (false, "Task does not belong to the specified project.");

            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == model.ProjectId);
            if (project == null) return (false, "Project not found.");

            if (!AllowedPriorities.Contains(model.Priority))
                return (false, "Invalid priority.");

            if (!AllowedStatuses.Contains(model.Status))
                return (false, "Invalid status.");

            if (model.StartDate > model.ExpectedEndDate)
                return (false, "Task start date cannot be after expected end date.");

            if (model.StartDate < project.StartDate)
                return (false, "Task start date cannot be before project start date.");

            if (model.ExpectedEndDate > project.EndDate)
                return (false, "Task expected end date cannot be after project end date.");

            // Assigned user must exist and must be in the 'User' role.
            var assignedUser = await _userManager.FindByIdAsync(model.AssignedToUserId);
            if (assignedUser == null) return (false, "Assigned user not found.");

            // Ensure the user is not an Admin even if they also have the User role
            if (await _userManager.IsInRoleAsync(assignedUser, "Admin"))
                return (false, "Assigned user cannot be an administrator.");

            if (!await _userManager.IsInRoleAsync(assignedUser, "User"))
                return (false, "Only users can be assigned to tasks.");

            task.Title = model.Title;
            task.Scenario = model.Scenario;
            task.AssignedToUserId = model.AssignedToUserId;
            task.Priority = model.Priority;
            task.Status = model.Status;
            task.StartDate = model.StartDate;
            task.ExpectedEndDate = model.ExpectedEndDate;
            task.Amount = model.Amount;

            await _db.SaveChangesAsync();

            return (true, string.Empty);
        }

        public async Task<List<UserLookupDto>> GetAssignableUsersAsync()
        {
            var usersInUserRole = await _userManager.GetUsersInRoleAsync("User");

            var output = new List<UserLookupDto>();

            foreach (var u in usersInUserRole)
            {
                // Exclude administrators even if they also have the User role
                if (await _userManager.IsInRoleAsync(u, "Admin"))
                    continue;

                output.Add(new UserLookupDto
                {
                    Id = u.Id,
                    Email = u.Email ?? string.Empty,
                    FullName = u.FullName ?? string.Empty
                });
            }

            return output
                .OrderBy(u => u.FullName)
                .ThenBy(u => u.Email)
                .ToList();
        }

        public async Task<(bool Success, string Error)> DeleteAsync(int id)
        {
            var task = await _db.TaskItems.FirstOrDefaultAsync(t => t.Id == id);
            if (task == null) return (false, "Task not found.");

            _db.TaskItems.Remove(task);
            await _db.SaveChangesAsync();

            return (true, string.Empty);
        }


    }
}
