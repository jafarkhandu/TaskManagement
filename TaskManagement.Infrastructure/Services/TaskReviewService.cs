using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.DTOs;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;

namespace TaskManagement.Infrastructure.Services
{
    public class TaskReviewService : ITaskReviewService
    {
        private readonly ApplicationDbContext _db;
        private readonly UserManager<ApplicationUser> _userManager;

        public TaskReviewService(ApplicationDbContext db, UserManager<ApplicationUser> userManager)
        {
            _db = db;
            _userManager = userManager;
        }

        private IQueryable<TaskReviewDto> ReviewQuery()
        {
            return from r in _db.TaskReviews.AsNoTracking()
                   join t in _db.TaskItems.AsNoTracking() on r.TaskId equals t.Id
                   join a in _db.TaskAssignments.AsNoTracking() on r.TaskAssignmentId equals a.Id
                   join p in _db.Projects.AsNoTracking() on t.ProjectId equals p.Id
                   join u in _db.Users.AsNoTracking() on r.SubmittedByUserId equals u.Id
                   join pay in _db.TaskPayments.AsNoTracking() on r.TaskAssignmentId equals pay.TaskAssignmentId into payments
                   from pay in payments.OrderByDescending(x => x.Id).Take(1).DefaultIfEmpty()
                   select new TaskReviewDto
                   {
                       ReviewId = r.Id,
                       TaskId = t.Id,
                       TaskAssignmentId = a.Id,
                       TaskTitle = t.Title,
                       Scenario = t.Scenario,
                       Priority = t.Priority,
                       Amount = t.Amount,
                       UserId = u.Id,
                       UserName = u.FullName ?? u.Email ?? u.UserName ?? "User",
                       ProjectTitle = p.Title,
                       RepositoryUrl = a.CompletionRepositoryUrl,
                       ReviewStatus = r.Status,
                       RejectionReason = r.RejectionReason,
                       PaymentStatus = pay == null ? null : pay.Status,
                       SubmittedAt = r.SubmittedAt
                   };

        public Task<List<TaskReviewDto>> GetPendingReviewsAsync() =>
            ReviewQuery().Where(x => x.ReviewStatus == "Pending").OrderBy(x => x.SubmittedAt).ToListAsync();

        public Task<TaskReviewDto?> GetReviewAsync(int reviewId) =>
            ReviewQuery().FirstOrDefaultAsync(x => x.ReviewId == reviewId);

        public Task<List<TaskReviewDto>> GetPendingPaymentsAsync() =>
            ReviewQuery().Where(x => x.ReviewStatus == "Approved" && x.PaymentStatus == "Pending")
                .OrderBy(x => x.SubmittedAt).ToListAsync();

        public async Task<(bool Success, string Error, int ReviewId)> SubmitForReviewAsync(int taskId, string userId, string repositoryUrl)
        {
            return (false, "Use the task service submission endpoint.", 0);
        }

        public async Task<(bool Success, string Error)> ApproveAsync(int reviewId, string adminId)
        {
            var review = await _db.TaskReviews.FirstOrDefaultAsync(x => x.Id == reviewId && x.Status == "Pending");
            if (review == null) return (false, "Review request is no longer pending.");

            var task = await _db.TaskItems.FirstOrDefaultAsync(x => x.Id == review.TaskId);
            var assignment = await _db.TaskAssignments.FirstOrDefaultAsync(x => x.Id == review.TaskAssignmentId);
            if (task == null || assignment == null) return (false, "Task assignment not found.");

            var existingPayment = await _db.TaskPayments.FirstOrDefaultAsync(x => x.TaskAssignmentId == assignment.Id);
            if (existingPayment == null)
            {
                _db.TaskPayments.Add(new TaskPayment
                {
                    TaskAssignmentId = assignment.Id,
                    TaskId = task.Id,
                    UserId = assignment.UserId,
                    Amount = task.Amount,
                    Status = "Pending",
                    ApprovedAt = DateTime.UtcNow
                });
            }
            else
            {
                existingPayment.Status = "Pending";
                existingPayment.Amount = task.Amount;
                existingPayment.ApprovedAt = DateTime.UtcNow;
            }

            review.Status = "Approved";
            review.ReviewedByAdminId = adminId;
            review.ReviewedAt = DateTime.UtcNow;
            task.Status = "Completed";

            var admin = await _userManager.FindByIdAsync(adminId);
            await _db.SaveChangesAsync();

            return (true, string.Empty);
        }

        public async Task<(bool Success, string Error)> RejectAsync(int reviewId, string adminId, string reason)
        {
            if (string.IsNullOrWhiteSpace(reason))
                return (false, "A rejection reason is required.");

            var review = await _db.TaskReviews.FirstOrDefaultAsync(x => x.Id == reviewId && x.Status == "Pending");
            if (review == null) return (false, "Review request is no longer pending.");

            var task = await _db.TaskItems.FirstOrDefaultAsync(x => x.Id == review.TaskId);
            if (task == null) return (false, "Task not found.");

            review.Status = "Rejected";
            review.ReviewedByAdminId = adminId;
            review.ReviewedAt = DateTime.UtcNow;
            review.RejectionReason = reason.Trim();
            task.Status = "On Hold";

            var assignment = await _db.TaskAssignments.FirstOrDefaultAsync(x => x.Id == review.TaskAssignmentId);
            if (assignment != null)
            {
                _db.Notifications.Add(new Notification
                {
                    UserId = assignment.UserId,
                    TaskAssignmentId = assignment.Id,
                    Type = "TaskReviewRejected",
                    Title = $"Task Review Rejected: {task.Title}",
                    IsRead = false,
                    IsDelivered = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _db.SaveChangesAsync();
            return (true, string.Empty);
        }

        public async Task<(bool Success, string Error)> SettlePaymentAsync(int reviewId, string adminId, bool payNow)
        {
            var review = await _db.TaskReviews.FirstOrDefaultAsync(x => x.Id == reviewId && x.Status == "Approved");
            if (review == null) return (false, "Approved review not found.");

            var payment = await _db.TaskPayments.FirstOrDefaultAsync(x => x.TaskAssignmentId == review.TaskAssignmentId);
            if (payment == null) return (false, "Payment record not found.");

            var task = await _db.TaskItems.FirstOrDefaultAsync(x => x.Id == review.TaskId);
            var assignment = await _db.TaskAssignments.FirstOrDefaultAsync(x => x.Id == review.TaskAssignmentId);
            if (task == null || assignment == null) return (false, "Task assignment not found.");

            payment.Status = payNow ? "Paid" : "Pending";
            payment.PaidAt = payNow ? DateTime.UtcNow : null;
            payment.SettledByAdminId = payNow ? adminId : null;
            task.Status = "Completed";

            _db.Notifications.Add(new Notification
            {
                UserId = assignment.UserId,
                TaskAssignmentId = assignment.Id,
                Type = payNow ? "TaskPaymentSettled" : "TaskReviewApproved",
                Title = payNow
                    ? $"Task Approved & Payment Settled: {task.Title}"
                    : $"Task Reviewed: {task.Title}",
                IsRead = false,
                IsDelivered = false,
                CreatedAt = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();
            return (true, string.Empty);
        }
    }
}