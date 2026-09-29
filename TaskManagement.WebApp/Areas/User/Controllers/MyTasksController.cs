using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Interfaces;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;
using TaskManagement.WebApp.Hubs;

namespace TaskManagement.WebApp.Areas.User.Controllers
{
    [Area("User")]
    [Authorize(Roles = "User")]
    public class MyTasksController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ITaskService _taskService;
        private readonly IHubContext<NotificationHub> _notificationHub;
        private readonly IHubContext<ChatHub> _chatHub;
        private readonly IChatService _chatService;

        public MyTasksController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager,
            ITaskService taskService,
            IHubContext<NotificationHub> notificationHub,
            IHubContext<ChatHub> chatHub,
            IChatService chatService)
        {
            _context = context;
            _userManager = userManager;
            _taskService = taskService;
            _notificationHub = notificationHub;
            _chatHub = chatHub;
            _chatService = chatService;
        }

        [HttpGet]
        public async Task<IActionResult> CheckActiveSession(int taskId)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();

            var chatSessionId = await _chatService.GetActiveChatSessionIdAsync(taskId, user.Id);

            if (chatSessionId.HasValue)
            {
                return Json(new
                {
                    success = true,
                    exists = true,
                    chatSessionId = chatSessionId.Value
                });
            }

            return Json(new
            {
                success = true,
                exists = false
            });
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();

            var tasks = await _context.TaskItems
                .AsNoTracking()
                .Where(t => t.AssignedToUserId == user.Id)
                .OrderBy(t => t.Status == "Completed")
                .ThenBy(t => t.ExpectedEndDate)
                .ThenByDescending(t => t.Id)
                .ToListAsync();

            return View(tasks);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ChangeStatus(
            int taskId,
            string newStatus,
            string? completionRepositoryUrl = null)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();

            var result = await _taskService.ChangeStatusAsync(
                taskId,
                user.Id,
                newStatus,
                completionRepositoryUrl);

            if (!result.Success)
            {
                return Json(new { success = false, message = result.Error });
            }

            // Notify project listeners about the status change.
            try
            {
                await _notificationHub.Clients.Group($"project-{result.ProjectId}")
                    .SendAsync("TaskStatusChanged", new
                    {
                        TaskId = result.TaskId,
                        ProjectId = result.ProjectId,
                        OldStatus = result.OldStatus,
                        NewStatus = result.NewStatus,
                        UpdatedAt = DateTime.UtcNow
                    });
            }
            catch
            {
                // The task update is already persisted.
            }

            if (string.Equals(result.NewStatus, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                var completionTask = await _context.TaskItems
                    .AsNoTracking()
                    .Where(t => t.Id == result.TaskId)
                    .Select(t => new { t.Id, t.Title })
                    .FirstOrDefaultAsync();

                var completedBy = user.FullName ?? user.UserName ?? "User";

                // The notification row was created in the same database transaction
                // as the completion, so delivery can safely happen after persistence.
                if (result.NotificationId > 0)
                {
                    var notification = await _context.Notifications
                        .FirstOrDefaultAsync(n =>
                            n.Id == result.NotificationId &&
                            n.Type == "AdminTaskCompleted");

                    if (notification != null && NotificationHub.IsUserOnline(notification.UserId))
                    {
                        try
                        {
                            await _notificationHub.Clients.User(notification.UserId)
                                .SendAsync("AdminLiveNotification", new
                                {
                                    notificationId = notification.Id,
                                    type = notification.Type,
                                    title = notification.Title,
                                    message = $"{completedBy} completed {completionTask?.Title ?? "a task"}.",
                                    userName = completedBy,
                                    taskId = result.TaskId,
                                    taskTitle = completionTask?.Title ?? "Task",
                                    completionRepositoryUrl = completionRepositoryUrl?.Trim(),
                                    createdAt = notification.CreatedAt
                                });

                            notification.IsDelivered = true;
                            await _context.SaveChangesAsync();
                        }
                        catch
                        {
                            // Keep IsDelivered=false so the admin receives it on reconnect.
                        }
                    }
                }

                // Completed tasks no longer keep their task chat. The service already
                // removed the database records; notify any connected chat clients too.
                try
                {
                    await _chatHub.Clients
                        .Group($"chat-task-{result.TaskId}")
                        .SendAsync("ChatDeleted", new { taskId = result.TaskId });
                }
                catch
                {
                    // Non-fatal.
                }
            }

            return Json(new
            {
                success = true,
                message = "Task status updated.",
                taskId = result.TaskId,
                projectId = result.ProjectId,
                assignmentId = result.AssignmentId,
                notificationId = result.NotificationId,
                oldStatus = result.OldStatus,
                newStatus = result.NewStatus,
                completionRepositoryUrl = result.NewStatus == "Completed"
                    ? completionRepositoryUrl?.Trim()
                    : null
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> StartChat(int taskId)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();

            var result = await _chatService.StartChatAsync(
                taskId,
                user.Id);

            if (!result.Success)
            {
                return Json(new
                {
                    success = false,
                    message = result.Error
                });
            }

            // If this is a newly created session, notify admins so admin UI can update in real-time.
            if (result.IsNew)
            {
                try
                {
                    var task = await _context.TaskItems
                        .AsNoTracking()
                        .Where(t => t.Id == taskId)
                        .Select(t => new { t.Id, t.Title, t.Status, t.ProjectId })
                        .FirstOrDefaultAsync()
                        ?? throw new InvalidOperationException("Task not found.");

                    var projectTitle = await _context.Projects
                        .AsNoTracking()
                        .Where(p => p.Id == task.ProjectId)
                        .Select(p => p.ProjectTitle)
                        .FirstOrDefaultAsync() ?? string.Empty;

                    var assignmentId = await _context.TaskAssignments
                        .Where(a =>
                            a.TaskId == task.Id &&
                            a.UserId == user.Id)
                        .OrderByDescending(a => a.Id)
                        .Select(a => (int?)a.Id)
                        .FirstOrDefaultAsync();

                    if (assignmentId.HasValue)
                    {
                        var admins = await _userManager.GetUsersInRoleAsync("Admin");

                        foreach (var admin in admins)
                        {
                            var notification = new TaskManagement.Domain.Entities.Notification
                            {
                                UserId = admin.Id,
                                TaskAssignmentId = assignmentId.Value,
                                Type = "AdminChatMessage",
                                Title = "New Chat Message",
                                IsRead = false,
                                IsDelivered = false,
                                CreatedAt = DateTime.UtcNow
                            };

                            _context.Notifications.Add(notification);
                            await _context.SaveChangesAsync();

                            if (NotificationHub.IsUserOnline(admin.Id))
                            {
                                try
                                {
                                    await _notificationHub.Clients.User(admin.Id)
                                        .SendAsync("AdminLiveNotification", new
                                        {
                                            notificationId = notification.Id,
                                            type = notification.Type,
                                            title = notification.Title,
                                            message = "A user started a new task chat.",
                                            userName = user.FullName ?? user.UserName ?? string.Empty,
                                            chatSessionId = result.ChatSessionId,
                                            taskId = task.Id,
                                            taskTitle = task.Title,
                                            createdAt = notification.CreatedAt
                                        });

                                    notification.IsDelivered = true;
                                    notification.IsRead = true;
                                    await _context.SaveChangesAsync();
                                }
                                catch
                                {
                                    // Keep it pending for the next admin connection.
                                }
                            }
                        }
                    }

                    await _notificationHub.Clients.Group("admins")
                        .SendAsync("NewChatSession", new
                        {
                            ChatSessionId = result.ChatSessionId,
                            UserId = user.Id,
                            UserFullName = user.FullName ?? user.UserName ?? string.Empty,
                            TaskId = task.Id,
                            TaskTitle = task.Title,
                            TaskStatus = task.Status,
                            ProjectId = task.ProjectId,
                            ProjectTitle = projectTitle
                        });
                }
                catch
                {
                    // Non-fatal
                }
            }

            return Json(new
            {
                success = true,
                chatSessionId = result.ChatSessionId
            });
        }

        [HttpGet]
        public async Task<IActionResult> GetAvailableChatTasks(string? search = null)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();

            var tasks = await _chatService.GetAvailableChatTasksAsync(user.Id, search);

            return Json(new
            {
                success = true,
                data = tasks
            });
        }

        [HttpGet]
        public async Task<IActionResult> GetUserChats()
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();

            var sessions = await _chatService.GetUserChatSessionsAsync(user.Id);

            return Json(new { success = true, data = sessions });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> MarkChatRead(int chatSessionId)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();
            var result = await _chatService.MarkMessagesAsReadAsync(chatSessionId, user.Id);

            if (!result.Success)
            {
                return Json(new { success = false, message = result.Error });
            }

            return Json(new { success = true });
        }

        [HttpGet]
        public async Task<IActionResult> GetChat(int chatSessionId)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();

            var isAdmin = await _userManager.IsInRoleAsync(user, "Admin");

            var chat = await _chatService.GetChatAsync(
                chatSessionId,
                user.Id,
                isAdmin);

            if (chat == null)
            {
                return Json(new
                {
                    success = false,
                    message = "Chat not found or unavailable."
                });
            }

            return Json(new
            {
                success = true,
                data = chat
            });
        }
    }
}
