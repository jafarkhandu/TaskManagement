using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskReviewDeadlineSnapshotSafe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF OBJECT_ID(N'dbo.TaskReviews', N'U') IS NOT NULL
                   AND COL_LENGTH(N'dbo.TaskReviews', N'DeadlineAtSubmission') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[TaskReviews]
                    ADD [DeadlineAtSubmission] datetime2 NULL;
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF OBJECT_ID(N'dbo.TaskReviews', N'U') IS NOT NULL
                   AND COL_LENGTH(N'dbo.TaskReviews', N'DeadlineAtSubmission') IS NOT NULL
                BEGIN
                    ALTER TABLE [dbo].[TaskReviews]
                    DROP COLUMN [DeadlineAtSubmission];
                END;
                """);
        }
    }
}
