using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace TaskManagement.WebApp.Hubs
{
    // Allow any authenticated user to connect to the notification hub.
    // Group-level filtering is used to target messages (e.g., project groups or admin group).
    [Authorize]
    public class NotificationHub : Hub
    {
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
