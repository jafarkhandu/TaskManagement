using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Data;

namespace TaskManagement.WebApp.Hubs
{
    // Allow any authenticated user to connect to the notification hub.
    // Group-level filtering is used to target messages (e.g., project groups or admin group).
    [Authorize]
    public class NotificationHub : Hub
    {

        private readonly ApplicationDbContext _context;

        public NotificationHub(ApplicationDbContext context)
        {
            _context = context;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.UserIdentifier;

            if (!string.IsNullOrWhiteSpace(userId))
            {
                var missed = await _context.Notifications
                    .Where(n =>
                        n.UserId == userId &&
                        !n.IsDelivered &&
                        !n.IsRead &&
                        n.Type == "TaskAssignment")
                    .Join(
                        _context.TaskAssignments,
                        n => n.TaskAssignmentId,
                        a => a.Id,
                        (n, a) => new { Notification = n, Assignment = a })
                    .Join(
                        _context.TaskItems,
                        x => x.Assignment.TaskId,
                        t => t.Id,
                        (x, t) => new
                        {
                            notificationId = x.Notification.Id,
                            title = t.Title,
                            scenario = t.Scenario,
                            priority = t.Priority,
                            startDate = t.StartDate,
                            expectedEndDate = t.ExpectedEndDate,
                            amount = t.Amount
                        })
                    .ToListAsync();

                if (missed.Count > 0)
                {
                    await Clients.Caller.SendAsync(
                        "MissedNotificationsReceived",
                        missed);

                    var ids = missed
                        .Select(x => x.notificationId)
                        .ToList();

                    var notifications = await _context.Notifications
                        .Where(n => ids.Contains(n.Id))
                        .ToListAsync();

                    foreach (var notification in notifications)
                    {
                        notification.IsDelivered = true;
                    }

                    await _context.SaveChangesAsync();
                }
            }

            await base.OnConnectedAsync();
        }

        public async Task AcknowledgeNotification(int notificationId)
        {
            var userId = Context.UserIdentifier;

            if (string.IsNullOrWhiteSpace(userId))
                return;

            var notification = await _context.Notifications
                .FirstOrDefaultAsync(n =>
                    n.Id == notificationId &&
                    n.UserId == userId);

            if (notification != null && !notification.IsDelivered)
            {
                notification.IsDelivered = true;
                await _context.SaveChangesAsync();
            }
        }

        public Task JoinProjectGroup(int projectId)
        {
            return Groups.AddToGroupAsync(Context.ConnectionId, $"project-{projectId}");
        }

        public Task LeaveProjectGroup(int projectId)
        {
            return Groups.RemoveFromGroupAsync(Context.ConnectionId, $"project-{projectId}");
        }

        public Task JoinAdminGroup()
        {
            return Groups.AddToGroupAsync(Context.ConnectionId, "admins");
        }

        public Task LeaveAdminGroup()
        {
            return Groups.RemoveFromGroupAsync(Context.ConnectionId, "admins");
        }
    }
}
