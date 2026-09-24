using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Interfaces;
using TaskManagement.Application.DTOs;
using TaskManagement.Domain.Entities;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;

namespace TaskManagement.Infrastructure.Services
{
    public class ChatService : IChatService
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public ChatService(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        public async Task<IEnumerable<AdminChatSessionDto>> GetAdminChatSessionsAsync()
        {
            var sessions = await (from s in _context.ChatSessions.AsNoTracking()
                                  where s.IsActive
                                  join t in _context.TaskItems.AsNoTracking() on s.TaskId equals t.Id
                                  join p in _context.Projects.AsNoTracking() on t.ProjectId equals p.Id
                                  join u in _context.Users.AsNoTracking() on s.UserId equals u.Id
                                  join m in _context.ChatMessages.AsNoTracking() on s.Id equals m.ChatSessionId into mg
                                  select new AdminChatSessionDto
                                  {
                                      ChatSessionId = s.Id,
                                      UserId = s.UserId,
                                      UserFullName = u.FullName ?? u.UserName,
                                      TaskId = t.Id,
                                      TaskTitle = t.Title,
                                      TaskStatus = t.Status,
                                      ProjectId = p.Id,
                                      ProjectTitle = p.ProjectTitle,
                                      LatestMessage = mg.OrderByDescending(x => x.SentAt).Select(x => x.Message).FirstOrDefault() ?? string.Empty,
                                      LatestMessageAt = mg.OrderByDescending(x => x.SentAt).Select(x => (DateTime?)x.SentAt).FirstOrDefault(),
                                      UnreadCount = mg.Count(x => !x.IsRead && x.SenderId == s.UserId)
                                  })
                                 .ToListAsync();

            // Order by latest message time (most recent first)
            var ordered = sessions.OrderByDescending(x => x.LatestMessageAt ?? DateTime.MinValue).ToList();

            return ordered;
        }

        public async Task<(bool Success, string Error, int ChatSessionId)> StartChatAsync(
            int taskId,
            string userId)
        {
            var task = await _context.TaskItems
                .AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.Id == taskId &&
                    x.AssignedToUserId == userId);

            if (task == null)
                return (false, "Task not found or you are not assigned to this task.", 0);

            var admin = await _userManager.Users
                .Where(x => x.IsActive)
                .ToListAsync();

            ApplicationUser? selectedAdmin = null;

            foreach (var user in admin)
            {
                if (await _userManager.IsInRoleAsync(user, "Admin"))
                {
                    selectedAdmin = user;
                    break;
                }
            }

            if (selectedAdmin == null)
                return (false, "Admin account not found.", 0);

            var existingSession = await _context.ChatSessions
                .FirstOrDefaultAsync(x =>
                    x.TaskId == taskId &&
                    x.UserId == userId &&
                    x.IsActive);

            if (existingSession != null)
                return (true, string.Empty, existingSession.Id);

            var session = new ChatSession
            {
                TaskId = taskId,
                UserId = userId,
                AdminId = selectedAdmin.Id,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.ChatSessions.Add(session);

            await _context.SaveChangesAsync();

            return (true, string.Empty, session.Id);
        }

        public async Task<(bool Success, string Error)> SendMessageAsync(
            int chatSessionId,
            string senderId,
            string message)
        {
            if (string.IsNullOrWhiteSpace(message))
                return (false, "Message cannot be empty.");

            message = message.Trim();

            if (message.Length > 4000)
                return (false, "Message cannot exceed 4000 characters.");

            var session = await _context.ChatSessions
                .FirstOrDefaultAsync(x =>
                    x.Id == chatSessionId &&
                    x.IsActive);

            if (session == null)
                return (false, "Chat session not found.");

            var isAdmin = await _userManager.Users
                .Where(x => x.Id == senderId)
                .AnyAsync();

            var sender = await _userManager.FindByIdAsync(senderId);

            if (sender == null)
                return (false, "Sender not found.");

            var senderIsAdmin = await _userManager.IsInRoleAsync(sender, "Admin");

            if (!senderIsAdmin && session.UserId != senderId)
                return (false, "You are not allowed to send messages in this chat.");

            if (senderIsAdmin && session.AdminId != senderId)
                return (false, "You are not allowed to send messages in this chat.");

            var chatMessage = new ChatMessage
            {
                ChatSessionId = chatSessionId,
                SenderId = senderId,
                Message = message,
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            _context.ChatMessages.Add(chatMessage);

            await _context.SaveChangesAsync();

            return (true, string.Empty);
        }

        public async Task<object?> GetChatAsync(
            int chatSessionId,
            string userId,
            bool isAdmin)
        {
            var session = await _context.ChatSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.Id == chatSessionId &&
                    x.IsActive);

            if (session == null)
                return null;

            if (!isAdmin && session.UserId != userId)
                return null;

            if (isAdmin && session.AdminId != userId)
                return null;

            var messages = await _context.ChatMessages
                .AsNoTracking()
                .Where(x => x.ChatSessionId == chatSessionId)
                .OrderBy(x => x.SentAt)
                .Select(x => new
                {
                    x.Id,
                    x.SenderId,
                    x.Message,
                    x.SentAt,
                    x.IsRead
                })
                .ToListAsync();

            if (isAdmin)
            {
                var task = await _context.TaskItems
                    .AsNoTracking()
                    .Where(x => x.Id == session.TaskId)
                    .Select(x => new
                    {
                        x.Id,
                        x.Title,
                        x.Status,
                        x.ProjectId
                    })
                    .FirstOrDefaultAsync();

                var user = await _userManager.FindByIdAsync(session.UserId);

                return new
                {
                    session.Id,
                    session.TaskId,
                    User = new
                    {
                        Id = user?.Id,
                        FullName = user?.FullName,
                        Email = user?.Email
                    },
                    Task = task,
                    Messages = messages
                };
            }

            var userTask = await _context.TaskItems
                .AsNoTracking()
                .Where(x => x.Id == session.TaskId)
                .Select(x => new
                {
                    x.Id,
                    x.Title,
                    x.Status
                })
                .FirstOrDefaultAsync();

            return new
            {
                session.Id,
                session.TaskId,
                Task = userTask,
                Messages = messages
            };
        }

        public async Task<int?> GetActiveChatSessionIdAsync(
            int taskId,
            string userId)
        {
            var session = await _context.ChatSessions
                .AsNoTracking()
                .Where(x =>
                    x.TaskId == taskId &&
                    x.UserId == userId &&
                    x.IsActive)
                .Select(x => new { x.Id })
                .FirstOrDefaultAsync();

            if (session == null)
                return null;

            return session.Id;
        }
    }
}