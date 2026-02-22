const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
      port: process.env.EMAIL_PORT || 2525,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  /**
   * Send an email
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} text - Email body (plain text)
   * @param {string} html - Email body (HTML)
   * @returns {Promise<boolean>} Success status
   */
  async sendEmail(to, subject, text, html) {
    try {
      if (!to) {
        console.warn('No recipient email provided, skipping email notification');
        return false;
      }

      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('Email credentials not set, skipping email notification');
        return false;
      }

      const info = await this.transporter.sendMail({
        from: `"Vesting Vault" <${process.env.EMAIL_FROM || 'no-reply@vestingvault.com'}>`,
        to,
        subject,
        text,
        html,
      });

      console.log('Email sent: %s', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error.message);
      return false;
    }
  }

  /**
   * Send cliff passed notification
   * @param {string} to - Recipient email
   * @param {string} amount - Claimable amount
   * @returns {Promise<boolean>} Success status
   */
  async sendCliffPassedEmail(to, amount) {
    const subject = 'Your Cliff has passed!';
    const text = `Your Cliff has passed! You can now claim ${parseFloat(amount).toLocaleString()} tokens.`;
    const html = `<p>Your Cliff has passed! You can now claim <strong>${parseFloat(amount).toLocaleString()}</strong> tokens.</p>`;
    
    return await this.sendEmail(to, subject, text, html);
  }
}

module.exports = new EmailService();
