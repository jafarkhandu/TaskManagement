using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.Interfaces;
using TaskManagement.Application.DTOs;
using TaskManagement.Infrastructure.Identity;

namespace TaskManagement.WebApp.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")]
    public class ChatController : Controller
    {
        private readonly IChatService _chatService;
        private readonly UserManager<ApplicationUser> _userManager;

        public ChatController(
            IChatService chatService,
            UserManager<ApplicationUser> userManager)
        {
            _chatService = chatService;
            _userManager = userManager;
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

            return Ok();
        }
    }
}
