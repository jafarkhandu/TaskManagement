using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using TaskManagement.Application.Interfaces;
using TaskManagement.Infrastructure.Identity;
using TaskManagement.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using TaskManagement.WebApp.Hubs;

namespace TaskManagement.WebApp.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")]
    public class TaskReviewsController : Controller
    {
        private readonly ITaskReviewService _reviewService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IHubContext<NotificationHub> _notificationHub;
        private readonly IHubContext<ChatHub> _chatHub;
        private readonly ApplicationDbContext _context;

        public TaskReviewsController(
            ITaskReviewService reviewService,
            UserManager<ApplicationUser> userManager,
            IHubContext<NotificationHub> notificationHub,
            IHubContext<ChatHub> chatHub,
            ApplicationDbContext context)
        {
            _reviewService = reviewService;
            _userManager = userManager;
            _notificationHub = notificationHub;
            _chatHub = chatHub;
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            ViewBag.PendingPayments = await _reviewService.GetPendingPaymentsAsync();
            return View(await _reviewService.GetPendingReviewsAsync());
        }

        [HttpGet]
        public async Task<IActionResult> Pending()
        {
            return Json(new
            {
                success = true,
                reviews = await _reviewService.GetPendingReviewsAsync()
            });
        }

        [HttpGet]
        public async Task<IActionResult> Details(int id)
        {
            var review = await _reviewService.GetReviewAsync(id);
            return review == null
                ? Json(new { success = false, message = "Review not found." })
                : Json(new { success = true, data = review });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Approve(int id)
        {
            var admin = await _userManager.GetUserAsync(User);
            if (admin == null) return Challenge();

            var review = await _context.TaskReviews
                .AsNoTracking()
                .Where(x => x.Id == id)
                .Select(x => new
                {
                    x.Id,
                    x.Status
                })
                .FirstOrDefaultAsync();

            if (review == null || !string.Equals(review.Status, "Pending", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { success = false, message = "Review request is no longer pending." });

            // Approve only opens the payment decision UI. No database state is
            // changed until the admin explicitly chooses Pay Now or Later.
            return Json(new
            {
                success = true,
                requiresPaymentDecision = true,
                reviewId = id,
                message = "Choose Pay Now or Later to approve this task."
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Reject(int id, string reason)
        {
            var admin = await _userManager.GetUserAsync(User);
            if (admin == null) return Challenge();

            var taskBeforeReject = await _context.TaskReviews
                .Where(r => r.Id == id)
                .Join(_context.TaskItems, r => r.TaskId, t => t.Id, (r, t) => new { t.Id, t.Status, t.ProjectId })
                .FirstOrDefaultAsync();

            var result = await _reviewService.RejectAsync(id, admin.Id, reason);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            await SendLatestUserNotificationAsync(id, "TaskReviewRejected");
            await BroadcastTaskStatusAsync(taskBeforeReject?.Id ?? 0, taskBeforeReject?.Status, taskBeforeReject?.ProjectId);

            return Json(new { success = true, message = "Task rejected and placed on hold." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SettlePayment(int id, bool payNow)
        {
            var admin = await _userManager.GetUserAsync(User);
            if (admin == null) return Challenge();

            var taskBeforeSettlement = await _context.TaskReviews
                .Where(r => r.Id == id)
                .Join(_context.TaskItems, r => r.TaskId, t => t.Id, (r, t) => new { t.Id, t.Status, t.ProjectId })
                .FirstOrDefaultAsync();

            var chatSessionsToDelete = taskBeforeSettlement == null
                ? new List<(int Id, string UserId)>()
                : await _context.ChatSessions
                    .AsNoTracking()
                    .Where(x => x.TaskId == taskBeforeSettlement.Id && x.IsActive)
                    .Select(x => new ValueTuple<int, string>(x.Id, x.UserId))
                    .ToListAsync();

            var result = await _reviewService.SettlePaymentAsync(id, admin.Id, payNow);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            await SendLatestUserNotificationAsync(
                id,
                payNow ? "TaskPaymentSettled" : "TaskReviewApproved");

            await BroadcastTaskStatusAsync(
                taskBeforeSettlement?.Id ?? 0,
                taskBeforeSettlement?.Status,
                taskBeforeSettlement?.ProjectId);

            if (taskBeforeSettlement != null)
            {
                foreach (var chat in chatSessionsToDelete)
                {
                    try
                    {
                        await _chatHub.Clients
                            .Group($"chat-{chat.Id}")
                            .SendAsync("ChatDeleted", new { chatSessionId = chat.Id });

                        await _chatHub.Clients
                            .User(chat.UserId)
                            .SendAsync("ChatDeleted", new { chatSessionId = chat.Id });
                    }
                    catch
                    {
                        // Chat cleanup must not undo a successful review settlement.
                    }
                }
            }

            return Json(new
            {
                success = true,
                paymentStatus = payNow ? "Paid" : "Pending",
                message = payNow
                    ? "Payment settled and task completed."
                    : "Task approved. Payment remains pending."
            });
        }

        private async Task BroadcastTaskStatusAsync(int taskId, string? oldStatus, int? projectId)
        {
            if (taskId <= 0 || projectId == null || string.IsNullOrWhiteSpace(oldStatus))
                return;

            var task = await _context.TaskItems
                .AsNoTracking()
                .Where(t => t.Id == taskId)
                .Select(t => new { t.Status, t.AssignedToUserId })
                .FirstOrDefaultAsync();

            if (task == null ||
                string.Equals(oldStatus, task.Status, StringComparison.OrdinalIgnoreCase))
                return;

            var payload = new
            {
                TaskId = taskId,
                ProjectId = projectId.Value,
                OldStatus = oldStatus,
                NewStatus = task.Status,
                UpdatedAt = DateTime.UtcNow
            };

            await _notificationHub.Clients
                .Group($"project-{projectId.Value}")
                .SendAsync("TaskStatusChanged", payload);

            if (!string.IsNullOrWhiteSpace(task.AssignedToUserId))
            {
                await _notificationHub.Clients
                    .User(task.AssignedToUserId)
                    .SendAsync("TaskStatusChanged", payload);
            }
        }

        private async Task SendLatestUserNotificationAsync(int reviewId, string type)
        {
            var review = await _context.TaskReviews
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == reviewId);

            if (review == null)
                return;

            var notification = await _context.Notifications
                .Where(x =>
                    x.TaskAssignmentId == review.TaskAssignmentId &&
                    x.Type == type)
                .OrderByDescending(x => x.Id)
                .FirstOrDefaultAsync();

            if (notification == null)
                return;

            if (!NotificationHub.IsUserOnline(notification.UserId))
                return;

            var reviewReason = type == "TaskReviewRejected"
                ? await _context.TaskReviews
                    .Where(r => r.Id == reviewId)
                    .Select(r => r.RejectionReason)
                    .FirstOrDefaultAsync()
                : null;

            var liveMessage = type == "TaskReviewRejected" &&
                              !string.IsNullOrWhiteSpace(reviewReason)
                ? reviewReason
                : type == "TaskPaymentSettled"
                    ? "Payment for your task has been settled."
                    : "Your submitted task has been approved by the admin.";

            await _notificationHub.Clients.User(notification.UserId)
                .SendAsync("UserReviewNotificationReceived", new
                {
                    notificationId = notification.Id,
                    type = notification.Type,
                    title = notification.Title,
                    message = liveMessage,
                    createdAt = notification.CreatedAt
                });

            notification.IsDelivered = true;
            await _context.SaveChangesAsync();
        }
    }
}