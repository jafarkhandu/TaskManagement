using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs
{
    public class TaskDto : IValidatableObject
    {
        public int Id { get; set; }

        [Required]
        public int ProjectId { get; set; }

        [Required]
        [StringLength(200)]
        public string Title { get; set; } = string.Empty;

        public string Scenario { get; set; } = string.Empty;

        [Required]
        public string AssignedToUserId { get; set; } = string.Empty;

        // Display-only: populated with the user's FullName or email as a fallback
        public string AssignedToUserName { get; set; } = string.Empty;

        // Latest assignment request state. This is separate from the actual task workflow status.
        public string AssignmentStatus { get; set; } = string.Empty;

        // Repository submitted by the user when the task was completed.
        public string? CompletionRepositoryUrl { get; set; }

        [Required]
        public string Priority { get; set; } = "Low";

        [Required]
        public string Status { get; set; } = "Pending";

        [Required]
        public DateTime StartDate { get; set; }

        [Required]
        public DateTime ExpectedEndDate { get; set; }

        // Set only when the task actually reaches Completed.
        public DateTime? CompletedAtUtc { get; set; }

        [Required]
        [Range(0, 9999999999.99)]
        public decimal Amount { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            var today = DateTime.Today;
            var startDate = StartDate.Date;
            var endDate = ExpectedEndDate.Date;

            if (startDate < today)
            {
                yield return new ValidationResult(
                    "Start date cannot be in the past.",
                    new[] { nameof(StartDate) });
            }

            if (endDate < today)
            {
                yield return new ValidationResult(
                    "Expected end date cannot be in the past.",
                    new[] { nameof(ExpectedEndDate) });
            }

            if (endDate < startDate)
            {
                yield return new ValidationResult(
                    "Expected end date cannot be earlier than the start date.",
                    new[] { nameof(ExpectedEndDate) });
            }
        }
    }
}
