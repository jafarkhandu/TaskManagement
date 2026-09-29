using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;
using TaskManagement.WebApp.Hubs;

namespace TaskManagement.WebApp.Areas.User.Controllers
{
    [Area("User")]
    [Authorize(Roles = "User")]
    public class NotificationsController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IHubContext<NotificationHub> _notificationHub;

        public NotificationsController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager,
            IHubContext<NotificationHub> notificationHub)
        {
            _context = context;
            _userManager = userManager;
            _notificationHub = notificationHub;
        }

        // GET: /User/Notifications
        [HttpGet]
        public IActionResult Index()
        {
            return View();
        }

        // GET: /User/Notifications/Details/{id}
        [HttpGet]
        public async Task<IActionResult> Details(int id)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized();

            var notification = await _context.Notifications
                .AsNoTracking()
                .Where(n => n.Id == id && n.UserId == user.Id)
                .Join(
                    _context.TaskAssignments,
                    n => n.TaskAssignmentId,
                    a => a.Id,
                    (n, a) => new { Notification = n, Assignment = a }
                )
                .Join(
                    _context.TaskItems,
                    x => x.Assignment.TaskId,
                    t => t.Id,
                    (x, t) => new
                    {
                        NotificationId = x.Notification.Id,
                        AssignmentId = x.Assignment.Id,
                        AssignmentStatus = x.Assignment.Status,

                        // ONLY TASK DETAILS
                        Title = t.Title,
                        Scenario = t.Scenario,
                        Priority = t.Priority,
                        StartDate = t.StartDate,
                        ExpectedEndDate = t.ExpectedEndDate,
                        Amount = t.Amount,

                        IsRead = x.Notification.IsRead,
                        CreatedAt = x.Notification.CreatedAt
                    }
                )
                .FirstOrDefaultAsync();

            if (notification == null)
                return NotFound();

            return View(notification);
        }

        // Get pending task assignment notifications
        [HttpGet]
        public async Task<IActionResult> Pending()
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized();

            var notifications = await _context.Notifications
                .AsNoTracking()
                .Where(n =>
                    n.UserId == user.Id &&
                    n.Type == "TaskAssignment")
                .Join(
                    _context.TaskAssignments,
                    n => n.TaskAssignmentId,
                    a => a.Id,
                    (n, a) => new { Notification = n, Assignment = a }
                )
                .Join(
                    _context.TaskItems,
                    x => x.Assignment.TaskId,
                    t => t.Id,
                    (x, t) => new
                    {
                        NotificationId = x.Notification.Id,
                        AssignmentId = x.Assignment.Id,
                        AssignmentStatus = x.Assignment.Status,

                        // ONLY TASK DETAILS
                        Title = t.Title,
                        Scenario = t.Scenario,
                        Priority = t.Priority,
                        StartDate = t.StartDate,
                        ExpectedEndDate = t.ExpectedEndDate,
                        Amount = t.Amount,

                        CreatedAt = x.Notification.CreatedAt
                    }
                )
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            return Json(new
            {
                success = true,
                notifications
            });
        }

        // Accept task assignment
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Accept(int assignmentId)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized();

            var assignment = await _context.TaskAssignments
                .FirstOrDefaultAsync(x =>
                    x.Id == assignmentId &&
                    x.UserId == user.Id);

            if (assignment == null)
                return NotFound(new
                {
                    success = false,
                    message = "Assignment not found."
                });

            if (assignment.Status != "Pending")
            {
                return BadRequest(new
                {
                    success = false,
                    message = "This assignment has already been processed."
                });
            }

            var task = await _context.TaskItems
                .FirstOrDefaultAsync(x => x.Id == assignment.TaskId);

            if (task == null)
                return NotFound(new
                {
                    success = false,
                    message = "Task not found."
                });

            // Prevent accepting a task that is already accepted
            var alreadyAccepted = await _context.TaskAssignments
                .AnyAsync(x =>
                    x.TaskId == assignment.TaskId &&
                    x.Status == "Accepted");

            if (alreadyAccepted)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "This task has already been assigned."
                });
            }

            try
            {
                assignment.Status = "Accepted";
                assignment.RespondedAt = DateTime.UtcNow;

                // NOW the task is officially assigned
                task.AssignedToUserId = user.Id;

                var notification = await _context.Notifications
                    .FirstOrDefaultAsync(x =>
                        x.TaskAssignmentId == assignment.Id &&
                        x.UserId == user.Id &&
                        !x.IsRead);

                if (notification != null)
                    notification.IsRead = true;

                // A single SaveChangesAsync call is atomic in EF Core's
                // implicit database transaction and works with the
                // configured SQL retry execution strategy.
                await _context.SaveChangesAsync();

                await NotifyAdminsOfAssignmentResponseAsync(
                    assignment,
                    task,
                    "Accepted");

                return Json(new
                {
                    success = true,
                    message = "Task accepted successfully."
                });
            }
            catch
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Unable to accept the task."
                });
            }
        }

        // Reject task assignment
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Reject(int assignmentId)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized();

            var assignment = await _context.TaskAssignments
                .FirstOrDefaultAsync(x =>
                    x.Id == assignmentId &&
                    x.UserId == user.Id);

            if (assignment == null)
                return NotFound(new
                {
                    success = false,
                    message = "Assignment not found."
                });

            if (assignment.Status != "Pending")
            {
                return BadRequest(new
                {
                    success = false,
                    message = "This assignment has already been processed."
                });
            }

            var task = await _context.TaskItems
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == assignment.TaskId);

            if (task == null)
            {
                return NotFound(new
                {
                    success = false,
                    message = "Task not found."
                });
            }

            try
            {
                assignment.Status = "Rejected";
                assignment.RespondedAt = DateTime.UtcNow;

                var notification = await _context.Notifications
                    .FirstOrDefaultAsync(x =>
                        x.TaskAssignmentId == assignment.Id &&
                        x.UserId == user.Id &&
                        !x.IsRead);

                if (notification != null)
                    notification.IsRead = true;

                // A single SaveChangesAsync call is atomic in EF Core's
                // implicit database transaction and works with the
                // configured SQL retry execution strategy.
                await _context.SaveChangesAsync();

                await NotifyAdminsOfAssignmentResponseAsync(
                    assignment,
                    task,
                    "Rejected");

                return Json(new
                {
                    success = true,
                    message = "Task assignment rejected."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Unable to reject the task."
                });
            }
        }

        private async Task NotifyAdminsOfAssignmentResponseAsync(
            TaskManagement.Domain.Entities.TaskAssignment assignment,
            TaskManagement.Domain.Entities.TaskItem task,
            string response)
        {
            try
            {
                var admins = await _userManager.GetUsersInRoleAsync("Admin");

                foreach (var admin in admins)
                {
                    var notification = new TaskManagement.Domain.Entities.Notification
                    {
                        UserId = admin.Id,
                        TaskAssignmentId = assignment.Id,
                        Type = "AdminAssignmentResponse",
                        Title = response == "Accepted"
                            ? "Task Assignment Approved"
                            : "Task Assignment Rejected",
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
                                    message = response == "Accepted"
                                        ? $"{task.Title} was approved by {User.Identity?.Name ?? "User"}."
                                        : $"{task.Title} was rejected by {User.Identity?.Name ?? "User"}.",
                                    userName = User.Identity?.Name ?? "User",
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
            catch
            {
                // Assignment response must not fail because notification delivery failed.
            }
        }

        // POST: /User/Notifications/Delete
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized();

            var notification = await _context.Notifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == user.Id);

            if (notification == null)
                return NotFound(new { success = false, message = "Notification not found." });

            try
            {
                _context.Notifications.Remove(notification);
                await _context.SaveChangesAsync();

                return Json(new { success = true });
            }
            catch
            {
                return StatusCode(500, new { success = false, message = "Unable to delete notification." });
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ClearAll()
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized();

            try
            {
                var notifications = await _context.Notifications
                    .Where(n =>
                        n.UserId == user.Id &&
                        n.Type == "TaskAssignment")
                    .ToListAsync();

                if (notifications.Count > 0)
                {
                    _context.Notifications.RemoveRange(notifications);
                    await _context.SaveChangesAsync();
                }

                return Json(new
                {
                    success = true
                });
            }
            catch
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Unable to clear notifications."
                });
            }
        }
    }
}
