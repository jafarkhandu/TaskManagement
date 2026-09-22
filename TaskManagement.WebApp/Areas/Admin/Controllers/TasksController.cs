using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs;
using TaskManagement.Application.Interfaces;
using TaskManagement.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using TaskManagement.WebApp.Hubs;

namespace TaskManagement.WebApp.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")]
    public class TasksController : Controller
    {
        private readonly ITaskService _taskService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IHubContext<NotificationHub> _notificationHub;

        public TasksController(
            ITaskService taskService,
            UserManager<ApplicationUser> userManager,
            IHubContext<NotificationHub> notificationHub)
        {
            _taskService = taskService;
            _userManager = userManager;
            _notificationHub = notificationHub;
        }

        // GET: /Admin/Tasks/Project/{id}
        [HttpGet]
        public async Task<IActionResult> Project(int id)
        {
            // Verify project exists by attempting to get tasks (service will validate existence in Create but here we check quickly)
            var tasks = await _taskService.GetTasksByProjectIdAsync(id);

            // If project does not exist the service may return null. If tasks is null, treat as NotFound.
            if (tasks == null)
            {
                return NotFound();
            }

            ViewBag.ProjectId = id;
            return View("ProjectTasks", tasks);
        }

        [HttpGet]
        public async Task<IActionResult> Get(int id)
        {
            var task = await _taskService.GetByIdAsync(id);
            if (task == null) return NotFound();
            return Json(task);
        }

        [HttpGet]
        public async Task<IActionResult> Details(int id)
        {
            var task = await _taskService.GetDetailsAsync(id);
            if (task == null) return Json(new { success = false, message = "Task not found." });
            return Json(new { success = true, data = task });
        }

        [HttpGet]
        public async Task<IActionResult> Users()
        {
            var users = await _taskService.GetAssignableUsersAsync();

            return Json(new
            {
                success = true,
                users
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(TaskDto model)
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState.Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage);

                return BadRequest(new
                {
                    success = false,
                    message = string.Join(" | ", errors)
                });
            }

            // AssignedToUserId is posted from the form and will be validated by the service.

            var result = await _taskService.CreateAsync(model);

            if (!result.Success)
            {
                return Json(new
                {
                    success = false,
                    message = result.Error
                });
            }

            // Notify the assigned user via SignalR about the persisted notification.
            // The TaskService returns the created NotificationId as part of the result.
            var notificationId = result.NotificationId;

            await _notificationHub.Clients
                .User(model.AssignedToUserId)
                .SendAsync(
                    "TaskAssignmentReceived",
                    new
                    {
                        notificationId = notificationId,
                        title = model.Title,
                        scenario = model.Scenario,
                        priority = model.Priority,
                        startDate = model.StartDate,
                        expectedEndDate = model.ExpectedEndDate,
                        amount = model.Amount
                    });

            return Json(new
            {
                success = true,
                message = "Task created successfully."
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Update(TaskDto model)
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage);
                return BadRequest(new { success = false, message = string.Join(" | ", errors) });
            }

            var result = await _taskService.UpdateAsync(model);
            if (!result.Success) return Json(new { success = false, message = result.Error });
            return Json(new { success = true, message = "Task updated successfully." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id, int projectId)
        {
            // Ensure the task belongs to the project (service checks ownership in Update/Delete)
            var task = await _taskService.GetByIdAsync(id);
            if (task == null) return Json(new { success = false, message = "Task not found." });
            if (task.ProjectId != projectId) return Json(new { success = false, message = "Cross-project operation is not allowed." });

            var result = await _taskService.DeleteAsync(id);
            if (!result.Success) return Json(new { success = false, message = result.Error });
            return Json(new { success = true, message = "Task deleted successfully." });
        }

        

        
    }
}
