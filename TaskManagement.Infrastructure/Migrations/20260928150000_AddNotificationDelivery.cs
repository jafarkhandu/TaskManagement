using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Data.Migrations
{
    [Migration("20260928150000_AddNotificationDelivery")]
    public partial class AddNotificationDelivery : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDelivered",
                table: "Notifications",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_IsDelivered",
                table: "Notifications",
                columns: new[] { "UserId", "IsDelivered" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId_IsDelivered",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "IsDelivered",
                table: "Notifications");
        }
    }
}
