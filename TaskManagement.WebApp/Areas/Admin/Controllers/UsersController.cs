using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace TaskManagement.WebApp.Areas.Admin.Controllers
{
    [Area("Admin")]
    [Authorize(Roles = "Admin")]
    public class UsersController : Controller
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;

        public UsersController(
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole> roleManager)
        {
            _userManager = userManager;
            _roleManager = roleManager;
        }

        // GET: /Admin/Users
        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var users = await _userManager.Users
                .OrderBy(u => u.FullName)
                .ThenBy(u => u.Email)
                .ToListAsync();

            return View(users);
        }

        [HttpGet]
        public async Task<IActionResult> Manage(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return NotFound();
            }

            var user = await _userManager.FindByIdAsync(id);

            if (user == null)
            {
                return NotFound();
            }

            return View(user);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Update(
        string id,
        string fullName,
        string email,
        string phoneNumber,
        string role)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return NotFound();
            }

            var user = await _userManager.FindByIdAsync(id);

            if (user == null)
            {
                return NotFound();
            }

            fullName = fullName?.Trim() ?? string.Empty;
            email = email?.Trim() ?? string.Empty;
            phoneNumber = phoneNumber?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(fullName))
            {
                TempData["ErrorMessage"] = "Full Name is required.";

                return RedirectToAction(
                    "Manage",
                    "Users",
                    new { area = "Admin", id });
            }

            if (string.IsNullOrWhiteSpace(email))
            {
                TempData["ErrorMessage"] = "Email is required.";

                return RedirectToAction(
                    "Manage",
                    "Users",
                    new { area = "Admin", id });
            }

            if (!string.IsNullOrEmpty(phoneNumber))
            {
                var isValidPhone =
                    phoneNumber.All(char.IsDigit) &&
                    phoneNumber.Length >= 10 &&
                    phoneNumber.Length <= 15;

                if (!isValidPhone)
                {
                    TempData["ErrorMessage"] =
                        "Please enter a valid phone number.";

                    return RedirectToAction(
                        "Manage",
                        "Users",
                        new { area = "Admin", id });
                }
            }

            user.FullName = fullName;

            var emailResult =
                await _userManager.SetEmailAsync(user, email);

            if (!emailResult.Succeeded)
            {
                TempData["ErrorMessage"] =
                    string.Join(
                        " ",
                        emailResult.Errors.Select(e => e.Description));

                return RedirectToAction(
                    "Manage",
                    "Users",
                    new { area = "Admin", id });
            }

            user.PhoneNumber =
                string.IsNullOrWhiteSpace(phoneNumber)
                    ? null
                    : phoneNumber;

            var updateResult =
                await _userManager.UpdateAsync(user);

            if (!updateResult.Succeeded)
            {
                TempData["ErrorMessage"] =
                    string.Join(
                        " ",
                        updateResult.Errors.Select(e => e.Description));

                return RedirectToAction(
                    "Manage",
                    "Users",
                    new { area = "Admin", id });
            }

            TempData["SuccessMessage"] =
                "User updated successfully.";
            // Role update handling
            role = role?.Trim();

            // Protect Admin account from role changes
            if (await _userManager.IsInRoleAsync(user, "Admin"))
            {
                // Do not allow changing Admin role
                return RedirectToAction(
                    "Manage",
                    "Users",
                    new { area = "Admin", id });
            }

            // Accept only User or Manager as selectable roles
            var desiredRole = string.IsNullOrWhiteSpace(role) ? null : (role == "Manager" ? "Manager" : "User");

            if (!string.IsNullOrWhiteSpace(desiredRole))
            {
                // Ensure role exists
                if (!await _roleManager.RoleExistsAsync(desiredRole))
                {
                    await _roleManager.CreateAsync(new IdentityRole(desiredRole));
                }

                var currentRoles = await _userManager.GetRolesAsync(user);
                var currentRole = currentRoles.FirstOrDefault();

                if (!string.Equals(currentRole, desiredRole, StringComparison.OrdinalIgnoreCase))
                {
                    // Remove any non-admin roles and add the desired one
                    var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);

                    if (!removeResult.Succeeded)
                    {
                        TempData["ErrorMessage"] = string.Join(" ", removeResult.Errors.Select(e => e.Description));

                        return RedirectToAction(
                            "Manage",
                            "Users",
                            new { area = "Admin", id });
                    }

                    var addResult = await _userManager.AddToRoleAsync(user, desiredRole);

                    if (!addResult.Succeeded)
                    {
                        TempData["ErrorMessage"] = string.Join(" ", addResult.Errors.Select(e => e.Description));

                        return RedirectToAction(
                            "Manage",
                            "Users",
                            new { area = "Admin", id });
                    }
                }
            }

            return RedirectToAction(
                "Manage",
                "Users",
                new { area = "Admin", id });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return NotFound();
            }

            var currentUserId = _userManager.GetUserId(User);

            if (currentUserId == id)
            {
                TempData["ErrorMessage"] = "You cannot delete your own account.";

                return RedirectToAction(
                    "Manage",
                    "Users",
                    new
                    {
                        area = "Admin",
                        id
                    });
            }

            var user = await _userManager.FindByIdAsync(id);

            if (user == null)
            {
                TempData["ErrorMessage"] = "User not found.";

                return RedirectToAction(
                    "Index",
                    "Users",
                    new { area = "Admin" });
            }

            // Prevent deleting the system Admin
            if (await _userManager.IsInRoleAsync(user, "Admin"))
            {
                TempData["ErrorMessage"] = "Unable to delete the system administrator.";

                return RedirectToAction(
                    "Manage",
                    "Users",
                    new
                    {
                        area = "Admin",
                        id
                    });
            }

            var result = await _userManager.DeleteAsync(user);

            if (!result.Succeeded)
            {
                TempData["ErrorMessage"] =
                    "Unable to delete this user.";

                return RedirectToAction(
                    "Manage",
                    "Users",
                    new
                    {
                        area = "Admin",
                        id
                    });
            }

            TempData["SuccessMessage"] =
                "User deleted successfully.";

            return RedirectToAction(
                "Index",
                "Users",
            new { area = "Admin" });
        }
    }
}