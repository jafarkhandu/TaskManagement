using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.DTOs;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;

namespace TaskManagement.WebApp.Areas.User.Controllers
{
    [Area("User")]
    [Authorize(Roles = "User")]
    public class DashboardController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public DashboardController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();

            var userId = user.Id;

            var now = DateTime.UtcNow;
            var nextSevenDays = now.AddDays(7);

            var tasks = await _context.TaskItems
                .AsNoTracking()
                .Where(x => x.AssignedToUserId == userId)
                .OrderBy(x => x.ExpectedEndDate)
                .ToListAsync();

            var projectIds = tasks
                .Select(x => x.ProjectId)
                .Distinct()
                .ToList();

            var projects = await _context.Projects
                .AsNoTracking()
                .Where(x => projectIds.Contains(x.Id))
                .ToListAsync();

            var projectMap = projects.ToDictionary(
                x => x.Id,
                x => x.ProjectTitle
            );

            var projectSummaries = projects
                .Select(project =>
                {
                    var projectTasks = tasks
                        .Where(x => x.ProjectId == project.Id)
                        .ToList();

                    var total = projectTasks.Count;

                    var completed = projectTasks.Count(
                        x => x.Status == "Completed"
                    );

                    var progress = total == 0
                        ? 0
                        : (int)Math.Round(
                            completed * 100.0 / total
                        );

                    return new UserProjectSummaryDto
                    {
                        Id = project.Id,
                        ProjectTitle = project.ProjectTitle,
                        Description = project.Description,
                        Status = project.Status,
                        TotalTasks = total,
                        CompletedTasks = completed,
                        ProgressPercent = progress
                    };
                })
                .OrderByDescending(x => x.TotalTasks)
                .Take(6)
                .ToList();

            var focusTasks = tasks
                .Where(x => x.Status != "Completed")
                .OrderBy(x => x.ExpectedEndDate)
                .Take(6)
                .Select(x => new UserTaskSummaryDto
                {
                    Id = x.Id,
                    Title = x.Title,
                    Scenario = x.Scenario,
                    Status = x.Status,
                    Priority = x.Priority,
                    ExpectedEndDate = x.ExpectedEndDate,
                    Amount = x.Amount,
                    ProjectTitle = projectMap.ContainsKey(x.ProjectId)
                        ? projectMap[x.ProjectId]
                        : string.Empty
                })
                .ToList();

            var recentTasks = tasks
                .OrderByDescending(x => x.Id)
                .Take(6)
                .Select(x => new UserTaskSummaryDto
                {
                    Id = x.Id,
                    Title = x.Title,
                    Scenario = x.Scenario,
                    Status = x.Status,
                    Priority = x.Priority,
                    ExpectedEndDate = x.ExpectedEndDate,
                    Amount = x.Amount,
                    ProjectTitle = projectMap.ContainsKey(x.ProjectId)
                        ? projectMap[x.ProjectId]
                        : string.Empty
                })
                .ToList();

            var model = new UserDashboardViewModel
            {
                UserName = user.FullName ?? user.UserName ?? "User",
                UserEmail = user.Email ?? string.Empty,

                TotalTasks = tasks.Count,

                PendingTasks = tasks.Count(
                    x => x.Status == "Pending"
                ),

                InProgressTasks = tasks.Count(
                    x => x.Status == "In Progress"
                ),

                CompletedTasks = tasks.Count(
                    x => x.Status == "Completed"
                ),

                OnHoldTasks = tasks.Count(
                    x => x.Status == "On Hold"
                ),

                DueSoonTasks = tasks.Count(
                    x =>
                        x.Status != "Completed" &&
                        x.ExpectedEndDate >= now &&
                        x.ExpectedEndDate <= nextSevenDays
                ),

                ActiveProjects = projectSummaries.Count(
                    x => x.Status != "Completed"
                ),

                FocusTasks = focusTasks,
                RecentTasks = recentTasks,
                Projects = projectSummaries
            };

            return View(model);
        }
    }
}