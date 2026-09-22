using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;

namespace TaskManagement.WebApp.Areas.User.Controllers
{
    [Area("User")]
    [Authorize(Roles = "User")]
    public class NotificationsController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public NotificationsController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
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
                    !n.IsRead &&
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
                .Where(x => x.AssignmentStatus == "Pending")
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

            await using var transaction =
                await _context.Database.BeginTransactionAsync();

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

                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Json(new
                {
                    success = true,
                    message = "Task accepted successfully."
                });
            }
            catch
            {
                await transaction.RollbackAsync();

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

            await using var transaction =
                await _context.Database.BeginTransactionAsync();

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

                // IMPORTANT:
                // Task is NOT deleted.
                // Task remains available for another user.

                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Json(new
                {
                    success = true,
                    message = "Task assignment rejected."
                });
            }
            catch
            {
                await transaction.RollbackAsync();

                return StatusCode(500, new
                {
                    success = false,
                    message = "Unable to reject the task."
                });
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
    }
}