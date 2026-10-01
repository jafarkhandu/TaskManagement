using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using TaskManagement.Application.DTOs;
using TaskManagement.Application.Interfaces;
using TaskManagement.Infrastructure.Identity;
using TaskManagement.WebApp.Hubs;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Data;

namespace TaskManagement.WebApp.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")]
    public class TasksController : Controller
    {
        private readonly ITaskService _taskService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IHubContext<NotificationHub> _notificationHub;
        private readonly IHubContext<ChatHub> _chatHub;
        private readonly ApplicationDbContext _context;

        public TasksController(
            ITaskService taskService,
            UserManager<ApplicationUser> userManager,
            IHubContext<NotificationHub> notificationHub,
            IHubContext<ChatHub> chatHub,
            ApplicationDbContext context)
        {
            _taskService = taskService;
            _userManager = userManager;
            _notificationHub = notificationHub;
            _chatHub = chatHub;
            _context = context;
        }

        // GET: /Admin/Tasks/Project/{id}
        [HttpGet]
        public async Task<IActionResult> Project(int id)
        {
            // Verify project exists by attempting to get tasks (service will validate existence in Create but here we check quickly)
            var tasks = await _taskService.GetTasksByProjectIdAsync(id);

            // If project does not exist the service may return null. If tasks is null, treat as NotFound.
            if (tasks == null)
            {
                return NotFound();
            }

            ViewBag.ProjectId = id;
            return View("ProjectTasks", tasks);
        }

        [HttpGet]
        public async Task<IActionResult> Get(int id)
        {
            var task = await _taskService.GetByIdAsync(id);
            if (task == null) return NotFound();
            return Json(task);
        }

        [HttpGet]
        public async Task<IActionResult> Details(int id)
        {
            var task = await _taskService.GetDetailsAsync(id);
            if (task == null) return Json(new { success = false, message = "Task not found." });
            return Json(new { success = true, data = task });
        }

        [HttpGet]
        public async Task<IActionResult> Users()
        {
            var users = await _taskService.GetAssignableUsersAsync();

            return Json(new
            {
                success = true,
                users
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(TaskDto model)
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState.Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage);

                return BadRequest(new
                {
                    success = false,
                    message = string.Join(" | ", errors)
                });
            }

            // AssignedToUserId is posted from the form and will be validated by the service.

            var result = await _taskService.CreateAsync(model);

            if (!result.Success)
            {
                return Json(new
                {
                    success = false,
                    message = result.Error
                });
            }

            // Notify the assigned user via SignalR about the persisted notification.
            // The TaskService returns the created NotificationId as part of the result.
            var notificationId = result.NotificationId;

            await _notificationHub.Clients
                .User(model.AssignedToUserId)
                .SendAsync(
                    "TaskAssignmentReceived",
                    new
                    {
                        notificationId = notificationId,
                        title = model.Title,
                        scenario = model.Scenario,
                        priority = model.Priority,
                        startDate = model.StartDate,
                        expectedEndDate = model.ExpectedEndDate,
                        amount = model.Amount
                    });

            return Json(new
            {
                success = true,
                message = "Task created successfully."
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Update(TaskDto model)
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage);
                return BadRequest(new { success = false, message = string.Join(" | ", errors) });
            }

            var chatSessionIdsToDelete =
                string.Equals(model.Status, "Completed", StringComparison.OrdinalIgnoreCase)
                    ? await _context.ChatSessions
                        .AsNoTracking()
                        .Where(x => x.TaskId == model.Id && x.IsActive)
                        .Select(x => x.Id)
                        .ToListAsync()
                    : new List<int>();

            // Capture a still-pending assignment before the update so a reassignment
            // can be delivered live to both the old and new users.
            var previousPendingAssignment = await _context.TaskAssignments
                .AsNoTracking()
                .Where(a => a.TaskId == model.Id && a.Status == "Pending")
                .OrderByDescending(a => a.Id)
                .FirstOrDefaultAsync();

            var assignmentChangedWhilePending =
                previousPendingAssignment != null &&
                !string.Equals(
                    previousPendingAssignment.UserId,
                    model.AssignedToUserId,
                    StringComparison.Ordinal);

            var result = await _taskService.UpdateAsync(model);
            if (!result.Success)
                return Json(new { success = false, message = result.Error });

            if (assignmentChangedWhilePending && previousPendingAssignment != null)
            {
                var task = await _context.TaskItems
                    .AsNoTracking()
                    .Where(t => t.Id == model.Id)
                    .Select(t => new
                    {
                        t.Id,
                        t.Title,
                        t.Scenario,
                        t.Priority,
                        t.StartDate,
                        t.ExpectedEndDate,
                        t.Amount,
                        t.ProjectId
                    })
                    .FirstOrDefaultAsync();

                var newAssignment = await _context.TaskAssignments
                    .AsNoTracking()
                    .Where(a =>
                        a.TaskId == model.Id &&
                        a.UserId == model.AssignedToUserId &&
                        a.Status == "Pending")
                    .OrderByDescending(a => a.Id)
                    .FirstOrDefaultAsync();

                if (task != null && newAssignment != null)
                {
                    var oldNotification = await _context.Notifications
                        .AsNoTracking()
                        .Where(n =>
                            n.TaskAssignmentId == previousPendingAssignment.Id &&
                            n.UserId == previousPendingAssignment.UserId &&
                            n.Type == "TaskAssignmentReassigned")
                        .OrderByDescending(n => n.Id)
                        .FirstOrDefaultAsync();

                    var newNotification = await _context.Notifications
                        .AsNoTracking()
                        .Where(n =>
                            n.TaskAssignmentId == newAssignment.Id &&
                            n.UserId == model.AssignedToUserId &&
                            n.Type == "TaskAssignment")
                        .OrderByDescending(n => n.Id)
                        .FirstOrDefaultAsync();

                    if (oldNotification != null)
                    {
                        await _notificationHub.Clients
                            .User(previousPendingAssignment.UserId)
                            .SendAsync("TaskAssignmentReassigned", new
                            {
                                notificationId = oldNotification.Id,
                                type = oldNotification.Type,
                                title = oldNotification.Title,
                                message = $"Task "{task.Title}" has been reassigned. You can no longer accept or reject this task.",
                                taskId = task.Id,
                                projectId = task.ProjectId,
                                createdAt = oldNotification.CreatedAt
                            });
                    }

                    if (newNotification != null)
                    {
                        await _notificationHub.Clients
                            .User(model.AssignedToUserId)
                            .SendAsync("TaskAssignmentReceived", new
                            {
                                notificationId = newNotification.Id,
                                type = newNotification.Type,
                                title = newNotification.Title,
                                message = $"Task "{task.Title}" has been assigned to you. Please accept or reject it.",
                                scenario = task.Scenario,
                                priority = task.Priority,
                                startDate = task.StartDate,
                                expectedEndDate = task.ExpectedEndDate,
                                amount = task.Amount,
                                taskId = task.Id,
                                projectId = task.ProjectId,
                                createdAt = newNotification.CreatedAt
                            });
                    }
                }
            }

            if (string.Equals(model.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var chatSessionId in chatSessionIdsToDelete)
                {
                    try
                    {
                        await _chatHub.Clients
                            .Group($"chat-{chatSessionId}")
                            .SendAsync("ChatDeleted", new { chatSessionId });
                    }
                    catch
                    {
                        // Non-fatal: the chat was already removed by TaskService.
                    }
                }
            }

            return Json(new { success = true, message = "Task updated successfully." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Reassign(int taskId, string userId)
        {
            if (taskId <= 0 || string.IsNullOrWhiteSpace(userId))
                return BadRequest(new { success = false, message = "Task and user are required." });

            var result = await _taskService.ReassignAsync(taskId, userId);

            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            var task = await _taskService.GetByIdAsync(taskId);

            await _notificationHub.Clients
                .User(userId)
                .SendAsync(
                    "TaskAssignmentReceived",
                    new
                    {
                        notificationId = result.NotificationId,
                        title = task?.Title ?? "New Task",
                        scenario = task?.Scenario ?? string.Empty,
                        priority = task?.Priority ?? "Low",
                        startDate = task?.StartDate,
                        expectedEndDate = task?.ExpectedEndDate,
                        amount = task?.Amount ?? 0
                    });

            return Json(new
            {
                success = true,
                message = "Task re-assigned successfully."
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id, int projectId)
        {
            // Ensure the task belongs to the project (service checks ownership in Update/Delete)
            var task = await _taskService.GetByIdAsync(id);
            if (task == null) return Json(new { success = false, message = "Task not found." });
            if (task.ProjectId != projectId) return Json(new { success = false, message = "Cross-project operation is not allowed." });

            var result = await _taskService.DeleteAsync(id);
            if (!result.Success) return Json(new { success = false, message = result.Error });
            return Json(new { success = true, message = "Task deleted successfully." });
        }




    }
}
