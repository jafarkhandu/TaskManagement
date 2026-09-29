using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Data.Migrations
{
    [Migration("20260929130000_RepairMissingSchemaColumns")]
    public partial class RepairMissingSchemaColumns : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH(N'dbo.AspNetUsers', N'ProfilePictureUrl') IS NULL
BEGIN
    ALTER TABLE [dbo].[AspNetUsers]
    ADD [ProfilePictureUrl] nvarchar(max) NULL;
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH(N'dbo.Notifications', N'IsDelivered') IS NULL
BEGIN
    ALTER TABLE [dbo].[Notifications]
    ADD [IsDelivered] bit NOT NULL
        CONSTRAINT [DF_Notifications_IsDelivered_Repair] DEFAULT (0);
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH(N'dbo.Notifications', N'IsDelivered') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM sys.indexes
       WHERE name = N'IX_Notifications_UserId_IsDelivered'
         AND object_id = OBJECT_ID(N'[dbo].[Notifications]')
   )
BEGIN
    CREATE INDEX [IX_Notifications_UserId_IsDelivered]
    ON [dbo].[Notifications] ([UserId], [IsDelivered]);
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Notifications_UserId_IsDelivered'
      AND object_id = OBJECT_ID(N'[dbo].[Notifications]')
)
BEGIN
    DROP INDEX [IX_Notifications_UserId_IsDelivered]
    ON [dbo].[Notifications];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH(N'dbo.Notifications', N'IsDelivered') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[Notifications]
    DROP CONSTRAINT IF EXISTS [DF_Notifications_IsDelivered_Repair];

    ALTER TABLE [dbo].[Notifications]
    DROP COLUMN [IsDelivered];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH(N'dbo.AspNetUsers', N'ProfilePictureUrl') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[AspNetUsers]
    DROP COLUMN [ProfilePictureUrl];
END
");
        }
    }
}
