import nodemailer from 'nodemailer';

async function testNamecheap() {
  console.log('Testing Namecheap PrivateEmail connection...');
  const transporter = nodemailer.createTransport({
    host: 'mail.privateemail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'no-reply@websmithdigital.com',
      pass: 'Rony@0403'
    },
    tls: { rejectUnauthorized: false }
  });

  try {
    await transporter.verify();
    console.log('SUCCESS: Namecheap PrivateEmail SMTP verified successfully!');

    // Send a test email to digitalwebsmith@gmail.com
    const info = await transporter.sendMail({
      from: '"Websmith Digital" <no-reply@websmithdigital.com>',
      replyTo: 'support@websmithdigital.com',
      to: 'digitalwebsmith@gmail.com',
      subject: 'Test Email from Namecheap PrivateEmail',
      text: 'This email is sent directly from no-reply@websmithdigital.com via Namecheap PrivateEmail SMTP!',
      html: '<b>This email is sent directly from no-reply@websmithdigital.com via Namecheap PrivateEmail SMTP!</b>'
    });
    console.log('SUCCESS: Email sent! MessageId:', info.messageId);
  } catch (err) {
    console.error('FAILED: Namecheap PrivateEmail error:', err);
  }
}

testNamecheap();
