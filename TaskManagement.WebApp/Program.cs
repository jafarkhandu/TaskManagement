using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Interfaces;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;
using TaskManagement.Infrastructure.Services;
using TaskManagement.WebApp.Hubs;

var builder = WebApplication.CreateBuilder(args);

// MVC
builder.Services.AddControllersWithViews();
builder.Services.AddControllersWithViews().AddRazorRuntimeCompilation();
builder.Services.AddSignalR();

// Anti-forgery
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "RequestVerificationToken";
});

// Database
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(
     builder.Configuration.GetConnectionString(
         "DefaultConnection"
     ),
     sqlOptions =>
     {
         sqlOptions.EnableRetryOnFailure(
             maxRetryCount: 5,
             maxRetryDelay: TimeSpan.FromSeconds(10),
             errorNumbersToAdd: null
         );
     }
 );
});

// Identity
builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequiredLength = 6;
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = false;

        options.User.RequireUniqueEmail = true;

        options.Lockout.MaxFailedAccessAttempts = 5;

        options.Lockout.DefaultLockoutTimeSpan =
            TimeSpan.FromMinutes(10);

        options.SignIn.RequireConfirmedAccount = false;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// Cookie
builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Account/Login";

    options.AccessDeniedPath =
        "/Account/AccessDenied";

    options.ExpireTimeSpan =
        TimeSpan.FromDays(7);

    options.SlidingExpiration = true;
});

// Application services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<ITaskService, TaskService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<IProfilePictureStorage, CloudinaryProfilePictureStorage>();
builder.Services.AddScoped<EmailService>();

var app = builder.Build();

// Ensure the notification delivery column exists in the same database
// used by the running application. This is intentionally idempotent so
// it also repairs databases whose EF migration history is ahead of the
// physical schema.
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;

    var db = services.GetRequiredService<ApplicationDbContext>();

    await db.Database.MigrateAsync();

    await db.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID(N'dbo.Notifications', N'U') IS NOT NULL
           AND COL_LENGTH(N'dbo.Notifications', N'IsDelivered') IS NULL
        BEGIN
            ALTER TABLE [dbo].[Notifications]
            ADD [IsDelivered] bit NOT NULL
                CONSTRAINT [DF_Notifications_IsDelivered] DEFAULT (0);
        END;

        IF OBJECT_ID(N'dbo.Notifications', N'U') IS NOT NULL
           AND COL_LENGTH(N'dbo.Notifications', N'IsDelivered') IS NOT NULL
           AND NOT EXISTS
           (
               SELECT 1
               FROM sys.indexes
               WHERE name = N'IX_Notifications_UserId_IsDelivered'
                 AND object_id = OBJECT_ID(N'dbo.Notifications')
           )
        BEGIN
            CREATE INDEX [IX_Notifications_UserId_IsDelivered]
            ON [dbo].[Notifications] ([UserId], [IsDelivered]);
        END;
        """);

    await IdentitySeeder.SeedAsync(
        services,
        builder.Configuration);
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");

    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();

app.UseAuthorization();

app.MapHub<NotificationHub>("/notificationHub");
app.MapHub<ChatHub>("/chatHub");

app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Dashboard}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Account}/{action=Login}/{id?}");

app.Run();
