using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs
{
    public class ProjectDto : IValidatableObject
    {
        public int Id { get; set; }
        [Required]
        public string ProjectTitle { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Required]
        public string Status { get; set; } = "Planning";

        [Required]
        public string TechStack { get; set; } = string.Empty;

        [Required]
        public DateTime StartDate { get; set; }

        [Required]
        public DateTime EndDate { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            var today = DateTime.Today;
            var startDate = StartDate.Date;
            var endDate = EndDate.Date;

            if (startDate < today)
            {
                yield return new ValidationResult(
                    "Start date cannot be in the past.",
                    new[] { nameof(StartDate) });
            }

            if (endDate < today)
            {
                yield return new ValidationResult(
                    "End date cannot be in the past.",
                    new[] { nameof(EndDate) });
            }

            if (endDate < startDate)
            {
                yield return new ValidationResult(
                    "End date cannot be earlier than the start date.",
                    new[] { nameof(EndDate) });
            }
        }
    }
}
