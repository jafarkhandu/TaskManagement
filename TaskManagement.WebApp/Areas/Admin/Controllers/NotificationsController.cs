using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;

namespace TaskManagement.WebApp.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")]
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

        [HttpGet]
        public async Task<IActionResult> Pending()
        {
            var admin = await _userManager.GetUserAsync(User);

            if (admin == null)
                return Unauthorized();

            var notifications = await (
                from n in _context.Notifications.AsNoTracking()
                join a in _context.TaskAssignments.AsNoTracking()
                    on n.TaskAssignmentId equals a.Id
                join t in _context.TaskItems.AsNoTracking()
                    on a.TaskId equals t.Id
                join u in _context.Users.AsNoTracking()
                    on a.UserId equals u.Id
                where n.UserId == admin.Id
                      && n.Type.StartsWith("Admin")
                orderby n.CreatedAt descending
                select new
                {
                    notificationId = n.Id,
                    type = n.Type,
                    title = n.Title,
                    message =
                        n.Type == "AdminTaskCompleted"
                            ? $"{(u.FullName ?? u.UserName ?? "User")} completed {t.Title}."
                            : n.Type == "AdminAssignmentResponse"
                                ? $"{(u.FullName ?? u.UserName ?? "User")} responded to {t.Title}."
                                : "You have a new administrator notification.",
                    userName = u.FullName ?? u.UserName ?? "User",
                    taskId = t.Id,
                    taskTitle = t.Title,
                    completionRepositoryUrl =
                        n.Type == "AdminTaskCompleted"
                            ? a.CompletionRepositoryUrl
                            : null,
                    isRead = n.IsRead,
                    createdAt = n.CreatedAt
                })
                .Take(30)
                .ToListAsync();

            return Json(new
            {
                success = true,
                notifications
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ClearAll()
        {
            var admin = await _userManager.GetUserAsync(User);

            if (admin == null)
                return Unauthorized();

            var notifications = await _context.Notifications
                .Where(n =>
                    n.UserId == admin.Id &&
                    n.Type.StartsWith("Admin"))
                .ToListAsync();

            if (notifications.Count > 0)
            {
                _context.Notifications.RemoveRange(notifications);
                await _context.SaveChangesAsync();
            }

            return Json(new { success = true });
        }
    }
}
