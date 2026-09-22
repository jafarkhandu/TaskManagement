using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace TaskManagement.WebApp.Hubs
{
    [Authorize(Roles = "User")]
    public class NotificationHub : Hub
    {
    }
}