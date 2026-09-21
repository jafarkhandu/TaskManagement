using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.DTOs;
using TaskManagement.Infrastructure.Data;

namespace TaskManagement.WebApp.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")]
    public class DashboardController : Controller
    {
        private readonly ApplicationDbContext _context;

        public DashboardController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            // Summary counts
            var totalProjects = await _context.Projects.CountAsync();
            var totalTasks = await _context.TaskItems.CountAsync();

            var inProgressTasks = await _context.TaskItems
                .CountAsync(t => EF.Functions.Like(t.Status, "%progress%") || t.Status == "In Progress");

            var overdueTasks = await _context.TaskItems
                .CountAsync(t => t.ExpectedEndDate < DateTime.UtcNow &&
                    !EF.Functions.Like(t.Status, "%complete%") && !EF.Functions.Like(t.Status, "%done%"));

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
                .Select(u => new UserLookupDto { Id = u.Id, FullName = u.FullName ?? u.UserName })
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
            var upcomingTasks = await _context.TaskItems
                .Where(t => t.ExpectedEndDate >= DateTime.UtcNow)
                .OrderBy(t => t.ExpectedEndDate)
                .Take(5)
                .ToListAsync();

            var projectMap = await _context.Projects
                .Where(p => upcomingTasks.Select(t => t.ProjectId).Contains(p.Id) || projectIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.ProjectTitle);

            var upcomingDeadlines = upcomingTasks.Select(t => new DeadlineDto
            {
                TaskId = t.Id,
                Title = t.Title,
                ProjectTitle = projectMap.ContainsKey(t.ProjectId) ? projectMap[t.ProjectId] : string.Empty,
                ExpectedEndDate = t.ExpectedEndDate,
                Priority = t.Priority
            }).ToList();

            // Task overview
            var createdCount = await _context.TaskItems.CountAsync(t => t.StartDate >= DateTime.UtcNow.AddDays(-30));
            var completedCount = await _context.TaskItems.CountAsync(t => EF.Functions.Like(t.Status, "%complete%") || t.Status == "Completed");

            var taskOverview = new TaskOverviewDto
            {
                CreatedCount = createdCount,
                CompletedCount = completedCount
            };

            // Project distribution (task count per project)
            var distribution = await _context.TaskItems
                .GroupBy(t => t.ProjectId)
                .Select(g => new { ProjectId = g.Key, Count = g.Count() })
                .ToListAsync();

            var projectTitles = await _context.Projects
                .Where(p => distribution.Select(d => d.ProjectId).Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.ProjectTitle);

            var projectDistribution = distribution.Select(d => new ProjectDistributionDto
            {
                ProjectTitle = projectTitles.ContainsKey(d.ProjectId) ? projectTitles[d.ProjectId] : "",
                TaskCount = d.Count
            }).ToList();

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
    }
}
