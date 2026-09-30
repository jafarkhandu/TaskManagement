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
            upiId = upiId?.Trim();
            accountHolderName = accountHolderName?.Trim();
            bankName = bankName?.Trim();
            accountNumber = accountNumber?.Trim();
            ifscCode = ifscCode?.Trim().ToUpperInvariant();

            if (paymentMethod is not ("UPI" or "Bank"))
                return BadRequest(new { success = false, message = "Select a valid payment method." });

            if (paymentMethod == "UPI")
            {
                if (string.IsNullOrWhiteSpace(upiId) || !upiId.Contains('@'))
                    return BadRequest(new { success = false, message = "Enter your original and valid UPI ID." });

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
                        message = "Enter the complete bank account details."
                    });
                }

                if (accountNumber.Any(char.IsWhiteSpace) ||
                    accountNumber.Length < 6 ||
                    accountNumber.Length > 30)
                {
                    return BadRequest(new { success = false, message = "Enter a valid bank account number." });
                }

                if (ifscCode.Length != 11)
                    return BadRequest(new { success = false, message = "IFSC code must contain 11 characters." });

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
                message = "Payment details saved successfully.",
                updatedAt = details.UpdatedAt
            });
        }
    }
}
