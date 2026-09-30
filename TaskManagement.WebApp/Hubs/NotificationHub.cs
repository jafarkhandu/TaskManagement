using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Data;

namespace TaskManagement.WebApp.Hubs
{
    // Central real-time notification hub.
    // It handles both user task-assignment notifications and admin live notifications.
    [Authorize]
    public class NotificationHub : Hub
    {
        private static readonly ConcurrentDictionary<string, int> OnlineUsers =
            new();

        private readonly ApplicationDbContext _context;

        public NotificationHub(ApplicationDbContext context)
        {
            _context = context;
        }

        public static bool IsUserOnline(string userId)
        {
            return !string.IsNullOrWhiteSpace(userId) &&
                   OnlineUsers.TryGetValue(userId, out var count) &&
                   count > 0;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.UserIdentifier;

            if (!string.IsNullOrWhiteSpace(userId))
            {
                OnlineUsers.AddOrUpdate(
                    userId,
                    1,
                    (_, count) => count + 1);

                if (Context.User?.IsInRole("Admin") == true)
                {
                    await Groups.AddToGroupAsync(
                        Context.ConnectionId,
                        "admins");

                    var missedAdminNotifications =
                        await (from n in _context.Notifications
                               join a in _context.TaskAssignments
                                   on n.TaskAssignmentId equals a.Id
                               join t in _context.TaskItems
                                   on a.TaskId equals t.Id
                               join u in _context.Users
                                   on a.UserId equals u.Id
                               where n.UserId == userId
                                     && !n.IsDelivered
                                     && !n.IsRead
                                     && n.Type.StartsWith("Admin")
                               orderby n.CreatedAt
                               select new
                               {
                                   notificationId = n.Id,
                                   type = n.Type,
                                   title = n.Title,
                                   message = n.Type == "AdminTaskCompleted"
                                       ? ((u.FullName ?? u.UserName ?? "User") + " completed " + t.Title + ".")
                                       : "You have a new administrator notification.",
                                   userName = u.FullName ?? u.UserName ?? "User",
                                   taskId = t.Id,
                                   taskTitle = t.Title,
                                   completionRepositoryUrl = n.Type == "AdminTaskCompleted"
                                       ? a.CompletionRepositoryUrl
                                       : null,
                                   createdAt = n.CreatedAt,
                                   taskAssignmentId = n.TaskAssignmentId
                               })
                              .ToListAsync();

                    if (missedAdminNotifications.Count > 0)
                    {
                        await Clients.Caller.SendAsync(
                            "AdminMissedNotificationsReceived",
                            missedAdminNotifications);

                        var ids = missedAdminNotifications
                            .Select(x => x.notificationId)
                            .ToList();

                        var notifications = await _context.Notifications
                            .Where(n => ids.Contains(n.Id))
                            .ToListAsync();

                        foreach (var notification in notifications)
                        {
                            notification.IsDelivered = true;
                            notification.IsRead = true;
                        }

                        await _context.SaveChangesAsync();
                    }
                }
                else
                {
                    var missed = await _context.Notifications
                        .Where(n =>
                            n.UserId == userId &&
                            !n.IsDelivered &&
                            !n.IsRead &&
                            n.Type != "UserChatMessage")
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

                    // Chat messages use their own delivery channel so they never
                    // appear as normal task-assignment notifications.
                    var missedChatNotifications =
                        await (from n in _context.Notifications
                               join a in _context.TaskAssignments
                                   on n.TaskAssignmentId equals a.Id
                               join t in _context.TaskItems
                                   on a.TaskId equals t.Id
                               join s in _context.ChatSessions
                                   on new
                                   {
                                       TaskId = a.TaskId,
                                       UserId = a.UserId
                                   }
                                   equals new
                                   {
                                       TaskId = s.TaskId,
                                       UserId = s.UserId
                                   }
                               where n.UserId == userId
                                     && !n.IsDelivered
                                     && n.Type == "UserChatMessage"
                                     && s.IsActive
                               orderby n.CreatedAt
                               select new
                               {
                                   notificationId = n.Id,
                                   title = "New message from Admin",
                                   message = n.Title,
                                   senderName = "Admin",
                                   chatSessionId = s.Id,
                                   taskId = t.Id,
                                   taskTitle = t.Title,
                                   createdAt = n.CreatedAt
                               })
                              .ToListAsync();

                    if (missedChatNotifications.Count > 0)
                    {
                        await Clients.Caller.SendAsync(
                            "MissedChatNotificationsReceived",
                            missedChatNotifications);

                        var chatIds = missedChatNotifications
                            .Select(x => x.notificationId)
                            .ToList();

                        var chatNotifications = await _context.Notifications
                            .Where(n => chatIds.Contains(n.Id))
                            .ToListAsync();

                        foreach (var notification in chatNotifications)
                        {
                            notification.IsDelivered = true;
                        }

                        await _context.SaveChangesAsync();
                    }

                }
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.UserIdentifier;

            if (!string.IsNullOrWhiteSpace(userId))
            {
                OnlineUsers.AddOrUpdate(
                    userId,
                    0,
                    (_, count) => Math.Max(0, count - 1));

                if (OnlineUsers.TryGetValue(userId, out var remaining) &&
                    remaining <= 0)
                {
                    OnlineUsers.TryRemove(userId, out _);
                }
            }

            await base.OnDisconnectedAsync(exception);
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
            return Groups.AddToGroupAsync(
                Context.ConnectionId,
                $"project-{projectId}");
        }

        public Task LeaveProjectGroup(int projectId)
        {
            return Groups.RemoveFromGroupAsync(
                Context.ConnectionId,
                $"project-{projectId}");
        }

        public Task JoinAdminGroup()
        {
            return Groups.AddToGroupAsync(
                Context.ConnectionId,
                "admins");
        }

        public Task LeaveAdminGroup()
        {
            return Groups.RemoveFromGroupAsync(
                Context.ConnectionId,
                "admins");
        }
    }
}
