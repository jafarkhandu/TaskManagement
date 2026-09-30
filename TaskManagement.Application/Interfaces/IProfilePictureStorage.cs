namespace TaskManagement.Application.Interfaces
{
    public interface IProfilePictureStorage
    {
        Task<string> UploadAsync(
            Stream fileStream,
            string fileName,
            string userId,
            CancellationToken cancellationToken = default);

        Task DeleteAsync(
            string userId,
            CancellationToken cancellationToken = default);
    }
}
