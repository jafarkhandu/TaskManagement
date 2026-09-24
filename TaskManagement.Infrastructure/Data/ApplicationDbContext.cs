using TaskManagement.Domain.Entities;
using TaskManagement.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace TaskManagement.Infrastructure.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(
            DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Project> Projects { get; set; }

        public DbSet<TaskItem> TaskItems { get; set; }

        public DbSet<TaskAssignment> TaskAssignments { get; set; }

        public DbSet<Notification> Notifications { get; set; }

        public DbSet<ChatSession> ChatSessions { get; set; }

        public DbSet<ChatMessage> ChatMessages { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Configure TaskItem
            builder.Entity<TaskItem>(b =>
            {
                // Amount precision
                b.Property(t => t.Amount)
                    .HasColumnType("decimal(18,2)");

                // Ensure AssignedToUserId is compatible with Identity user Id (nvarchar(450))
                b.Property<string>(nameof(TaskItem.AssignedToUserId))
                    .HasMaxLength(450)
                    .IsRequired(false);

                // Indexes for foreign keys
                b.HasIndex(t => t.ProjectId);
                b.HasIndex(t => t.AssignedToUserId);

                // Relationship: TaskItem.ProjectId -> Projects.Id (cascade on delete as before)
                b.HasOne<Domain.Entities.Project>()
                    .WithMany()
                    .HasForeignKey(t => t.ProjectId)
                    .OnDelete(DeleteBehavior.Cascade);

                // Relationship: TaskItem.AssignedToUserId -> AspNetUsers.Id (restrict delete)
                b.HasOne<TaskManagement.Infrastructure.Identity.ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(t => t.AssignedToUserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<TaskAssignment>(b =>
            {
                b.Property(x => x.UserId)
                    .HasMaxLength(450)
                    .IsRequired();

                b.Property(x => x.Status)
                    .HasMaxLength(20)
                    .IsRequired();

                b.HasIndex(x => x.TaskId);

                b.HasIndex(x => x.UserId);

                b.HasOne<TaskItem>()
                    .WithMany()
                    .HasForeignKey(x => x.TaskId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<Notification>(b =>
            {
                b.Property(x => x.UserId)
                    .HasMaxLength(450)
                    .IsRequired();

                b.Property(x => x.Type)
                    .HasMaxLength(50)
                    .IsRequired();

                b.Property(x => x.Title)
                    .HasMaxLength(200)
                    .IsRequired();

                b.HasIndex(x => x.UserId);

                b.HasIndex(x => new
                {
                    x.UserId,
                    x.IsRead
                });

                b.HasOne<TaskAssignment>()
                    .WithMany()
                    .HasForeignKey(x => x.TaskAssignmentId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<ChatSession>(b =>
            {
                b.Property(x => x.UserId)
                    .HasMaxLength(450)
                    .IsRequired();

                b.Property(x => x.AdminId)
                    .HasMaxLength(450)
                    .IsRequired();

                b.HasIndex(x => x.TaskId);

                b.HasIndex(x => x.UserId);

                b.HasIndex(x => x.AdminId);

                b.HasIndex(x => new
                {
                    x.TaskId,
                    x.UserId,
                    x.IsActive
                });

                b.HasOne<TaskItem>()
                    .WithMany()
                    .HasForeignKey(x => x.TaskId)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne<TaskManagement.Infrastructure.Identity.ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Restrict);

                b.HasOne<TaskManagement.Infrastructure.Identity.ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(x => x.AdminId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            builder.Entity<ChatMessage>(b =>
            {
                b.Property(x => x.SenderId)
                    .HasMaxLength(450)
                    .IsRequired();

                b.Property(x => x.Message)
                    .HasMaxLength(4000)
                    .IsRequired();

                b.HasIndex(x => x.ChatSessionId);

                b.HasIndex(x => x.SenderId);

                b.HasOne<ChatSession>()
                    .WithMany()
                    .HasForeignKey(x => x.ChatSessionId)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne<TaskManagement.Infrastructure.Identity.ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(x => x.SenderId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
        }
    }
}