using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Configuration;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.Infrastructure.Services
{
    public sealed class CloudinaryProfilePictureStorage : IProfilePictureStorage
    {
        private readonly IConfiguration _configuration;

        public CloudinaryProfilePictureStorage(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<string> UploadAsync(
            Stream fileStream,
            string fileName,
            string userId,
            CancellationToken cancellationToken = default)
        {
            var cloudinary = CreateClient();

            var publicId = $"profiles/{userId}";

            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(fileName, fileStream),
                PublicId = publicId,
                Overwrite = true,
                UniqueFilename = false,
                UseFilename = false,
            };

            var result = await cloudinary.UploadAsync(uploadParams);

            cancellationToken.ThrowIfCancellationRequested();

            if (result == null || result.Error != null || string.IsNullOrWhiteSpace(result.SecureUrl?.ToString()))
            {
                throw new InvalidOperationException(
                    result?.Error?.Message ?? "Cloudinary could not upload the profile picture.");
            }

            return result.SecureUrl.ToString();
        }

        public async Task DeleteAsync(
            string userId,
            CancellationToken cancellationToken = default)
        {
            var cloudinary = CreateClient();

            var deletionParams = new DeletionParams($"profiles/{userId}")
            {
                ResourceType = ResourceType.Image
            };

            var result = await cloudinary.DestroyAsync(deletionParams);

            cancellationToken.ThrowIfCancellationRequested();

            if (result != null &&
                !string.Equals(result.Result, "ok", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(result.Result, "not found", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    result.Error?.Message ?? "Cloudinary could not remove the profile picture.");
            }
        }

        private Cloudinary CreateClient()
        {
            var cloudinaryUrl = Environment.GetEnvironmentVariable("CLOUDINARY_URL");

            if (!string.IsNullOrWhiteSpace(cloudinaryUrl))
            {
                var cloudinary = new Cloudinary(cloudinaryUrl)
                {
                    Api =
                    {
                        Secure = true
                    }
                };

                return cloudinary;
            }

            var cloudName = _configuration["Cloudinary:CloudName"];
            var apiKey = _configuration["Cloudinary:ApiKey"];
            var apiSecret = _configuration["Cloudinary:ApiSecret"];

            if (string.IsNullOrWhiteSpace(cloudName) ||
                string.IsNullOrWhiteSpace(apiKey) ||
                string.IsNullOrWhiteSpace(apiSecret))
            {
                throw new InvalidOperationException(
                    "Cloudinary is not configured. Set CLOUDINARY_URL or Cloudinary:CloudName, Cloudinary:ApiKey and Cloudinary:ApiSecret.");
            }

            var account = new Account(cloudName, apiKey, apiSecret);
            var configuredClient = new Cloudinary(account);
            configuredClient.Api.Secure = true;

            return configuredClient;
        }
    }
}
