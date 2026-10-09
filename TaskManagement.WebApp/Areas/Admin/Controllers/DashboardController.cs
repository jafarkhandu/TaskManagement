using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.DTOs;
using TaskManagement.Application.Interfaces;
using TaskManagement.Infrastructure.Data;

namespace TaskManagement.WebApp.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")]
    public class DashboardController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly ITaskReviewService _reviewService;

        public DashboardController(ApplicationDbContext context, ITaskReviewService reviewService)
        {
            _context = context;
            _reviewService = reviewService;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            // Summary counts
            var totalProjects = await _context.Projects.CountAsync();
            // Keep the dashboard task counters in one SQL query instead of
            // issuing a separate round-trip for every counter.
            var dashboardTaskStats = await _context.TaskItems
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    TotalTasks = g.Count(),
                    InProgressTasks = g.Count(t =>
                        EF.Functions.Like(t.Status, "%progress%") || t.Status == "In Progress"),
                    OverdueTasks = g.Count(t =>
                        t.ExpectedEndDate < DateTime.UtcNow &&
                        !EF.Functions.Like(t.Status, "%complete%") &&
                        !EF.Functions.Like(t.Status, "%done%")),
                    CreatedCount = g.Count(t =>
                        t.StartDate >= DateTime.UtcNow.AddDays(-30)),
                    CompletedCount = g.Count(t =>
                        EF.Functions.Like(t.Status, "%complete%") || t.Status == "Completed")
                })
                .FirstOrDefaultAsync();

            var totalTasks = dashboardTaskStats?.TotalTasks ?? 0;
            var inProgressTasks = dashboardTaskStats?.InProgressTasks ?? 0;
            var overdueTasks = dashboardTaskStats?.OverdueTasks ?? 0;

            // Recent projects (by StartDate desc)
            var recentProjectsEntities = await _context.Projects
                .OrderByDescending(p => p.StartDate)
                .Take(5)
                .ToListAsync();

            var recentProjects = new List<ProjectSummaryDto>();

            var projectIds = recentProjectsEntities.Select(p => p.Id).ToList();

            var taskCounts = await _context.TaskItems
                .Where(t => projectIds.Contains(t.ProjectId))
                .GroupBy(t => t.ProjectId)
                .Select(g => new { ProjectId = g.Key, Count = g.Count() })
                .ToListAsync();

            var assignedLookups = await _context.TaskItems
                .Where(t => projectIds.Contains(t.ProjectId) && !string.IsNullOrEmpty(t.AssignedToUserId))
                .Select(t => new { t.ProjectId, t.AssignedToUserId })
                .Distinct()
                .ToListAsync();

            var userIds = assignedLookups.Select(a => a.AssignedToUserId).Distinct().ToList();

            var users = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new UserLookupDto { Id = u.Id, FullName = u.FullName ?? u.UserName ?? string.Empty })
                .ToListAsync();

            foreach (var p in recentProjectsEntities)
            {
                var count = taskCounts.FirstOrDefault(x => x.ProjectId == p.Id)?.Count ?? 0;

                var assignedIdsForProject = assignedLookups.Where(a => a.ProjectId == p.Id).Select(a => a.AssignedToUserId).Distinct().ToList();

                var assignedUsers = users.Where(u => assignedIdsForProject.Contains(u.Id)).ToList();

                recentProjects.Add(new ProjectSummaryDto
                {
                    Id = p.Id,
                    ProjectTitle = p.ProjectTitle,
                    Description = p.Description,
                    Status = p.Status,
                    EndDate = p.EndDate,
                    TaskCount = count,
                    AssignedUsers = assignedUsers
                });
            }

            // Upcoming deadlines (next tasks)
            // Join the project title in the same query to avoid a second
            // database round-trip just to build the project lookup map.
            var upcomingDeadlines = await (
                from t in _context.TaskItems.AsNoTracking()
                join p in _context.Projects.AsNoTracking()
                    on t.ProjectId equals p.Id
                where t.ExpectedEndDate >= DateTime.UtcNow
                orderby t.ExpectedEndDate
                select new DeadlineDto
                {
                    TaskId = t.Id,
                    Title = t.Title,
                    ProjectTitle = p.ProjectTitle,
                    ExpectedEndDate = t.ExpectedEndDate,
                    Priority = t.Priority
                })
                .Take(5)
                .ToListAsync();

            // Task overview
            var createdCount = dashboardTaskStats?.CreatedCount ?? 0;
            var completedCount = dashboardTaskStats?.CompletedCount ?? 0;

            var taskOverview = new TaskOverviewDto
            {
                CreatedCount = createdCount,
                CompletedCount = completedCount
            };

            // Project distribution (task count per project)
            // Resolve the project title in the same grouped query instead of
            // loading a second project dictionary.
            var projectDistribution = await (
                from t in _context.TaskItems.AsNoTracking()
                join p in _context.Projects.AsNoTracking()
                    on t.ProjectId equals p.Id
                group t by new { p.Id, p.ProjectTitle } into g
                select new ProjectDistributionDto
                {
                    ProjectTitle = g.Key.ProjectTitle,
                    TaskCount = g.Count()
                })
                .ToListAsync();

            // Load the pending-payment queue once for the dashboard view.
            ViewBag.PendingPayments = await _reviewService.GetPendingPaymentsAsync();

            var model = new DashboardViewModel
            {
                TotalProjects = totalProjects,
                TotalTasks = totalTasks,
                InProgressTasks = inProgressTasks,
                OverdueTasks = overdueTasks,
                RecentProjects = recentProjects,
                UpcomingDeadlines = upcomingDeadlines,
                TaskOverview = taskOverview,
                ProjectDistribution = projectDistribution
            };

            return View(model);
        }

        [HttpGet]
        public async Task<IActionResult> Search(string term)
        {
            term = term?.Trim() ?? string.Empty;

            if (term.Length < 2)
            {
                return Json(new
                {
                    projects = Array.Empty<object>(),
                    tasks = Array.Empty<object>(),
                    users = Array.Empty<object>()
                });
            }

            var projects = await _context.Projects
                .AsNoTracking()
                .Where(p =>
                    EF.Functions.Like(p.ProjectTitle, $"%{term}%") ||
                    EF.Functions.Like(p.Description, $"%{term}%") ||
                    EF.Functions.Like(p.Status, $"%{term}%"))
                .OrderBy(p => p.ProjectTitle)
                .Take(5)
                .Select(p => new
                {
                    type = "Project",
                    title = p.ProjectTitle,
                    status = p.Status,
                    url = $"/Admin/Tasks/Project/{p.Id}"
                })
                .ToListAsync();

            var tasks = await (
                from t in _context.TaskItems.AsNoTracking()
                join p in _context.Projects.AsNoTracking()
                    on t.ProjectId equals p.Id
                where
                    EF.Functions.Like(t.Title, $"%{term}%") ||
                    EF.Functions.Like(t.Scenario, $"%{term}%") ||
                    EF.Functions.Like(t.Status, $"%{term}%") ||
                    EF.Functions.Like(t.Priority, $"%{term}%") ||
                    EF.Functions.Like(p.ProjectTitle, $"%{term}%")
                orderby t.Title
                select new
                {
                    type = "Task",
                    title = t.Title,
                    projectTitle = p.ProjectTitle,
                    url = $"/Admin/Tasks/Project/{p.Id}?taskId={t.Id}"
                })
                .Take(5)
                .ToListAsync();

            var users = await _context.Users
                .AsNoTracking()
                .Where(u =>
                    EF.Functions.Like(u.FullName ?? string.Empty, $"%{term}%") ||
                    EF.Functions.Like(u.UserName ?? string.Empty, $"%{term}%") ||
                    EF.Functions.Like(u.Email ?? string.Empty, $"%{term}%"))
                .OrderBy(u => u.FullName)
                .ThenBy(u => u.Email)
                .Take(5)
                .Select(u => new
                {
                    type = "User",
                    title = u.FullName ?? u.UserName ?? u.Email ?? "User",
                    email = u.Email,
                    url = $"/Admin/Users/Manage/{u.Id}"
                })
                .ToListAsync();

            return Json(new
            {
                projects,
                tasks,
                users
            });
        }

        [HttpGet]
        public async Task<IActionResult> AllProjects()
        {
            var projects = await _context.Projects
                .AsNoTracking()
                .OrderByDescending(p => p.StartDate)
                .Select(p => new
                {
                    p.Id,
                    p.ProjectTitle,
                    p.Description,
                    TaskCount = _context.TaskItems.Count(t => t.ProjectId == p.Id)
                })
                .ToListAsync();

            return Json(projects.Select(p => new
            {
                p.Id,
                p.ProjectTitle,
                p.Description,
                p.TaskCount,
                Url = Url.Action("Project", "Tasks", new { area = "Admin", id = p.Id })
            }));
        }
    }
}
