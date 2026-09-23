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

        public MyTasksController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager,
            ITaskService taskService,
            IHubContext<NotificationHub> notificationHub)
        {
            _context = context;
            _userManager = userManager;
            _taskService = taskService;
            _notificationHub = notificationHub;
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
    }
}
