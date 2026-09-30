using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
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
        private readonly ILogger<TaskService> _logger;
        private readonly IHostEnvironment _environment;

        private static readonly string[] AllowedPriorities = new[] { "Low", "Medium", "High", "Critical" };

        private static readonly string[] AllowedStatuses = new[] { "Pending", "In Progress", "Completed", "On Hold", "Cancelled" };

        public TaskService(
            ApplicationDbContext db,
            UserManager<ApplicationUser> userManager,
            ILogger<TaskService> logger,
            IHostEnvironment environment)
        {
            _db = db;
            _userManager = userManager;
            _logger = logger;
            _environment = environment;
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
                    AssignmentStatus = _db.TaskAssignments
                        .Where(a => a.TaskId == t.Id)
                        .OrderByDescending(a => a.Id)
                        .Select(a => a.Status)
                        .FirstOrDefault() ?? string.Empty,
                    CompletionRepositoryUrl = _db.TaskAssignments
                        .Where(a => a.TaskId == t.Id)
                        .OrderByDescending(a => a.Id)
                        .Select(a => a.CompletionRepositoryUrl)
                        .FirstOrDefault(),
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
                    AssignmentStatus = _db.TaskAssignments
                        .Where(a => a.TaskId == t.Id)
                        .OrderByDescending(a => a.Id)
                        .Select(a => a.Status)
                        .FirstOrDefault() ?? string.Empty,
                    CompletionRepositoryUrl = _db.TaskAssignments
                        .Where(a => a.TaskId == t.Id)
                        .OrderByDescending(a => a.Id)
                        .Select(a => a.CompletionRepositoryUrl)
                        .FirstOrDefault(),
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

            try
            {
                var executionStrategy =
                    _db.Database.CreateExecutionStrategy();

                var notificationId = 0;

                await executionStrategy.ExecuteAsync(async () =>
                {
                    await using var transaction =
                        await _db.Database.BeginTransactionAsync();

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

                    notificationId = notification.Id;
                });

                return (true, string.Empty, notificationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to create task assignment for Task Title {TaskTitle}, ProjectId {ProjectId}, UserId {UserId}.",
                    model.Title,
                    model.ProjectId,
                    model.AssignedToUserId);

                var errorMessage = _environment.IsDevelopment()
                    ? ex.GetBaseException().Message
                    : "Unable to create the task assignment. Please try again.";

                return (false, errorMessage, 0);
            }
        }

        public async Task<(bool Success, string Error, int NotificationId)> ReassignAsync(int taskId, string newUserId)
        {
            if (string.IsNullOrWhiteSpace(newUserId))
                return (false, "Please select a user.", 0);

            var task = await _db.TaskItems
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == taskId);

            if (task == null)
                return (false, "Task not found.", 0);

            if (string.Equals(task.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                return (false, "Completed tasks cannot be reassigned.", 0);

            var latestAssignment = await _db.TaskAssignments
                .Where(a => a.TaskId == taskId)
                .OrderByDescending(a => a.Id)
                .FirstOrDefaultAsync();

            if (latestAssignment == null ||
                !string.Equals(latestAssignment.Status, "Rejected", StringComparison.OrdinalIgnoreCase))
                return (false, "Only rejected tasks can be reassigned.", 0);

            if (string.Equals(latestAssignment.UserId, newUserId, StringComparison.Ordinal))
                return (false, "Please select a different user.", 0);

            var assignedUser = await _userManager.FindByIdAsync(newUserId);

            if (assignedUser == null)
                return (false, "Selected user not found.", 0);

            if (!assignedUser.IsActive)
                return (false, "The selected user is not active.", 0);

            if (await _userManager.IsInRoleAsync(assignedUser, "Admin"))
                return (false, "An administrator cannot be assigned to a task.", 0);

            if (!await _userManager.IsInRoleAsync(assignedUser, "User"))
                return (false, "Only users can be assigned to tasks.", 0);

            var pendingOrAccepted = await _db.TaskAssignments
                .AnyAsync(a =>
                    a.TaskId == taskId &&
                    (a.Status == "Pending" || a.Status == "Accepted"));

            if (pendingOrAccepted)
                return (false, "This task already has an active assignment request.", 0);

            try
            {
                var executionStrategy = _db.Database.CreateExecutionStrategy();
                var notificationId = 0;

                await executionStrategy.ExecuteAsync(async () =>
                {
                    await using var transaction =
                        await _db.Database.BeginTransactionAsync();

                    var assignment = new TaskAssignment
                    {
                        TaskId = taskId,
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
                    notificationId = notification.Id;
                });

                return (true, string.Empty, notificationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to reassign TaskId {TaskId} to UserId {UserId}.",
                    taskId,
                    newUserId);

                var errorMessage = _environment.IsDevelopment()
                    ? ex.GetBaseException().Message
                    : "Unable to reassign the task. Please try again.";

                return (false, errorMessage, 0);
            }
        }

        public async Task<(bool Success, string Error, int TaskId, int ProjectId, int AssignmentId, int NotificationId, string OldStatus, string NewStatus)> ChangeStatusAsync(
            int taskId,
            string userId,
            string newStatus,
            string? completionRepositoryUrl = null)
        {
            if (string.IsNullOrWhiteSpace(userId))
                return (false, "User not found.", 0, 0, 0, 0, string.Empty, string.Empty);

            if (string.IsNullOrWhiteSpace(newStatus))
                return (false, "Invalid target status.", taskId, 0, 0, 0, string.Empty, string.Empty);

            newStatus = AllowedStatuses.FirstOrDefault(s =>
                string.Equals(s, newStatus, StringComparison.OrdinalIgnoreCase)) ?? newStatus;

            if (!AllowedStatuses.Contains(newStatus))
                return (false, "Invalid target status.", taskId, 0, 0, 0, string.Empty, newStatus);

            if (string.Equals(newStatus, "Completed", StringComparison.OrdinalIgnoreCase))
                return (false, "Tasks must be submitted for admin review before they can be completed.", taskId, 0, 0, 0, string.Empty, newStatus);

            var task = await _db.TaskItems.FirstOrDefaultAsync(t => t.Id == taskId);

            if (task == null)
                return (false, "Task not found.", taskId, 0, 0, 0, string.Empty, newStatus);

            if (string.IsNullOrWhiteSpace(task.AssignedToUserId) || task.AssignedToUserId != userId)
                return (false, "Unauthorized to modify this task.", taskId, task.ProjectId, 0, 0, task.Status ?? string.Empty, newStatus);

            var oldStatus = task.Status ?? string.Empty;

            if (string.Equals(oldStatus, "Completed", StringComparison.OrdinalIgnoreCase))
                return (false, "Completed tasks cannot be modified.", taskId, task.ProjectId, 0, 0, oldStatus, newStatus);

            if (string.Equals(oldStatus, newStatus, StringComparison.OrdinalIgnoreCase))
                return (false, "Task is already in the requested status.", taskId, task.ProjectId, 0, 0, oldStatus, newStatus);

            var allowed =
                (string.Equals(oldStatus, "Pending", StringComparison.OrdinalIgnoreCase) && string.Equals(newStatus, "In Progress", StringComparison.OrdinalIgnoreCase)) ||
                (string.Equals(oldStatus, "In Progress", StringComparison.OrdinalIgnoreCase) &&
                    (string.Equals(newStatus, "On Hold", StringComparison.OrdinalIgnoreCase) || string.Equals(newStatus, "Completed", StringComparison.OrdinalIgnoreCase))) ||
                (string.Equals(oldStatus, "On Hold", StringComparison.OrdinalIgnoreCase) && string.Equals(newStatus, "In Progress", StringComparison.OrdinalIgnoreCase));

            if (!allowed)
                return (false, "Status transition is not allowed.", taskId, task.ProjectId, 0, 0, oldStatus, newStatus);

            var assignment = await _db.TaskAssignments
                .Where(a => a.TaskId == taskId && a.UserId == userId)
                .OrderByDescending(a => a.Id)
                .FirstOrDefaultAsync();

            if (assignment == null)
                return (false, "Task assignment not found.", taskId, task.ProjectId, 0, 0, oldStatus, newStatus);

            if (string.Equals(newStatus, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                if (!IsValidGitHubRepositoryUrl(completionRepositoryUrl))
                    return (false, "A valid GitHub repository URL is required to complete this task.", taskId, task.ProjectId, assignment.Id, 0, oldStatus, newStatus);

                assignment.CompletionRepositoryUrl = completionRepositoryUrl!.Trim();
                assignment.RespondedAt ??= DateTime.UtcNow;
            }

            task.Status = newStatus;

            if (string.Equals(newStatus, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                var taskChats = await _db.ChatSessions
                    .Where(x => x.TaskId == taskId)
                    .ToListAsync();

                if (taskChats.Count > 0)
                    _db.ChatSessions.RemoveRange(taskChats);
            }

            try
            {
                var notificationId = 0;
                var executionStrategy = _db.Database.CreateExecutionStrategy();

                await executionStrategy.ExecuteAsync(async () =>
                {
                    await using var transaction = await _db.Database.BeginTransactionAsync();

                    if (string.Equals(newStatus, "Completed", StringComparison.OrdinalIgnoreCase))
                    {
                        var admin = (await _userManager.GetUsersInRoleAsync("Admin")).FirstOrDefault();

                        if (admin != null)
                        {
                            var notification = new Notification
                            {
                                UserId = admin.Id,
                                TaskAssignmentId = assignment.Id,
                                Type = "AdminTaskCompleted",
                                Title = $"Task Completed: {task.Title}",
                                IsRead = false,
                                IsDelivered = false,
                                CreatedAt = DateTime.UtcNow
                            };

                            _db.Notifications.Add(notification);
                            await _db.SaveChangesAsync();
                            notificationId = notification.Id;
                        }
                        else
                        {
                            await _db.SaveChangesAsync();
                        }
                    }
                    else
                    {
                        await _db.SaveChangesAsync();
                    }

                    await transaction.CommitAsync();
                });

                return (true, string.Empty, taskId, task.ProjectId, assignment.Id, notificationId, oldStatus, newStatus);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update task status for TaskId {TaskId}.", taskId);
                return (false, "Failed to update task status.", taskId, task.ProjectId, assignment.Id, 0, oldStatus, newStatus);
            }
        }

        private static bool IsValidGitHubRepositoryUrl(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return false;

            if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri))
                return false;

            if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
                return false;

            if (!string.Equals(uri.Host, "github.com", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(uri.Host, "www.github.com", StringComparison.OrdinalIgnoreCase))
                return false;

            var segments = uri.AbsolutePath
                .Split('/', StringSplitOptions.RemoveEmptyEntries);

            return segments.Length >= 2;
        }

        public async Task<(bool Success, string Error, int ReviewId)> SubmitForReviewAsync(
            int taskId,
            string userId,
            string completionRepositoryUrl)
        {
            if (!IsValidGitHubRepositoryUrl(completionRepositoryUrl))
                return (false, "A valid GitHub repository URL is required.", 0);

            var task = await _db.TaskItems.FirstOrDefaultAsync(t => t.Id == taskId);
            if (task == null)
                return (false, "Task not found.", 0);

            if (!string.Equals(task.AssignedToUserId, userId, StringComparison.Ordinal))
                return (false, "Unauthorized to submit this task.", 0);

            if (string.Equals(task.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                return (false, "Completed tasks cannot be submitted again.", 0);

            if (!string.Equals(task.Status, "In Progress", StringComparison.OrdinalIgnoreCase))
                return (false, "Only tasks currently in progress can be submitted for review.", 0);

            var assignment = await _db.TaskAssignments
                .Where(a => a.TaskId == taskId && a.UserId == userId)
                .OrderByDescending(a => a.Id)
                .FirstOrDefaultAsync();

            if (assignment == null)
                return (false, "Task assignment not found.", 0);

            var pending = await _db.TaskReviews.AnyAsync(x =>
                x.TaskId == taskId &&
                x.Status == "Pending");

            if (pending)
                return (false, "This task is already waiting for admin review.", 0);

            assignment.CompletionRepositoryUrl = completionRepositoryUrl.Trim();
            assignment.RespondedAt = DateTime.UtcNow;
            task.Status = "Review Pending";

            var review = new TaskReview
            {
                TaskId = taskId,
                TaskAssignmentId = assignment.Id,
                SubmittedByUserId = userId,
                SubmittedAt = DateTime.UtcNow,
                Status = "Pending"
            };

            _db.TaskReviews.Add(review);

            var admin = (await _userManager.GetUsersInRoleAsync("Admin")).FirstOrDefault();
            if (admin != null)
            {
                _db.Notifications.Add(new Notification
                {
                    UserId = admin.Id,
                    TaskAssignmentId = assignment.Id,
                    Type = "AdminTaskReviewRequested",
                    Title = $"Task Review Requested: {task.Title}",
                    IsRead = false,
                    IsDelivered = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _db.SaveChangesAsync();
            return (true, string.Empty, review.Id);
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

            if (string.Equals(model.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                return (false, "Tasks can only be completed through the review and payment workflow.");

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

            // Keep the same cleanup rule when an admin changes a task
            // directly to Completed through the task editor.
            if (string.Equals(model.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                var taskChats = await _db.ChatSessions
                    .Where(x => x.TaskId == task.Id)
                    .ToListAsync();

                if (taskChats.Count > 0)
                    _db.ChatSessions.RemoveRange(taskChats);
            }

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
