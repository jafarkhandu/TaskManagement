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

        private static TimeZoneInfo GetApplicationLocalTimeZone()
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
            }
            catch (TimeZoneNotFoundException)
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
            }
        }

        private static DateTime GetDeadlineBoundaryUtc(DateTime expectedEndDate)
        {
            var localDeadlineBoundary = expectedEndDate.Date.AddDays(1);

            return TimeZoneInfo.ConvertTimeToUtc(
                DateTime.SpecifyKind(
                    localDeadlineBoundary,
                    DateTimeKind.Unspecified),
                GetApplicationLocalTimeZone());
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
                       ProjectTitle = p.ProjectTitle,
                       RepositoryUrl = a.CompletionRepositoryUrl,
                       ReviewStatus = r.Status,
                       RejectionReason = r.RejectionReason,
                       PaymentStatus = pay == null ? null : pay.Status,
                       SubmittedAt = r.SubmittedAt,
                       DeadlineAtSubmission = r.DeadlineAtSubmission,
                       IsLate = r.DeadlineAtSubmission.HasValue &&
                                r.SubmittedAt > r.DeadlineAtSubmission.Value,
                       // Payment details are loaded only for the single-review details view.
                       // Review lists do not consume these fields.
                   };
        }

        public Task<List<TaskReviewDto>> GetPendingReviewsAsync() =>
            ReviewQuery().Where(x => x.ReviewStatus == "Pending").OrderBy(x => x.SubmittedAt).ToListAsync();

        public async Task<TaskReviewDto?> GetReviewAsync(int reviewId)
        {
            var review = await ReviewQuery()
                .FirstOrDefaultAsync(x => x.ReviewId == reviewId);

            if (review == null)
                return null;

            var paymentDetails = await _db.UserPaymentDetails
                .AsNoTracking()
                .Where(x => x.UserId == review.UserId)
                .Select(x => new
                {
                    x.PaymentMethod,
                    x.UpiId,
                    x.AccountHolderName,
                    x.BankName,
                    x.AccountNumber,
                    x.IfscCode
                })
                .FirstOrDefaultAsync();

            if (paymentDetails != null)
            {
                review.PaymentMethod = paymentDetails.PaymentMethod;
                review.UpiId = paymentDetails.UpiId;
                review.AccountHolderName = paymentDetails.AccountHolderName;
                review.BankName = paymentDetails.BankName;
                review.AccountNumber = paymentDetails.AccountNumber;
                review.IfscCode = paymentDetails.IfscCode;
            }

            return review;
        }

        public Task<List<TaskReviewDto>> GetPendingPaymentsAsync() =>
            ReviewQuery().Where(x => x.ReviewStatus == "Approved" && x.PaymentStatus == "Pending")
                .OrderBy(x => x.SubmittedAt).ToListAsync();

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
            // Approval is a distinct user-facing event. Payment settlement is reported separately.
            task.Status = "Review Pending";

            _db.Notifications.Add(new Notification
            {
                UserId = assignment.UserId,
                TaskAssignmentId = assignment.Id,
                Type = "TaskReviewApproved",
                Title = $"Task Review Approved: {task.Title}",
                IsRead = false,
                IsDelivered = false,
                CreatedAt = DateTime.UtcNow
            });

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

            // A rejected review means the task was not completed. Clear the
            // prior submission time so a later resubmission becomes authoritative.
            task.CompletedAtUtc = null;
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
            // Payment decision is the final approval action. A pending review
            // becomes Approved only when Pay Now or Later is explicitly selected.
            var review = await _db.TaskReviews.FirstOrDefaultAsync(x =>
                x.Id == reviewId &&
                (x.Status == "Pending" || x.Status == "Approved"));

            if (review == null)
                return (false, "Review request is no longer available.");

            var payment = await _db.TaskPayments
                .FirstOrDefaultAsync(x => x.TaskAssignmentId == review.TaskAssignmentId);

            var task = await _db.TaskItems.FirstOrDefaultAsync(x => x.Id == review.TaskId);
            var assignment = await _db.TaskAssignments.FirstOrDefaultAsync(x => x.Id == review.TaskAssignmentId);
            if (task == null || assignment == null) return (false, "Task assignment not found.");

            // Deadline eligibility is based on the timestamp captured at
            // submission, not on the task's current editable end date.
            var deadlineBoundaryUtc = review.DeadlineAtSubmission
                ?? GetDeadlineBoundaryUtc(task.ExpectedEndDate);

            var isLate = review.SubmittedAt > deadlineBoundaryUtc;
            var payableAmount = isLate ? 0m : task.Amount;

            // A late task has no payable amount, so payment details are not
            // required and Pay Now/Pay Later both finalize it as withheld.
            if (payNow && !isLate)
            {
                var paymentDetails = await _db.UserPaymentDetails
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.UserId == assignment.UserId);

                if (paymentDetails == null)
                    return (false, "The user has not submitted payment details yet.");
            }

            if (payment == null)
            {
                payment = new TaskPayment
                {
                    TaskAssignmentId = assignment.Id,
                    TaskId = task.Id,
                    UserId = assignment.UserId,
                    Amount = payableAmount,
                    Status = isLate
                        ? "Withheld"
                        : (payNow ? "Paid" : "Pending"),
                    ApprovedAt = DateTime.UtcNow
                };

                _db.TaskPayments.Add(payment);
            }
            else
            {
                payment.Amount = payableAmount;
                payment.ApprovedAt ??= DateTime.UtcNow;
            }

            payment.Status = isLate
                ? "Withheld"
                : (payNow ? "Paid" : "Pending");
            payment.PaidAt = !isLate && payNow ? DateTime.UtcNow : null;
            payment.SettledByAdminId = isLate || payNow
                ? adminId
                : null;

            review.Status = "Approved";
            review.ReviewedByAdminId = adminId;
            review.ReviewedAt = DateTime.UtcNow;

            // The task is considered finished after the admin makes the
            // explicit payment decision. Pay Later means payment is pending,
            // not that the review action was cancelled.
            task.CompletedAtUtc ??= DateTime.UtcNow;
            task.Status = "Completed";

            // A completed task must not retain an active chat session.
            // Remove every session for this task, not only the currently selected one.
            var taskChats = await _db.ChatSessions
                .Where(x => x.TaskId == task.Id)
                .ToListAsync();

            if (taskChats.Count > 0)
                _db.ChatSessions.RemoveRange(taskChats);

            var notificationType = isLate
                ? "TaskPaymentWithheld"
                : payNow
                    ? "TaskPaymentSettled"
                    : "TaskReviewApproved";

            var notificationTitle = isLate
                ? $"Payment Withheld: {task.Title}"
                : payNow
                    ? $"Payment Settled: {task.Title}"
                    : $"Task Approved: {task.Title}";

            _db.Notifications.Add(new Notification
            {
                UserId = assignment.UserId,
                TaskAssignmentId = assignment.Id,
                Type = notificationType,
                Title = notificationTitle,
                IsRead = false,
                IsDelivered = false,
                CreatedAt = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();
            return (true, string.Empty);
        }
    }
}