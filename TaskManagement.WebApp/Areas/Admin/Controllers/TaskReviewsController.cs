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
        private readonly ApplicationDbContext _context;

        public TaskReviewsController(
            ITaskReviewService reviewService,
            UserManager<ApplicationUser> userManager,
            IHubContext<NotificationHub> notificationHub,
            ApplicationDbContext context)
        {
            _reviewService = reviewService;
            _userManager = userManager;
            _notificationHub = notificationHub;
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

            var result = await _reviewService.ApproveAsync(id, admin.Id);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            await SendLatestUserNotificationAsync(id, "TaskReviewApproved");

            return Json(new { success = true, message = "Task approved. Payment details are ready." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Reject(int id, string reason)
        {
            var admin = await _userManager.GetUserAsync(User);
            if (admin == null) return Challenge();

            var result = await _reviewService.RejectAsync(id, admin.Id, reason);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            await SendLatestUserNotificationAsync(id, "TaskReviewRejected");

            return Json(new { success = true, message = "Task rejected and placed on hold." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SettlePayment(int id, bool payNow)
        {
            var admin = await _userManager.GetUserAsync(User);
            if (admin == null) return Challenge();

            var result = await _reviewService.SettlePaymentAsync(id, admin.Id, payNow);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Error });

            await SendLatestUserNotificationAsync(id, payNow ? "TaskPaymentSettled" : "TaskReviewApproved");

            return Json(new
            {
                success = true,
                paymentStatus = payNow ? "Paid" : "Pending",
                message = payNow
                    ? "Payment settled and task completed."
                    : "Task completed. Payment remains pending."
            });
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

            await _notificationHub.Clients.User(notification.UserId)
                .SendAsync("UserReviewNotificationReceived", new
                {
                    notificationId = notification.Id,
                    type = notification.Type,
                    title = notification.Title,
                    message = notification.Title,
                    createdAt = notification.CreatedAt
                });

            notification.IsDelivered = true;
            await _context.SaveChangesAsync();
        }
    }
}