# Cloudinary profile picture setup

Profile pictures are now stored in Cloudinary instead of the local wwwroot/uploads/profiles folder.

The application supports either:
1. CLOUDINARY_URL environment variable, or
2. Cloudinary:CloudName, Cloudinary:ApiKey, and Cloudinary:ApiSecret configuration values.

For local development, prefer an environment variable or .NET user secrets so credentials are not committed to Git.

## Windows PowerShell

Set the Cloudinary URL for the current terminal session:

    $env:CLOUDINARY_URL="cloudinary://API_KEY:API_SECRET@CLOUD_NAME"
    dotnet run --project .\TaskManagement.WebApp

For a persistent user-level environment variable:

    [Environment]::SetEnvironmentVariable("CLOUDINARY_URL", "cloudinary://API_KEY:API_SECRET@CLOUD_NAME", "User")

Restart Visual Studio after setting a persistent environment variable.

## Cloudinary dashboard

Use the Cloudinary Dashboard to obtain the cloud name, API key and API secret.

Do not commit the API secret to appsettings.json, source control, or client-side JavaScript.

New profile pictures are stored under the profiles/<user-id> public ID. Uploading another picture for the same user replaces the previous Cloudinary asset. Removing the profile picture deletes the Cloudinary asset and clears ProfilePictureUrl.

Existing local /uploads/profiles/... URLs are not automatically migrated. Each user with an old local photo should upload the photo once after this change.