//using System;
//using System.Collections.Generic;
//using System.Text;
using TaskManagement.Application.DTOs;
using TaskManagement.Application.Interfaces;
using TaskManagement.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace TaskManagement.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;

        public AuthService(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager)
        {
            _userManager = userManager;
            _signInManager = signInManager;
        }

        public async Task<(bool Success, string Error)> RegisterAsync(
            RegisterDto model)
        {
            var existingUser =
                await _userManager.FindByEmailAsync(model.Email);

            if (existingUser != null)
            {
                return (false, "Email already exists.");
            }

            var existingUsername =
                await _userManager.FindByNameAsync(model.FullName);

            if (existingUsername != null)
            {
                return (false, "This Full Name is already registered.");
            }

            var user = new ApplicationUser
            {
                UserName = model.FullName,
                Email = model.Email,
                FullName = model.FullName,
                IsActive = false
            };

            // Create pending user without password.
            var result = await _userManager.CreateAsync(user);

            if (!result.Succeeded)
            {
                var errors = string.Join(
                    " ",
                    result.Errors.Select(x => x.Description));

                return (false, errors);
            }

            return (true, string.Empty);
        }

        public async Task<(bool Success, string Error)> LoginAsync(
            LoginDto model)
        {
            var user =
                await _userManager.FindByEmailAsync(model.Email);

            if (user == null)
            {
                return (false, "Invalid email or password.");
            }

            // Block login if account is not active (pending or deactivated)
            if (!user.IsActive)
            {
                return (
                    false,
                    "Your account is pending activation. You will be notified when your account is activated."
                );
            }

            var result =
                await _signInManager.PasswordSignInAsync(
                    user,
                    model.Password,
                    model.RememberMe,
                    lockoutOnFailure: true);

            if (result.Succeeded)
            {
                return (true, string.Empty);
            }

            if (result.IsLockedOut)
            {
                return (
                    false,
                    "Your account is temporarily locked.");
            }

            if (result.IsNotAllowed)
            {
                return (
                    false,
                    "Login is not allowed for this account.");
            }

            return (false, "Invalid email or password.");
        }

        public async Task LogoutAsync()
        {
            await _signInManager.SignOutAsync();
        }
    }
}