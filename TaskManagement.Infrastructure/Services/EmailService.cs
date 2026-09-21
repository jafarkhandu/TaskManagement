using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Mail;

namespace TaskManagement.Infrastructure.Services
{
    public class EmailService
    {
        private readonly IConfiguration _configuration;

        public EmailService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task SendEmailAsync(
            string toEmail,
            string subject,
            string body)
        {
            var email =
                _configuration["EmailSettings:Email"];

            var password =
                _configuration["EmailSettings:Password"];

            var host =
                _configuration["EmailSettings:Host"];

            var port =
                int.Parse(
                    _configuration["EmailSettings:Port"]!);

            using var message = new MailMessage();

            message.From = new MailAddress(email!);
            message.To.Add(toEmail);
            message.Subject = subject;
            message.Body = body;
            message.IsBodyHtml = true;

            using var client =
                new SmtpClient(host, port);

            client.EnableSsl = true;

            client.Credentials =
                new NetworkCredential(
                    email,
                    password);

            await client.SendMailAsync(message);
        }
    }
}