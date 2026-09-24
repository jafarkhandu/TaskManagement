using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;
using TaskManagement.Application.Interfaces;
using System.Linq;
using System;

namespace TaskManagement.WebApp.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IChatService _chatService;

        public ChatHub(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager,
            IChatService chatService)
        {
            _context = context;
            _userManager = userManager;
            _chatService = chatService;
        }

        public async Task JoinChat(int chatSessionId)
        {
            var user = await _userManager.GetUserAsync(Context.User);

            if (user == null)
                throw new HubException("Unauthorized.");

            var session = await _context.ChatSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == chatSessionId && x.IsActive);

            if (session == null)
                throw new HubException("Chat session not found.");

            var isAdmin = await _userManager.IsInRoleAsync(user, "Admin");

            if (!isAdmin && session.UserId != user.Id)
                throw new HubException("You are not allowed to access this chat.");

            if (isAdmin && session.AdminId != user.Id)
                throw new HubException("You are not allowed to access this chat.");

            // Prevent users from joining chats for completed tasks
            var task = await _context.TaskItems.AsNoTracking().FirstOrDefaultAsync(t => t.Id == session.TaskId);

            if (task != null && string.Equals(task.Status, "Completed", StringComparison.OrdinalIgnoreCase) && !isAdmin)
                throw new HubException("Chat session not available for completed tasks.");

            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                $"chat-{chatSessionId}");
        }

        public async Task LeaveChat(int chatSessionId)
        {
            await Groups.RemoveFromGroupAsync(
                Context.ConnectionId,
                $"chat-{chatSessionId}");
        }

        public async Task SendMessage(int chatSessionId, string message)
        {
            var user = await _userManager.GetUserAsync(Context.User);

            if (user == null)
                throw new HubException("Unauthorized.");

            var session = await _context.ChatSessions
                .FirstOrDefaultAsync(x => x.Id == chatSessionId && x.IsActive);

            if (session == null)
                throw new HubException("Chat session not found.");

            var isAdmin = await _userManager.IsInRoleAsync(user, "Admin");

            if (!isAdmin && session.UserId != user.Id)
                throw new HubException("You are not allowed to send messages in this chat.");

            if (isAdmin && session.AdminId != user.Id)
                throw new HubException("You are not allowed to send messages in this chat.");

            var result = await _chatService.SendMessageAsync(chatSessionId, user.Id, message);

            if (!result.Success)
                throw new HubException(result.Error);

            // Broadcast the exact message returned by the service (prevents race conditions)
            if (result.Message != null)
            {
                var payload = new
                {
                    chatSessionId = chatSessionId,
                    id = result.Message.Id,
                    senderId = result.Message.SenderId,
                    senderName = result.Message.SenderName,
                    message = result.Message.Message,
                    sentAt = result.Message.SentAt,
                    isRead = result.Message.IsRead
                };

                await Clients.Group($"chat-{chatSessionId}")
                    .SendAsync("ReceiveMessage", payload);
            }
        }
    }
}