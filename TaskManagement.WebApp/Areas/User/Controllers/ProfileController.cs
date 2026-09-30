using System.Globalization;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.DTOs;
using TaskManagement.Application.Interfaces;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;
using TaskManagement.Infrastructure.Services;

namespace TaskManagement.WebApp.Areas.User.Controllers
{
    [Area("User")]
    [Authorize(Roles = "User")]
    public class ProfileController : Controller
    {
        private const string OtpProvider = "TaskManagement";
        private const string OtpHashName = "ProfilePasswordChangeOtpHash";
        private const string OtpExpiresName = "ProfilePasswordChangeOtpExpiresAt";
        private const string OtpLastSentName = "ProfilePasswordChangeOtpLastSentAt";
        private const string OtpResendCountName = "ProfilePasswordChangeOtpResendCount";

        private static readonly TimeSpan OtpLifetime = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
        private const int MaxResends = 3;

        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly EmailService _emailService;
        private readonly IProfilePictureStorage _profilePictureStorage;

        public ProfileController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager,
            EmailService emailService,
            IProfilePictureStorage profilePictureStorage)
        {
            _context = context;
            _userManager = userManager;
            _emailService = emailService;
            _profilePictureStorage = profilePictureStorage;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();

            var tasks = await _context.TaskItems
                .AsNoTracking()
                .Where(x => x.AssignedToUserId == user.Id)
                .ToListAsync();

            var totalTasks = tasks.Count;
            var completedTasks = tasks.Count(x =>
                string.Equals(x.Status, "Completed", StringComparison.OrdinalIgnoreCase));

            var model = new UserProfileViewModel
            {
                FullName = user.FullName ?? user.UserName ?? "Student",
                Email = user.Email ?? string.Empty,
                PhoneNumber = user.PhoneNumber ?? string.Empty,
                IsActive = user.IsActive,
                TotalTasks = totalTasks,
                CompletedTasks = completedTasks,
                CompletionRate = totalTasks == 0
                    ? 0
                    : Math.Round(completedTasks * 100m / totalTasks, 1),
                MonthlyPerformance = BuildMonthlyPerformance(tasks),
                ProfilePictureUrl = user.ProfilePictureUrl,
                ProfileCompletionPercentage = CalculateProfileCompletion(user),
                IsProfileComplete = IsProfileComplete(user)
            };

            return View(model);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateProfile(
            string fullName,
            string email,
            string phoneNumber)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized(new { success = false, message = "User session expired." });

            fullName = fullName?.Trim() ?? string.Empty;
            email = email?.Trim() ?? string.Empty;
            phoneNumber = phoneNumber?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(fullName))
                return BadRequest(new { success = false, message = "Full Name is required." });

            if (string.IsNullOrWhiteSpace(email) ||
                !new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email))
                return BadRequest(new { success = false, message = "Please enter a valid email address." });

            if (!string.IsNullOrWhiteSpace(phoneNumber) &&
                (!phoneNumber.All(char.IsDigit) || phoneNumber.Length < 10 || phoneNumber.Length > 15))
                return BadRequest(new { success = false, message = "Please enter a valid phone number." });

            var existingEmail = await _userManager.FindByEmailAsync(email);
            if (existingEmail != null && existingEmail.Id != user.Id)
                return BadRequest(new { success = false, message = "This email address is already registered." });

            var existingUsername = await _userManager.FindByNameAsync(fullName);
            if (existingUsername != null && existingUsername.Id != user.Id)
                return BadRequest(new { success = false, message = "This Full Name is already registered." });

            user.FullName = fullName;
            user.UserName = fullName;
            user.PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber;

            var emailResult = await _userManager.SetEmailAsync(user, email);
            if (!emailResult.Succeeded)
                return BadRequest(new { success = false, message = string.Join(" ", emailResult.Errors.Select(x => x.Description)) });

            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
                return BadRequest(new { success = false, message = string.Join(" ", updateResult.Errors.Select(x => x.Description)) });

            return Json(new
            {
                success = true,
                message = "Profile details updated successfully.",
                fullName = user.FullName,
                email = user.Email,
                phoneNumber = user.PhoneNumber,
                profileCompletionPercentage = CalculateProfileCompletion(user),
                isProfileComplete = IsProfileComplete(user)
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UploadProfilePicture(IFormFile? file)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized(new { success = false, message = "User session expired." });

            if (file == null || file.Length == 0)
                return BadRequest(new { success = false, message = "Please select or capture a photo." });

            const long maxBytes = 5 * 1024 * 1024;

            if (file.Length > maxBytes)
                return BadRequest(new { success = false, message = "Profile photo must be 5 MB or smaller." });

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };

            if (!allowed.Contains(extension))
                return BadRequest(new { success = false, message = "Only JPG, JPEG, PNG and WEBP images are allowed." });

            try
            {
                await using var stream = file.OpenReadStream();

                var profilePictureUrl = await _profilePictureStorage.UploadAsync(
                    stream,
                    file.FileName,
                    user.Id);

                user.ProfilePictureUrl = profilePictureUrl;

                var result = await _userManager.UpdateAsync(user);

                if (!result.Succeeded)
                {
                    try
                    {
                        await _profilePictureStorage.DeleteAsync(user.Id);
                    }
                    catch
                    {
                        // Do not hide the Identity update error.
                    }

                    return BadRequest(new
                    {
                        success = false,
                        message = string.Join(" ", result.Errors.Select(x => x.Description))
                    });
                }

                return Json(new
                {
                    success = true,
                    message = "Profile photo updated successfully.",
                    profilePictureUrl = user.ProfilePictureUrl
                });
            }
            catch
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Unable to save the profile photo right now. Please try again."
                });
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RemoveProfilePicture()
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized(new { success = false, message = "User session expired." });

            try
            {
                if (!string.IsNullOrWhiteSpace(user.ProfilePictureUrl))
                    await _profilePictureStorage.DeleteAsync(user.Id);

                user.ProfilePictureUrl = null;

                var result = await _userManager.UpdateAsync(user);

                if (!result.Succeeded)
                    return BadRequest(new
                    {
                        success = false,
                        message = "Unable to remove the profile photo."
                    });

                return Json(new
                {
                    success = true,
                    message = "Profile photo removed successfully."
                });
            }
            catch
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Unable to remove the profile photo right now. Please try again."
                });
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SendPasswordChangeOtp(
            string currentPassword,
            string newPassword,
            string confirmPassword)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized(new { success = false, message = "User session expired." });

            if (string.IsNullOrWhiteSpace(user.Email))
                return BadRequest(new { success = false, message = "Your account does not have a registered email address." });

            if (string.IsNullOrWhiteSpace(currentPassword) ||
                string.IsNullOrWhiteSpace(newPassword) ||
                string.IsNullOrWhiteSpace(confirmPassword))
            {
                return BadRequest(new { success = false, message = "Please complete all password fields." });
            }

            if (newPassword != confirmPassword)
                return BadRequest(new { success = false, message = "New password and confirmation password do not match." });

            if (newPassword == currentPassword ||
                await _userManager.CheckPasswordAsync(user, newPassword))
            {
                return BadRequest(new { success = false, message = "New password cannot be the same as your current password." });
            }

            if (!await _userManager.CheckPasswordAsync(user, currentPassword))
                return BadRequest(new { success = false, message = "Current password is incorrect." });

            var passwordErrors = await ValidateNewPasswordAsync(user, newPassword);

            if (passwordErrors.Count > 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = string.Join(" ", passwordErrors)
                });
            }

            var now = DateTimeOffset.UtcNow;
            var lastSentValue = await _userManager.GetAuthenticationTokenAsync(
                user,
                OtpProvider,
                OtpLastSentName);

            var resendCountValue = await _userManager.GetAuthenticationTokenAsync(
                user,
                OtpProvider,
                OtpResendCountName);

            var resendCount = int.TryParse(resendCountValue, out var parsedCount)
                ? parsedCount
                : 0;

            var isResend = !string.IsNullOrWhiteSpace(lastSentValue);

            if (isResend &&
                DateTimeOffset.TryParse(
                    lastSentValue,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind,
                    out var lastSent))
            {
                var elapsed = now - lastSent;

                if (elapsed < ResendCooldown)
                {
                    var waitSeconds = Math.Max(
                        1,
                        (int)Math.Ceiling((ResendCooldown - elapsed).TotalSeconds));

                    return BadRequest(new
                    {
                        success = false,
                        message = $"Please wait {waitSeconds} seconds before requesting another OTP.",
                        cooldownSeconds = waitSeconds
                    });
                }
            }

            if (isResend && resendCount >= MaxResends)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Maximum OTP resend limit reached. Please restart the password-change process."
                });
            }

            var otp = RandomNumberGenerator
                .GetInt32(0, 1_000_000)
                .ToString("D6");

            var otpHash = _userManager.PasswordHasher.HashPassword(user, otp);
            var expiresAt = now.Add(OtpLifetime);

            await SetTokenAsync(user, OtpHashName, otpHash);
            await SetTokenAsync(user, OtpExpiresName, expiresAt.ToString("O", CultureInfo.InvariantCulture));
            await SetTokenAsync(user, OtpLastSentName, now.ToString("O", CultureInfo.InvariantCulture));
            await SetTokenAsync(
                user,
                OtpResendCountName,
                (isResend ? resendCount + 1 : 0).ToString(CultureInfo.InvariantCulture));

            var safeName = System.Net.WebUtility.HtmlEncode(user.FullName ?? user.Email);
            var emailBody =
                "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;background:#0b1830;color:#eef4ff;border-radius:18px;'>" +
                "<h2 style='margin-top:0;color:#ffffff;'>TaskManager Password Change</h2>" +
                "<p>Hello <strong>" + safeName + "</strong>,</p>" +
                "<p>Use the following one-time verification code to change your TaskManager password:</p>" +
                "<div style='margin:24px 0;padding:18px;text-align:center;border-radius:14px;background:#172b4d;font-size:32px;font-weight:800;letter-spacing:8px;color:#8eb9ff;'>" +
                otp +
                "</div>" +
                "<p>This OTP expires in <strong>10 minutes</strong> and can be used only once.</p>" +
                "<p>If you did not request a password change, you can safely ignore this email.</p>" +
                "<p style='color:#91a7c2;'>Regards,<br/>TaskManager Team</p>" +
                "</div>";

            try
            {
                await _emailService.SendEmailAsync(
                    user.Email,
                    "TaskManager Password Change OTP",
                    emailBody);
            }
            catch
            {
                await ClearPasswordChangeOtpAsync(user);

                return StatusCode(500, new
                {
                    success = false,
                    message = "Unable to send the OTP email. Please try again."
                });
            }

            return Json(new
            {
                success = true,
                message = $"A 6-digit OTP was sent to {MaskEmail(user.Email)}.",
                expiresAt,
                resendAvailableAt = now.Add(ResendCooldown),
                resendCount = isResend ? resendCount + 1 : 0,
                maxResends = MaxResends
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> VerifyPasswordChangeOtp(
            string otp,
            string currentPassword,
            string newPassword,
            string confirmPassword)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized(new { success = false, message = "User session expired." });

            if (string.IsNullOrWhiteSpace(otp) || otp.Length != 6 || !otp.All(char.IsDigit))
                return BadRequest(new { success = false, message = "Enter the 6-digit OTP." });

            if (newPassword != confirmPassword)
                return BadRequest(new { success = false, message = "New password and confirmation password do not match." });

            if (!await _userManager.CheckPasswordAsync(user, currentPassword))
                return BadRequest(new { success = false, message = "Current password is incorrect." });

            if (newPassword == currentPassword ||
                await _userManager.CheckPasswordAsync(user, newPassword))
            {
                return BadRequest(new { success = false, message = "New password cannot be the same as your current password." });
            }

            var passwordErrors = await ValidateNewPasswordAsync(user, newPassword);

            if (passwordErrors.Count > 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = string.Join(" ", passwordErrors)
                });
            }

            var hash = await _userManager.GetAuthenticationTokenAsync(
                user,
                OtpProvider,
                OtpHashName);

            var expiresValue = await _userManager.GetAuthenticationTokenAsync(
                user,
                OtpProvider,
                OtpExpiresName);

            if (string.IsNullOrWhiteSpace(hash) ||
                string.IsNullOrWhiteSpace(expiresValue))
            {
                return BadRequest(new { success = false, message = "No active OTP was found. Please request a new OTP." });
            }

            if (!DateTimeOffset.TryParse(
                    expiresValue,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind,
                    out var expiresAt))
            {
                await ClearPasswordChangeOtpAsync(user);
                return BadRequest(new { success = false, message = "The OTP session is invalid. Please request a new OTP." });
            }

            if (DateTimeOffset.UtcNow > expiresAt)
            {
                await ClearPasswordChangeOtpAsync(user);
                return BadRequest(new { success = false, message = "The OTP has expired. Please request a new OTP." });
            }

            var verification = _userManager.PasswordHasher.VerifyHashedPassword(
                user,
                hash,
                otp);

            if (verification == PasswordVerificationResult.Failed)
            {
                return BadRequest(new { success = false, message = "Invalid OTP. Please check the code and try again." });
            }

            var result = await _userManager.ChangePasswordAsync(
                user,
                currentPassword,
                newPassword);

            if (!result.Succeeded)
            {
                return BadRequest(new
                {
                    success = false,
                    message = string.Join(" ", result.Errors.Select(x => x.Description))
                });
            }

            await ClearPasswordChangeOtpAsync(user);

            return Json(new
            {
                success = true,
                message = "Password changed successfully."
            });
        }

        private async Task<List<string>> ValidateNewPasswordAsync(
            ApplicationUser user,
            string newPassword)
        {
            var errors = new List<string>();

            foreach (var validator in _userManager.PasswordValidators)
            {
                var result = await validator.ValidateAsync(
                    _userManager,
                    user,
                    newPassword);

                if (!result.Succeeded)
                {
                    errors.AddRange(
                        result.Errors.Select(x => x.Description));
                }
            }

            return errors.Distinct().ToList();
        }

        private async Task SetTokenAsync(
            ApplicationUser user,
            string tokenName,
            string value)
        {
            var result = await _userManager.SetAuthenticationTokenAsync(
                user,
                OtpProvider,
                tokenName,
                value);

            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    "Unable to persist password-change OTP state.");
            }
        }

        private async Task ClearPasswordChangeOtpAsync(ApplicationUser user)
        {
            await _userManager.RemoveAuthenticationTokenAsync(
                user,
                OtpProvider,
                OtpHashName);

            await _userManager.RemoveAuthenticationTokenAsync(
                user,
                OtpProvider,
                OtpExpiresName);

            await _userManager.RemoveAuthenticationTokenAsync(
                user,
                OtpProvider,
                OtpLastSentName);

            await _userManager.RemoveAuthenticationTokenAsync(
                user,
                OtpProvider,
                OtpResendCountName);
        }

        private static string MaskEmail(string email)
        {
            var at = email.IndexOf('@');

            if (at <= 1)
                return email;

            var visible = email[..1];
            var domain = email[at..];

            return $"{visible}***{domain}";
        }

        private static List<MonthlyPerformanceDto> BuildMonthlyPerformance(
            List<TaskManagement.Domain.Entities.TaskItem> tasks)
        {
            var currentMonth = new DateTime(
                DateTime.UtcNow.Year,
                DateTime.UtcNow.Month,
                1);

            var months = new List<MonthlyPerformanceDto>();

            for (var offset = 5; offset >= 0; offset--)
            {
                var month = currentMonth.AddMonths(-offset);
                var nextMonth = month.AddMonths(1);

                var monthTasks = tasks
                    .Where(x =>
                        x.ExpectedEndDate >= month &&
                        x.ExpectedEndDate < nextMonth)
                    .ToList();

                var total = monthTasks.Count;
                var completed = monthTasks.Count(x =>
                    string.Equals(
                        x.Status,
                        "Completed",
                        StringComparison.OrdinalIgnoreCase));

                months.Add(new MonthlyPerformanceDto
                {
                    Month = month.ToString("MMM", CultureInfo.InvariantCulture),
                    TotalTasks = total,
                    CompletedTasks = completed,
                    CompletionRate = total == 0
                        ? 0
                        : Math.Round(completed * 100m / total, 1)
                });
            }

            return months;
        }
    }
}
