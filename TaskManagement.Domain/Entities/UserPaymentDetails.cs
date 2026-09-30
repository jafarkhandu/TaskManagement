namespace TaskManagement.Domain.Entities
{
    public class UserPaymentDetails
    {
        public int Id { get; set; }

        public string UserId { get; set; } = string.Empty;

        public string PaymentMethod { get; set; } = string.Empty;

        public string? UpiId { get; set; }

        public string? AccountHolderName { get; set; }

        public string? BankName { get; set; }

        public string? AccountNumber { get; set; }

        public string? IfscCode { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
