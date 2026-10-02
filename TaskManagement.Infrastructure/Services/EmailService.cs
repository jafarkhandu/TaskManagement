using Microsoft.Extensions.Configuration;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace TaskManagement.Infrastructure.Services
{
    public class EmailService
    {
        private readonly IConfiguration _configuration;

        public EmailService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            var email = _configuration["EmailSettings:EmailId"];
            var password = _configuration["EmailSettings:Password"];
            var host = _configuration["EmailSettings:Host"];
            var port = int.Parse(_configuration["EmailSettings:Port"]!);
            var useSsl = bool.TryParse(
                _configuration["EmailSettings:UseSSL"],
                out var configuredUseSsl)
                ? configuredUseSsl
                : port == 465;

            var message = new MimeMessage();

            message.From.Add(
                new MailboxAddress(
                    _configuration["EmailSettings:Name"],
                    email));

            message.To.Add(
                MailboxAddress.Parse(toEmail));

            message.Subject = subject;

            message.Body = new BodyBuilder
            {
                HtmlBody = body
            }.ToMessageBody();

            using var client = new MailKit.Net.Smtp.SmtpClient();

            var secureSocketOptions = useSsl
                ? port == 465
                    ? SecureSocketOptions.SslOnConnect
                    : SecureSocketOptions.StartTls
                : SecureSocketOptions.None;

            await client.ConnectAsync(
                host,
                port,
                secureSocketOptions);

            await client.AuthenticateAsync(
                email,
                password);

            await client.SendAsync(message);

            await client.DisconnectAsync(true);
        }
    }
}