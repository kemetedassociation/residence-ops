import nodemailer from "nodemailer";

let transporterPromise = null;

async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (process.env.SMTP_HOST) {
    transporterPromise = Promise.resolve({
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      }),
      isTest: false,
    });
    return transporterPromise;
  }

  transporterPromise = nodemailer.createTestAccount().then((account) => {
    console.log("[mailer] Aucun SMTP configuré : utilisation d'un compte de test Ethereal.");
    return {
      transporter: nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      }),
      isTest: true,
    };
  });

  return transporterPromise;
}

export async function sendMail({ to, subject, html, text }) {
  const { transporter, isTest } = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Résidence Ops" <no-reply@residence-ops.fr>',
    to,
    subject,
    text,
    html,
  });

  if (isTest) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[mailer] Email de test envoyé à ${to}. Aperçu : ${previewUrl}`);
    return { previewUrl };
  }

  return {};
}
