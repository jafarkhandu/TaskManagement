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
        private readonly IChatService _chatService;

        public MyTasksController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager,
            ITaskService taskService,
            IHubContext<NotificationHub> notificationHub,
            IChatService chatService)
        {
            _context = context;
            _userManager = userManager;
            _taskService = taskService;
            _notificationHub = notificationHub;
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
        public async Task<IActionResult> ChangeStatus(int taskId, string newStatus)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();

            var result = await _taskService.ChangeStatusAsync(taskId, user.Id, newStatus);

            if (!result.Success)
            {
                return Json(new { success = false, message = result.Error });
            }

            // Notify admin/project listeners about the status change
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
                // Notification failures should not block the primary operation
            }

            return Json(new
            {
                success = true,
                message = "Task status updated.",
                taskId = result.TaskId,
                projectId = result.ProjectId,
                oldStatus = result.OldStatus,
                newStatus = result.NewStatus
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
                        .FirstOrDefaultAsync();

                    var projectTitle = await _context.Projects
                        .AsNoTracking()
                        .Where(p => p.Id == task.ProjectId)
                        .Select(p => p.ProjectTitle)
                        .FirstOrDefaultAsync();

                    await _notificationHub.Clients.Group("admins")
                        .SendAsync("NewChatSession", new
                        {
                            ChatSessionId = result.ChatSessionId,
                            UserId = user.Id,
                            UserFullName = user.FullName ?? user.UserName,
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
