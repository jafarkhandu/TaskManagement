using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs;
using TaskManagement.Application.Interfaces;
using Microsoft.AspNetCore.Identity;
using TaskManagement.Infrastructure.Identity;

namespace TaskManagement.Web.Controllers
{
    public class AccountController : Controller
    {
        private readonly IAuthService _authService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly TaskManagement.Infrastructure.Services.EmailService _emailService;

        public AccountController(
                IAuthService authService,
                UserManager<ApplicationUser> userManager,
                TaskManagement.Infrastructure.Services.EmailService emailService)
        {
            _authService = authService;
            _userManager = userManager;
            _emailService = emailService;
        }

        // GET: /Account/Login
        [HttpGet]
        public IActionResult Login(string? returnUrl = null)
        {
            ViewBag.ReturnUrl = returnUrl;

            return View();
        }

        // POST: /Account/Login
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(
            [FromBody] LoginDto model,
            string? returnUrl = null)
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage)
                    .ToList();

                return BadRequest(new
                {
                    success = false,
                    message = "Please enter valid login details.",
                    errors
                });
            }

            var result = await _authService.LoginAsync(model);

            if (!result.Success)
            {
                return BadRequest(new
                {
                    success = false,
                    message = result.Error
                });
            }

            var user =
                 await _userManager.FindByEmailAsync(model.Email);

            var redirectUrl = "/Home/Index";

            if (user != null &&
                await _userManager.IsInRoleAsync(user, "Admin"))
            {
                redirectUrl = "/Admin/Dashboard";
            }
            else if (!string.IsNullOrEmpty(returnUrl)
                     && Url.IsLocalUrl(returnUrl))
            {
                redirectUrl = returnUrl;
            }

            return Ok(new
            {
                success = true,
                message = "Login successful.",
                redirectUrl
            });

        }

            // GET: /Account/Register
            [HttpGet]
        public IActionResult Register()
        {
            return View();
        }

        // POST: /Account/Register
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Register(
            [FromBody] RegisterDto model)
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage)
                    .ToList();

                return BadRequest(new
                {
                    success = false,
                    message = "Please correct the form.",
                    errors
                });
            }

            var result =
                await _authService.RegisterAsync(model);

            if (!result.Success)
            {
                return BadRequest(new
                {
                    success = false,
                    message = result.Error
                });
            }

            // Send informational email to the user acknowledging the account request
            var user = await _userManager.FindByEmailAsync(model.Email);

            if (user != null)
            {
                var emailBody = $"""
                    <p>Hello <strong>{user.FullName}</strong>,</p>

                    <p>Your TaskManager account request has been received successfully.</p>

                    <p>Please wait until your request is approved by the administrator. Until your account is approved, you will not be able to log in.</p>

                    <p>If you have any questions or need assistance, please contact the administrator.</p>

                    <p>Regards,<br/>TaskManager Team</p>
                    """;

                await _emailService.SendEmailAsync(
                    user.Email!,
                    "TaskManager Account Request Received",
                    emailBody);
            }

            return Ok(new
            {
                success = true,
                message = "Account request submitted successfully. You will be notified when your account is activated.",
                redirectUrl = "/Account/Login"
            });
        }

        // POST: /Account/Logout
        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await _authService.LogoutAsync();

            return Ok(new
            {
                success = true,
                message = "Logout successful.",
                redirectUrl = "/Account/Login"
            });
        }

        // GET: /Account/AccessDenied
        [HttpGet]
        public IActionResult AccessDenied()
        {
            return View();
        }
    }
}