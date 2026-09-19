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
                    .IsRequired();

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
        }
    }
}