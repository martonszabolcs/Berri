/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

interface EmailTemplateData {
  title: string;
  heading: string;
  message: string;
  buttonText?: string;
  buttonUrl?: string;
  additionalInfo?: string;
  footerNote?: string;
}

@Injectable()
export class EmailService {
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    const smtpConfig: any = {
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
    };

    // Only add auth if user and password are provided (not needed for MailHog)
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');

    if (smtpUser && smtpPassword) {
      smtpConfig.auth = {
        user: smtpUser,
        pass: smtpPassword,
      };
    }

    this.transporter = nodemailer.createTransport(smtpConfig);
  }

  private getEmailTemplate(data: EmailTemplateData): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #000;
          background-color: #fff;
          margin: 0;
          padding: 20px;
        }

        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
        }

        .email-title {
          font-size: 24px;
          font-weight: bold;
          text-align: center;
          margin: 20px 0;
        }

        .email-content {
          padding: 20px;
        }

        .message {
          font-size: 16px;
          color: #000;
          margin-bottom: 20px;
        }

        .cta-button {
          display: inline-block;
          background: #fff;
          color: #000;
          text-decoration: none;
          padding: 10px 20px;
          border: 2px solid #000;
          border-radius: 4px;
          font-weight: bold;
          text-align: center;
          margin: 20px auto;
        }

        .cta-button:hover {
          background: #000;
          color: #fff;
        }

        .email-footer {
          background: #f1f1f1;
          padding: 20px;
          text-align: center;
          font-size: 14px;
          color: #555;
          border-top: 1px solid #ddd;
        }

        a {
          color: inherit;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <h1 class="email-title">${data.heading}</h1>

        <div class="email-content">
          <div class="message">${data.message}</div>

          ${data.buttonText && data.buttonUrl ? `
            <div style="text-align: center;">
              <a href="${data.buttonUrl}" class="cta-button">${data.buttonText}</a>
            </div>
          ` : ''}
        </div>

        <div class="email-footer">
          Best regards,<br>
          Berri Book<br>
          <br>
          This email is automatically generated.
        </div>
      </div>
    </body>
    </html>
    `;
  }

  async sendEmailVerification(email: string, token: string) {
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    const verificationUrl = `${backendUrl}/auth/verify-email/${token}`;

    const templateData: EmailTemplateData = {
      title: 'Email Verification - Berri App',
      heading: 'Verify Your Email',
      message:
        'Thank you for registering with the Berri App! To verify your email address, click the button below or use the provided verification code.',
      buttonText: 'Verify Email',
      buttonUrl: verificationUrl,
      additionalInfo: `<div class="code-display">Verification Code: ${token}</div>`,
      footerNote:
        'If you did not sign up for this account, please ignore this email.',
    };

    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM'),
      to: email,
      subject: 'Email Verification - Berri App',
      html: this.getEmailTemplate(templateData),
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendPasswordReset(email: string, token: string) {

    const templateData: EmailTemplateData = {
      title: 'Password Reset - Berri App',
      heading: 'Password Reset',
      message:
        'We received a request to reset the password for your account. If you initiated this request, click the button below to change your password.',
      //buttonText: 'Reset Password',
      //buttonUrl: resetUrl,
      additionalInfo: `<div class="code-display">Reset Code: ${token}</div><p style="color: #e74c3c; font-weight: 600;">⏰ This link will expire in 1 hour!</p>`,
      footerNote:
        'If you did not request a password reset, please ignore this email.',
    };

    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM'),
      to: email,
      subject: 'Password Reset - Berri App',
      html: this.getEmailTemplate(templateData),
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendPasswordResetConfirmation(email: string) {
    const templateData: EmailTemplateData = {
      title: 'Password Successfully Changed - Berri App',
      heading: 'Password Changed',
      message:
        'Your password has been successfully updated! You can now sign in to the Berri App using your new password.',
      additionalInfo:
        '<p style="color: #e74c3c; font-weight: 600;">🛡️ If you did not change your password, please contact us immediately!</p>',
      footerNote:
        'For your account\'s security, never share your password with anyone.',
    };

    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM'),
      to: email,
      subject: 'Password Successfully Changed - Berri App',
      html: this.getEmailTemplate(templateData),
    };

    return this.transporter.sendMail(mailOptions);
  }

  async testEmail(email: string) {
    const templateData: EmailTemplateData = {
      title: 'Test Email - Berri App',
      heading: 'Test Email',
      message:
        'This is a test email from the Berri App mail system. If you are seeing this email, everything is working correctly!',
      additionalInfo: `<p><strong>📅 Sent at:</strong> ${new Date().toLocaleString('en-US')}</p><p><strong>🔧 MailHog status:</strong> ✅ Active and functional</p>`,
      footerNote: 'This was just a test email — no further action is required.',
    };

    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM'),
      to: email,
      subject: 'Test Email - Berri App',
      html: this.getEmailTemplate(templateData),
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendFileByEmail(
    recipientEmail: string,
    fileBuffer: Buffer,
    fileName: string,
    subject?: string,
    message?: string,
  ): Promise<{ messageId: string }> {
    const templateData: EmailTemplateData = {
      title: subject || 'Document Sending - Berri App',
      heading: 'Document Sending',
      message:
        message ||
        'You can find your scanned document attached, sent via the Berri App.',
      additionalInfo: `<p><strong>📄 File Name:</strong> ${fileName}</p><p><strong>📅 Sent At:</strong> ${new Date().toLocaleString('en-US')}</p>`,
      footerNote: 'This is an automatically generated email from the Berri App.',
    };

    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM'),
      to: recipientEmail,
      subject: subject || 'Document Sending - Berri App',
      html: this.getEmailTemplate(templateData),
      attachments: [
        {
          filename: fileName,
          content: fileBuffer,
        },
      ],
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendMultipleFilesByEmail(
    recipientEmail: string,
    files: Express.Multer.File[],
    subject?: string,
    message?: string,
  ): Promise<{ messageId: string }> {
    const fileNames = files.map((f) => f.originalname).join(', ');
    
    const templateData: EmailTemplateData = {
      title: subject || 'Documents Sending - Berri App',
      heading: 'Documents Sending',
      message:
        message ||
        'You can find your scanned documents attached, sent via the Berri App.',
      additionalInfo: `<p><strong>Files (${files.length}):</strong> ${fileNames}</p><p><strong>Sent At:</strong> ${new Date().toLocaleString('en-US')}</p>`,
      footerNote: 'This is an automatically generated email from the Berri App.',
    };

    const attachments = files.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
    }));

    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM'),
      to: recipientEmail,
      subject: subject || 'Documents Sending - Berri App',
      html: this.getEmailTemplate(templateData),
      attachments,
    };

    return this.transporter.sendMail(mailOptions);
  }
}