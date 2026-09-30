using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Domain.Entities;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;

namespace TaskManagement.WebApp.Areas.User.Controllers
{
    [Area("User")]
    [Authorize(Roles = "User")]
    public class PaymentDetailsController : Controller
    {
        private static readonly Regex UpiRegex =
            new(@"^[A-Za-z0-9][A-Za-z0-9._-]{1,254}@[A-Za-z][A-Za-z0-9.-]{1,63}$",
                RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly Regex NameRegex =
            new(@"^[A-Za-z][A-Za-z .'-]{1,99}$",
                RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly Regex BankNameRegex =
            new(@"^[A-Za-z0-9][A-Za-z0-9 &'().,-]{1,99}$",
                RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly Regex AccountNumberRegex =
            new(@"^[0-9]{9,18}$",
                RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly Regex IfscRegex =
            new(@"^[A-Z]{4}0[A-Z0-9]{6}$",
                RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public PaymentDetailsController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Challenge();

            var details = await _context.UserPaymentDetails
                .AsNoTracking()
                .SingleOrDefaultAsync(x => x.UserId == user.Id);

            return View(details);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Save(
            string paymentMethod,
            string? upiId,
            string? accountHolderName,
            string? bankName,
            string? accountNumber,
            string? ifscCode)
        {
            var user = await _userManager.GetUserAsync(User);

            if (user == null)
                return Unauthorized(new { success = false, message = "User session expired." });

            paymentMethod = paymentMethod?.Trim() ?? string.Empty;
            upiId = upiId?.Trim().ToLowerInvariant();
            accountHolderName = accountHolderName?.Trim();
            bankName = bankName?.Trim();
            accountNumber = accountNumber?.Trim();
            ifscCode = ifscCode?.Trim().ToUpperInvariant();

            if (paymentMethod is not ("UPI" or "Bank"))
                return BadRequest(new { success = false, message = "Select a valid payment method." });

            if (paymentMethod == "UPI")
            {
                if (string.IsNullOrWhiteSpace(upiId) || !UpiRegex.IsMatch(upiId))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Enter a valid UPI ID, for example name@upi."
                    });
                }

                accountHolderName = null;
                bankName = null;
                accountNumber = null;
                ifscCode = null;
            }
            else
            {
                if (string.IsNullOrWhiteSpace(accountHolderName) ||
                    string.IsNullOrWhiteSpace(bankName) ||
                    string.IsNullOrWhiteSpace(accountNumber) ||
                    string.IsNullOrWhiteSpace(ifscCode))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Enter all bank account details before saving."
                    });
                }

                if (!NameRegex.IsMatch(accountHolderName))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Account holder name contains invalid characters."
                    });
                }

                if (!BankNameRegex.IsMatch(bankName))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Enter a valid bank name."
                    });
                }

                if (!AccountNumberRegex.IsMatch(accountNumber))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Bank account number must contain 9 to 18 digits only."
                    });
                }

                if (!IfscRegex.IsMatch(ifscCode))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Enter a valid 11-character IFSC code."
                    });
                }

                upiId = null;
            }

            var details = await _context.UserPaymentDetails
                .SingleOrDefaultAsync(x => x.UserId == user.Id);

            if (details == null)
            {
                details = new UserPaymentDetails
                {
                    UserId = user.Id
                };

                _context.UserPaymentDetails.Add(details);
            }

            details.PaymentMethod = paymentMethod;
            details.UpiId = upiId;
            details.AccountHolderName = accountHolderName;
            details.BankName = bankName;
            details.AccountNumber = accountNumber;
            details.IfscCode = ifscCode;
            details.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Json(new
            {
                success = true,
                message = "Details validated and saved successfully.",
                updatedAt = details.UpdatedAt
            });
        }
    }
}