using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.DTOs;
using TaskManagement.Infrastructure.Data;

namespace TaskManagement.WebApp.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")]
    public class ReportsController : Controller
    {
        private readonly ApplicationDbContext _context;

        public ReportsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Index(string? range)
        {
            var selectedRange = NormalizeRange(range);
            var now = DateTime.UtcNow;
            DateTime? from = selectedRange switch
            {
                "7" => now.Date.AddDays(-6),
                "30" => now.Date.AddDays(-29),
                "month" => new DateTime(now.Year, now.Month, 1),
                _ => null
            };

            var tasksQuery = _context.TaskItems.AsNoTracking();

            if (from.HasValue)
                tasksQuery = tasksQuery.Where(t => t.StartDate >= from.Value && t.StartDate <= now);

            var tasks = await tasksQuery
                .Select(t => new
                {
                    t.Id,
                    t.ProjectId,
                    t.AssignedToUserId,
                    t.Status,
                    t.ExpectedEndDate
                })
                .ToListAsync();

            var projectIds = tasks.Select(t => t.ProjectId).Distinct().ToList();

            var projects = await _context.Projects
                .AsNoTracking()
                .Where(p => projectIds.Contains(p.Id))
                .Select(p => new { p.Id, p.ProjectTitle })
                .ToListAsync();

            var projectMap = projects.ToDictionary(p => p.Id, p => p.ProjectTitle);

            var userIds = tasks
                .Where(t => !string.IsNullOrWhiteSpace(t.AssignedToUserId))
                .Select(t => t.AssignedToUserId!)
                .Distinct()
                .ToList();

            var users = await _context.Users
                .AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new
                {
                    u.Id,
                    Name = u.FullName ?? u.UserName ?? "User"
                })
                .ToListAsync();

            var userMap = users.ToDictionary(u => u.Id, u => u.Name);

            bool IsStatus(object task, string status)
                => string.Equals(Convert.ToString(task), status, StringComparison.OrdinalIgnoreCase);

            var completed = tasks.Count(t => IsStatus(t.Status, "Completed"));
            var inProgress = tasks.Count(t => IsStatus(t.Status, "In Progress"));
            var pending = tasks.Count(t => IsStatus(t.Status, "Pending"));
            var onHold = tasks.Count(t => IsStatus(t.Status, "On Hold"));
            var cancelled = tasks.Count(t => IsStatus(t.Status, "Cancelled"));

            var overdue = tasks.Count(t =>
                t.ExpectedEndDate < now &&
                !IsStatus(t.Status, "Completed") &&
                !IsStatus(t.Status, "Cancelled"));

            var total = tasks.Count;

            var statusRows = new List<AdminReportStatusRow>
            {
                new() { Status = "Pending", Count = pending },
                new() { Status = "In Progress", Count = inProgress },
                new() { Status = "Completed", Count = completed },
                new() { Status = "On Hold", Count = onHold },
                new() { Status = "Cancelled", Count = cancelled }
            };

            foreach (var row in statusRows)
                row.Percent = total == 0 ? 0 : Math.Round(row.Count * 100.0 / total, 1);

            var projectRows = tasks
                .GroupBy(t => t.ProjectId)
                .Select(g => new AdminReportProjectRow
                {
                    ProjectId = g.Key,
                    ProjectTitle = projectMap.TryGetValue(g.Key, out var title) ? title : $"Project #{g.Key}",
                    TaskCount = g.Count(),
                    Completed = g.Count(t => IsStatus(t.Status, "Completed")),
                    InProgress = g.Count(t => IsStatus(t.Status, "In Progress")),
                    Overdue = g.Count(t =>
                        t.ExpectedEndDate < now &&
                        !IsStatus(t.Status, "Completed") &&
                        !IsStatus(t.Status, "Cancelled"))
                })
                .OrderByDescending(x => x.TaskCount)
                .ThenBy(x => x.ProjectTitle)
                .ToList();

            var studentRows = tasks
                .Where(t => !string.IsNullOrWhiteSpace(t.AssignedToUserId))
                .GroupBy(t => t.AssignedToUserId!)
                .Select(g => new AdminReportStudentRow
                {
                    UserId = g.Key,
                    StudentName = userMap.TryGetValue(g.Key, out var name) ? name : "Unknown User",
                    Assigned = g.Count(),
                    Completed = g.Count(t => IsStatus(t.Status, "Completed")),
                    Pending = g.Count(t =>
                        IsStatus(t.Status, "Pending") ||
                        IsStatus(t.Status, "In Progress") ||
                        IsStatus(t.Status, "On Hold"))
                })
                .OrderByDescending(x => x.Assigned)
                .ThenBy(x => x.StudentName)
                .ToList();

            var model = new AdminReportsViewModel
            {
                Range = selectedRange,
                FromDate = from,
                ToDate = now,
                TotalProjects = projectRows.Count,
                TotalTasks = total,
                CompletedTasks = completed,
                OverdueTasks = overdue,
                PendingTasks = pending,
                InProgressTasks = inProgress,
                OnHoldTasks = onHold,
                CancelledTasks = cancelled,
                StatusRows = statusRows,
                ProjectRows = projectRows,
                StudentRows = studentRows
            };

            return View(model);
        }

        private static string NormalizeRange(string? range)
        {
            return range?.Trim().ToLowerInvariant() switch
            {
                "7" => "7",
                "30" => "30",
                "month" => "month",
                _ => "all"
            };
        }
    }
}
