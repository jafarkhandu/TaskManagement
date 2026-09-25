using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Interfaces;
using TaskManagement.Application.DTOs;
using TaskManagement.Domain.Entities;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;
using System.Linq;

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

        public async Task<(bool Success, string Error, int ChatSessionId, bool IsNew)> StartChatAsync(
            int taskId,
            string userId)
        {
            var task = await _context.TaskItems
                .AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.Id == taskId &&
                    x.AssignedToUserId == userId);

            if (task == null)
                return (false, "Task not found or you are not assigned to this task.", 0, false);

            if (string.Equals(task.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                return (false, "Cannot start chat for completed tasks.", 0, false);

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
                return (false, "Admin account not found.", 0, false);

            var existingSession = await _context.ChatSessions
                .FirstOrDefaultAsync(x =>
                    x.TaskId == taskId &&
                    x.UserId == userId &&
                    x.IsActive);

            if (existingSession != null)
                return (true, string.Empty, existingSession.Id, false);

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

            // Create the first user message with the complete task context.
            // This is what gives the Admin Chat the task-specific details immediately
            // when a user starts a brand-new chat from a task card.
            var initialMessage = new ChatMessage
            {
                ChatSessionId = session.Id,
                SenderId = userId,
                Message =
                    $"New chat started for Task #{task.Id}\n\n" +
                    $"Task Title: {task.Title}\n" +
                    $"Scenario: {task.Scenario}\n" +
                    $"Status: {task.Status}\n" +
                    $"Priority: {task.Priority}\n" +
                    $"Start Date: {task.StartDate:dd MMM yyyy}\n" +
                    $"Expected End Date: {task.ExpectedEndDate:dd MMM yyyy}\n" +
                    $"Amount: ₹ {task.Amount:0.00}\n\n" +
                    "I would like to discuss this task with Admin.",
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            _context.ChatMessages.Add(initialMessage);
            await _context.SaveChangesAsync();

            return (true, string.Empty, session.Id, true);
        }

        public async Task<(bool Success, string Error, AdminChatMessageDto? Message)> SendMessageAsync(
            int chatSessionId,
            string senderId,
            string message)
        {
            if (string.IsNullOrWhiteSpace(message))
                return (false, "Message cannot be empty.", null);

            message = message.Trim();

            if (message.Length > 4000)
                return (false, "Message cannot exceed 4000 characters.", null);

            var session = await _context.ChatSessions
                .FirstOrDefaultAsync(x =>
                    x.Id == chatSessionId &&
                    x.IsActive);

            if (session == null)
                return (false, "Chat session not found.", null);

            var sender = await _userManager.FindByIdAsync(senderId);

            if (sender == null)
                return (false, "Sender not found.", null);

            var senderIsAdmin = await _userManager.IsInRoleAsync(sender, "Admin");

            if (!senderIsAdmin && session.UserId != senderId)
                return (false, "You are not allowed to send messages in this chat.", null);

            if (senderIsAdmin && session.AdminId != senderId)
                return (false, "You are not allowed to send messages in this chat.", null);

            // Prevent messages on completed tasks for users
            var task = await _context.TaskItems.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == session.TaskId);

            if (task != null && string.Equals(task.Status, "Completed", StringComparison.OrdinalIgnoreCase) && !senderIsAdmin)
                return (false, "Cannot send messages for completed task.", null);

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

            var dto = new AdminChatMessageDto
            {
                Id = chatMessage.Id,
                SenderId = chatMessage.SenderId,
                SenderName = sender?.FullName ?? sender?.UserName,
                Message = chatMessage.Message,
                SentAt = chatMessage.SentAt,
                IsRead = chatMessage.IsRead
            };

            return (true, string.Empty, dto);
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

            if (task == null)
                return null;

            // Users cannot access chats for completed tasks
            if (!isAdmin && string.Equals(task.Status, "Completed", StringComparison.OrdinalIgnoreCase))
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

            var userTask = new
            {
                task.Id,
                task.Title,
                task.Status
            };

            return new
            {
                session.Id,
                session.TaskId,
                Task = userTask,
                Messages = messages
            };
        }

        public async Task<IEnumerable<UserChatSessionDto>> GetUserChatSessionsAsync(string userId)
        {
            var sessions = await (from s in _context.ChatSessions.AsNoTracking()
                                  where s.IsActive && s.UserId == userId
                                  join t in _context.TaskItems.AsNoTracking() on s.TaskId equals t.Id
                                  join m in _context.ChatMessages.AsNoTracking() on s.Id equals m.ChatSessionId into mg
                                  select new UserChatSessionDto
                                  {
                                      ChatSessionId = s.Id,
                                      TaskId = t.Id,
                                      TaskTitle = t.Title,
                                      TaskStatus = t.Status,
                                      LatestMessage = mg.OrderByDescending(x => x.SentAt).Select(x => x.Message).FirstOrDefault(),
                                      LatestMessageAt = mg.OrderByDescending(x => x.SentAt).Select(x => (DateTime?)x.SentAt).FirstOrDefault(),
                                      UnreadCount = mg.Count(x => !x.IsRead && x.SenderId == s.AdminId)
                                  })
                                 .ToListAsync();

            return sessions.OrderByDescending(x => x.LatestMessageAt ?? DateTime.MinValue).ToList();
        }

        public async Task<IEnumerable<UserAvailableChatTaskDto>> GetAvailableChatTasksAsync(
            string userId,
            string? search = null)
        {
            var query =
                from t in _context.TaskItems.AsNoTracking()
                where t.AssignedToUserId == userId
                      && t.Status != "Completed"
                      && !_context.ChatSessions.Any(s =>
                          s.TaskId == t.Id &&
                          s.UserId == userId)
                select new UserAvailableChatTaskDto
                {
                    TaskId = t.Id,
                    Title = t.Title,
                    Status = t.Status,
                    Scenario = t.Scenario
                };

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                query = query.Where(t =>
                    t.Title.Contains(term) ||
                    (t.Scenario != null && t.Scenario.Contains(term)));
            }

            return await query
                .OrderBy(t => t.Title)
                .ThenByDescending(t => t.TaskId)
                .Take(20)
                .ToListAsync();
        }

        public async Task<(bool Success, string Error)> MarkMessagesAsReadAsync(int chatSessionId, string userId)
        {
            var session = await _context.ChatSessions
                .FirstOrDefaultAsync(x => x.Id == chatSessionId && x.IsActive);

            if (session == null)
                return (false, "Chat session not found.");

            if (session.UserId != userId)
                return (false, "You are not allowed to modify this chat.");

            var messages = await _context.ChatMessages
                .Where(x => x.ChatSessionId == chatSessionId && !x.IsRead && x.SenderId == session.AdminId)
                .ToListAsync();

            if (!messages.Any())
                return (true, string.Empty);

            foreach (var m in messages)
            {
                m.IsRead = true;
            }

            await _context.SaveChangesAsync();

            return (true, string.Empty);
        }

        public async Task<int?> GetActiveChatSessionIdAsync(
            int taskId,
            string userId)
        {
            var session = await _context.ChatSessions
                .AsNoTracking()
                .Where(x => x.TaskId == taskId && x.UserId == userId && x.IsActive)
                .Select(x => new { x.Id, x.TaskId })
                .FirstOrDefaultAsync();

            if (session == null)
                return null;

            var task = await _context.TaskItems.AsNoTracking()
                .Where(t => t.Id == session.TaskId && t.Status != "Completed")
                .Select(t => t.Id)
                .FirstOrDefaultAsync();

            if (task == 0)
                return null;

            // Backfill the task-context message for an older blank session.
            // This keeps previously created sessions consistent with new chats.
            var hasMessages = await _context.ChatMessages
                .AsNoTracking()
                .AnyAsync(x => x.ChatSessionId == session.Id);

            if (!hasMessages)
            {
                var taskDetails = await _context.TaskItems
                    .AsNoTracking()
                    .Where(t => t.Id == session.TaskId)
                    .Select(t => new
                    {
                        t.Id,
                        t.Title,
                        t.Scenario,
                        t.Status,
                        t.Priority,
                        t.StartDate,
                        t.ExpectedEndDate,
                        t.Amount
                    })
                    .FirstOrDefaultAsync();

                if (taskDetails != null)
                {
                    _context.ChatMessages.Add(new ChatMessage
                    {
                        ChatSessionId = session.Id,
                        SenderId = userId,
                        Message =
                            $"New chat started for Task #{taskDetails.Id}\n\n" +
                            $"Task Title: {taskDetails.Title}\n" +
                            $"Scenario: {taskDetails.Scenario}\n" +
                            $"Status: {taskDetails.Status}\n" +
                            $"Priority: {taskDetails.Priority}\n" +
                            $"Start Date: {taskDetails.StartDate:dd MMM yyyy}\n" +
                            $"Expected End Date: {taskDetails.ExpectedEndDate:dd MMM yyyy}\n" +
                            $"Amount: ₹ {taskDetails.Amount:0.00}\n\n" +
                            "I would like to discuss this task with Admin.",
                        SentAt = DateTime.UtcNow,
                        IsRead = false
                    });

                    await _context.SaveChangesAsync();
                }
            }

            return session.Id;
        }
    }
}
