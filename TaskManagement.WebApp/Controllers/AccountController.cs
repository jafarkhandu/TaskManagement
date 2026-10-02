using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs;
using TaskManagement.Application.Interfaces;
using TaskManagement.Infrastructure.Identity;

namespace TaskManagement.Web.Controllers
{
    public class AccountController : Controller
    {
        private readonly IAuthService _authService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly TaskManagement.Infrastructure.Services.EmailService _emailService;

        private const string ForgotPasswordProvider = "TaskManagement";
        private const string ForgotPasswordOtpHashToken = "ForgotPasswordOtpHash";
        private const string ForgotPasswordOtpExpiresToken = "ForgotPasswordOtpExpiresAt";
        private const string ForgotPasswordOtpLastSentToken = "ForgotPasswordOtpLastSentAt";
        private const string ForgotPasswordOtpResendCountToken = "ForgotPasswordOtpResendCount";
        private const string ForgotPasswordResetToken = "ForgotPasswordResetToken";
        private static readonly TimeSpan ForgotPasswordOtpLifetime = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan ForgotPasswordResendCooldown = TimeSpan.FromSeconds(60);
        private const int MaxForgotPasswordResends = 3;

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

            var redirectUrl = "/User/Dashboard";

            if (result.IsAdmin)
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

        // POST: /Account/SendForgotPasswordOtp
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SendForgotPasswordOtp([FromBody] ForgotPasswordOtpRequest model)
        {
            if (string.IsNullOrWhiteSpace(model.Email) ||
                !new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(model.Email))
                return BadRequest(new { success = false, message = "Please enter a valid email address." });

            var user = await _userManager.FindByEmailAsync(model.Email.Trim());

            if (user == null || !user.IsActive)
                return Ok(new { success = true, message = "If an account exists for this email, an OTP has been sent." });

            var lastSentValue = await _userManager.GetAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpLastSentToken);

            if (DateTime.TryParse(lastSentValue, null,
                    System.Globalization.DateTimeStyles.RoundtripKind, out var lastSentAt) &&
                DateTime.UtcNow - lastSentAt < ForgotPasswordResendCooldown)
            {
                var seconds = (int)Math.Ceiling(
                    (ForgotPasswordResendCooldown - (DateTime.UtcNow - lastSentAt)).TotalSeconds);
                return BadRequest(new { success = false, message = $"Please wait {seconds} seconds before requesting another OTP." });
            }

            var countValue = await _userManager.GetAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpResendCountToken);

            var count = int.TryParse(countValue, out var parsed) ? parsed : 0;

            if (count >= MaxForgotPasswordResends)
                return BadRequest(new { success = false, message = "Maximum OTP resend limit reached. Please try again later." });

            var otp = System.Security.Cryptography.RandomNumberGenerator
                .GetInt32(0, 1_000_000).ToString("D6");

            await _userManager.SetAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpHashToken,
                _userManager.PasswordHasher.HashPassword(user, otp));

            await _userManager.SetAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpExpiresToken,
                DateTime.UtcNow.Add(ForgotPasswordOtpLifetime).ToString("O"));

            await _userManager.SetAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpLastSentToken,
                DateTime.UtcNow.ToString("O"));

            await _userManager.SetAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpResendCountToken,
                (count + 1).ToString());

            await _userManager.RemoveAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordResetToken);

            var body = $"""
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px;color:#17213c;">
                    <h2>Reset your TaskManager password</h2>
                    <p>Hello <strong>{System.Net.WebUtility.HtmlEncode(user.FullName ?? "User")}</strong>,</p>
                    <p>Use this OTP to reset your password:</p>
                    <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:18px;background:#f3f6ff;border-radius:12px;color:#3158e8;">{otp}</div>
                    <p>This OTP expires in <strong>10 minutes</strong>.</p>
                    <p>If you did not request this, you can safely ignore this email.</p>
                    <p>Regards,<br/>TaskManager Team</p>
                </div>
                """;

            try
            {
                await _emailService.SendEmailAsync(user.Email!, "TaskManager Password Reset OTP", body);
            }
            catch
            {
                await ClearForgotPasswordTokens(user);
                return StatusCode(500, new { success = false, message = "Unable to send the OTP right now. Please try again." });
            }

            return Ok(new
            {
                success = true,
                message = "OTP sent to your registered email address.",
                expiresInSeconds = (int)ForgotPasswordOtpLifetime.TotalSeconds,
                resendCooldownSeconds = (int)ForgotPasswordResendCooldown.TotalSeconds
            });
        }

        // POST: /Account/VerifyForgotPasswordOtp
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> VerifyForgotPasswordOtp([FromBody] ForgotPasswordOtpRequest model)
        {
            if (string.IsNullOrWhiteSpace(model.Email) ||
                string.IsNullOrWhiteSpace(model.Otp))
                return BadRequest(new { success = false, message = "Email and OTP are required." });

            var user = await _userManager.FindByEmailAsync(model.Email.Trim());

            if (user == null || !user.IsActive)
                return BadRequest(new { success = false, message = "Invalid or expired OTP." });

            var hash = await _userManager.GetAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpHashToken);

            var expiry = await _userManager.GetAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpExpiresToken);

            if (string.IsNullOrWhiteSpace(hash) ||
                !DateTime.TryParse(expiry, null,
                    System.Globalization.DateTimeStyles.RoundtripKind, out var expiresAt) ||
                DateTime.UtcNow > expiresAt ||
                model.Otp.Length != 6)
                return BadRequest(new { success = false, message = "Invalid or expired OTP." });

            var result = _userManager.PasswordHasher.VerifyHashedPassword(
                user, hash, model.Otp);

            if (result == PasswordVerificationResult.Failed)
                return BadRequest(new { success = false, message = "Invalid or expired OTP." });

            var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);

            await _userManager.SetAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordResetToken, resetToken);

            await _userManager.RemoveAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpHashToken);
            await _userManager.RemoveAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpExpiresToken);
            await _userManager.RemoveAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpLastSentToken);
            await _userManager.RemoveAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordOtpResendCountToken);

            return Ok(new { success = true, message = "OTP verified successfully." });
        }

        // POST: /Account/ResetForgotPassword
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ResetForgotPassword([FromBody] ForgotPasswordResetRequest model)
        {
            if (string.IsNullOrWhiteSpace(model.Email) ||
                string.IsNullOrWhiteSpace(model.NewPassword) ||
                string.IsNullOrWhiteSpace(model.ConfirmPassword))
                return BadRequest(new { success = false, message = "All password fields are required." });

            if (model.NewPassword != model.ConfirmPassword)
                return BadRequest(new { success = false, message = "Passwords do not match." });

            var user = await _userManager.FindByEmailAsync(model.Email.Trim());

            if (user == null || !user.IsActive)
                return BadRequest(new { success = false, message = "Unable to reset the password." });

            var resetToken = await _userManager.GetAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordResetToken);

            if (string.IsNullOrWhiteSpace(resetToken))
                return BadRequest(new { success = false, message = "OTP verification is required before resetting the password." });

            var result = await _userManager.ResetPasswordAsync(
                user, resetToken, model.NewPassword);

            if (!result.Succeeded)
                return BadRequest(new
                {
                    success = false,
                    message = string.Join(" ", result.Errors.Select(e => e.Description))
                });

            await _userManager.RemoveAuthenticationTokenAsync(
                user, ForgotPasswordProvider, ForgotPasswordResetToken);

            return Ok(new { success = true, message = "Password changed successfully." });
        }

        private async Task ClearForgotPasswordTokens(ApplicationUser user)
        {
            await _userManager.RemoveAuthenticationTokenAsync(user, ForgotPasswordProvider, ForgotPasswordOtpHashToken);
            await _userManager.RemoveAuthenticationTokenAsync(user, ForgotPasswordProvider, ForgotPasswordOtpExpiresToken);
            await _userManager.RemoveAuthenticationTokenAsync(user, ForgotPasswordProvider, ForgotPasswordOtpLastSentToken);
            await _userManager.RemoveAuthenticationTokenAsync(user, ForgotPasswordProvider, ForgotPasswordOtpResendCountToken);
            await _userManager.RemoveAuthenticationTokenAsync(user, ForgotPasswordProvider, ForgotPasswordResetToken);
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

    public sealed class ForgotPasswordOtpRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Otp { get; set; } = string.Empty;
    }

    public sealed class ForgotPasswordResetRequest
    {
        public string Email { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
        public string ConfirmPassword { get; set; } = string.Empty;
    }
}