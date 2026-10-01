using TaskManagement.Application.DTOs;

namespace TaskManagement.Application.Interfaces
{
    public interface ITaskReviewService
    {
        Task<List<TaskReviewDto>> GetPendingReviewsAsync();
        Task<TaskReviewDto?> GetReviewAsync(int reviewId);
        Task<(bool Success, string Error)> ApproveAsync(int reviewId, string adminId);
        Task<(bool Success, string Error)> RejectAsync(int reviewId, string adminId, string reason);
        Task<(bool Success, string Error)> SettlePaymentAsync(int reviewId, string adminId, bool payNow);
        Task<List<TaskReviewDto>> GetPendingPaymentsAsync();
    }
}