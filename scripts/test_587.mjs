import nodemailer from 'nodemailer';

async function test587() {
  console.log('Testing port 587 with no-reply@websmithdigital.com...');
  const transporter = nodemailer.createTransport({
    host: 'mail.privateemail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'no-reply@websmithdigital.com',
      pass: 'Rony@0403'
    },
    tls: { rejectUnauthorized: false }
  });

  try {
    await transporter.verify();
    console.log('SUCCESS on port 587!');
  } catch (err) {
    console.error('FAILED on port 587:', err.message);
  }
}

test587();
