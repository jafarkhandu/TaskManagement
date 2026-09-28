using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Data.Migrations
{
    [Migration("20260928170000_FixNotificationDeliverySchema")]
    public partial class FixNotificationDeliverySchema : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF COL_LENGTH(N'dbo.Notifications', N'IsDelivered') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[Notifications]
                    ADD [IsDelivered] bit NOT NULL
                        CONSTRAINT [DF_Notifications_IsDelivered] DEFAULT (0);
                END;

                IF NOT EXISTS
                (
                    SELECT 1
                    FROM sys.indexes
                    WHERE name = N'IX_Notifications_UserId_IsDelivered'
                      AND object_id = OBJECT_ID(N'[dbo].[Notifications]')
                )
                BEGIN
                    CREATE INDEX [IX_Notifications_UserId_IsDelivered]
                    ON [dbo].[Notifications] ([UserId], [IsDelivered]);
                END;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
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
                END;

                IF COL_LENGTH(N'dbo.Notifications', N'IsDelivered') IS NOT NULL
                BEGIN
                    ALTER TABLE [dbo].[Notifications]
                    DROP CONSTRAINT IF EXISTS [DF_Notifications_IsDelivered];

                    ALTER TABLE [dbo].[Notifications]
                    DROP COLUMN [IsDelivered];
                END;
                """);
        }
    }
}
