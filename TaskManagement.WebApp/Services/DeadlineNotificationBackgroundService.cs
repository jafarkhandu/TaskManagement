using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Data;
using TaskManagement.WebApp.Hubs;

namespace TaskManagement.WebApp.Services
{
    /// <summary>
    /// Creates one deadline notification on the calendar day before a task's
    /// end date and one on the end-date calendar day.
    /// </summary>
    public sealed class DeadlineNotificationBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<DeadlineNotificationBackgroundService> _logger;

        public DeadlineNotificationBackgroundService(
            IServiceScopeFactory scopeFactory,
            ILogger<DeadlineNotificationBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                await ProcessDeadlineNotificationsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Initial deadline notification processing failed.");
            }

            using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));

            try
            {
                while (await timer.WaitForNextTickAsync(stoppingToken))
                {
                    try
                    {
                        await ProcessDeadlineNotificationsAsync(stoppingToken);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Deadline notification processing failed.");
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Normal application shutdown.
            }
        }

        private async Task ProcessDeadlineNotificationsAsync(CancellationToken cancellationToken)
        {
            using var scope = _scopeFactory.CreateScope();

            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var notificationHub = scope.ServiceProvider.GetRequiredService<IHubContext<NotificationHub>>();

            var now = GetApplicationLocalNow();
            var today = now.Date;
            var tomorrow = today.AddDays(1);

            var tasks = await context.TaskItems
                .AsNoTracking()
                .Where(t =>
                    t.Status != "Completed" &&
                    t.AssignedToUserId != null &&
                    t.ExpectedEndDate >= today &&
                    t.ExpectedEndDate < tomorrow.AddDays(1))
                .Select(t => new
                {
                    TaskId = t.Id,
                    TaskTitle = t.Title,
                    TaskEndDate = t.ExpectedEndDate,
                    AssignedToUserId = t.AssignedToUserId!
                })
                .ToListAsync(cancellationToken);

            if (tasks.Count == 0)
                return;

            var taskIds = tasks.Select(x => x.TaskId).ToList();

            var assignments = await context.TaskAssignments
                .AsNoTracking()
                .Where(a => taskIds.Contains(a.TaskId))
                .OrderByDescending(a => a.Id)
                .ToListAsync(cancellationToken);

            var latestAssignmentByTask = assignments
                .GroupBy(a => a.TaskId)
                .ToDictionary(g => g.Key, g => g.First());

            var candidateTasks = tasks
                .Where(task =>
                    latestAssignmentByTask.TryGetValue(task.TaskId, out var assignment) &&
                    string.Equals(assignment.UserId, task.AssignedToUserId, StringComparison.Ordinal) &&
                    string.Equals(assignment.Status, "Accepted", StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (candidateTasks.Count == 0)
                return;

            var assignmentIds = candidateTasks
                .Select(x => latestAssignmentByTask[x.TaskId].Id)
                .ToList();

            var existingNotifications = await context.Notifications
                .AsNoTracking()
                .Where(n =>
                    assignmentIds.Contains(n.TaskAssignmentId) &&
                    (n.Type == "TaskDeadlineTomorrow" || n.Type == "TaskDeadlineToday"))
                .Select(n => new
                {
                    n.TaskAssignmentId,
                    n.Type
                })
                .ToListAsync(cancellationToken);

            var created = new List<(TaskManagement.Domain.Entities.Notification Notification, string TaskTitle, int TaskId)>();

            foreach (var task in candidateTasks)
            {
                var assignment = latestAssignmentByTask[task.TaskId];

                string? notificationType = null;
                string? title = null;
                if (task.TaskEndDate.Date == today.AddDays(1))
                {
                    notificationType = "TaskDeadlineTomorrow";
                    title = $"Deadline Tomorrow: {task.TaskTitle}";
                }
                else if (task.TaskEndDate.Date == today)
                {
                    notificationType = "TaskDeadlineToday";
                    title = $"Deadline Today: {task.TaskTitle}";
                }

                if (notificationType == null)
                    continue;

                var alreadyCreated = existingNotifications.Any(x =>
                    x.TaskAssignmentId == assignment.Id &&
                    x.Type == notificationType);

                if (alreadyCreated)
                    continue;

                var notification = new TaskManagement.Domain.Entities.Notification
                {
                    UserId = assignment.UserId,
                    TaskAssignmentId = assignment.Id,
                    Type = notificationType,
                    Title = title!,
                    IsRead = false,
                    IsDelivered = false,
                    CreatedAt = DateTime.UtcNow
                };

                context.Notifications.Add(notification);
                existingNotifications.Add(new
                {
                    TaskAssignmentId = assignment.Id,
                    Type = notificationType
                });

                created.Add((
                    notification,
                    task.TaskTitle,
                    task.TaskId));
            }

            if (created.Count == 0)
                return;

            await context.SaveChangesAsync(cancellationToken);

            foreach (var createdNotification in created)
            {
                var notification = createdNotification.Notification;

                if (!NotificationHub.IsUserOnline(notification.UserId))
                    continue;

                await notificationHub.Clients
                    .User(notification.UserId)
                    .SendAsync(
                        "UserDeadlineNotificationReceived",
                        new
                        {
                            notificationId = notification.Id,
                            type = notification.Type,
                            title = notification.Title,
                            message = notification.Type == "TaskDeadlineTomorrow"
                                ? $"{createdNotification.TaskTitle} is due tomorrow. ⚠ Complete and submit it by the deadline; no payment will be made after the deadline."
                                : $"{createdNotification.TaskTitle} is due today. ⚠ Complete and submit it by the deadline; no payment will be made after the deadline.",
                            taskId = createdNotification.TaskId,
                            createdAt = notification.CreatedAt
                        },
                        cancellationToken);
            }
        }

        private static DateTime GetApplicationLocalNow()
        {
            TimeZoneInfo timezone;

            try
            {
                timezone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
            }
            catch (TimeZoneNotFoundException)
            {
                timezone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
            }

            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timezone);
        }
    }
}
