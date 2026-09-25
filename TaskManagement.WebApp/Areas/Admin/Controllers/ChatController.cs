using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using TaskManagement.Application.Interfaces;
using TaskManagement.Application.DTOs;
using TaskManagement.Infrastructure.Identity;
using TaskManagement.WebApp.Hubs;

namespace TaskManagement.WebApp.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")]
    public class ChatController : Controller
    {
        private readonly IChatService _chatService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IHubContext<ChatHub> _chatHub;

        public ChatController(
            IChatService chatService,
            UserManager<ApplicationUser> userManager,
            IHubContext<ChatHub> chatHub)
        {
            _chatService = chatService;
            _userManager = userManager;
            _chatHub = chatHub;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            // Load active admin chat sessions for initial render
            var sessions = await _chatService.GetAdminChatSessionsAsync();

            return View(sessions);
        }

        [HttpGet]
        public async Task<IActionResult> GetChat(int chatSessionId)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized();

            var chat = await _chatService.GetChatAsync(chatSessionId, user.Id, true);

            if (chat == null)
                return NotFound();

            return Ok(chat);
        }

        public class SendMessageModel
        {
            public int ChatSessionId { get; set; }

            public string? Message { get; set; }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SendMessage([FromBody] SendMessageModel model)
        {
            if (model == null)
                return BadRequest("Invalid payload.");

            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(model.Message))
                return BadRequest("Message cannot be empty.");

            var result = await _chatService.SendMessageAsync(model.ChatSessionId, user.Id, model.Message.Trim());

            if (!result.Success)
                return BadRequest(result.Error);

            // Broadcast the saved message to the chat group so the user receives it in real-time
            if (result.Message != null)
            {
                var payload = new
                {
                    chatSessionId = model.ChatSessionId,
                    senderId = result.Message.SenderId,
                    senderName = result.Message.SenderName,
                    message = result.Message.Message,
                    sentAt = result.Message.SentAt
                };

                try
                {
                    await _chatHub.Clients.Group($"chat-{model.ChatSessionId}").SendAsync("ReceiveMessage", payload);
                }
                catch
                {
                    // Non-fatal
                }
            }

            return Ok();
        }

    }
}
