import nodemailer from 'nodemailer';

async function testSupport() {
  console.log('Testing support@websmithdigital.com with password...');
  const transporter = nodemailer.createTransport({
    host: 'mail.privateemail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'support@websmithdigital.com',
      pass: 'Rony@0403'
    },
    tls: { rejectUnauthorized: false }
  });

  try {
    await transporter.verify();
    console.log('SUCCESS with support@websmithdigital.com!');
  } catch (err) {
    console.error('FAILED with support@websmithdigital.com:', err.message);
  }
}

testSupport();
