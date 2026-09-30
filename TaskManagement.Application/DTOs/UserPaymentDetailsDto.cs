namespace TaskManagement.Application.DTOs
{
    public class UserPaymentDetailsDto
    {
        public string PaymentMethod { get; set; } = string.Empty;
        public string? UpiId { get; set; }
        public string? AccountHolderName { get; set; }
        public string? BankName { get; set; }
        public string? AccountNumber { get; set; }
        public string? IfscCode { get; set; }
    }
}
