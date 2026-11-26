'use strict';

const path = require('path');
const dns = require('dns').promises;
const express = require('express');
const nodemailer = require('nodemailer');
const { validateContact, REASONS } = require('./lib/validate');
const { createLimiter } = require('./lib/ratelimit');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'; base-uri 'self'"
  );
  next();
});

app.get('/healthz', (req, res) => {
  res.type('text/plain').send('ok');
});

/* ---------- البريد (SMTP) ---------- */
const REQUIRED_ENV = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_TO'];
function mailConfigured() {
  return REQUIRED_ENV.every((k) => process.env[k]);
}

// Render لا يدعم IPv6 في الاتصالات الصادرة، وGmail يعيد عنوان IPv6 أولا.
// نحلّ اسم الخادم إلى IPv4 ونتصل بالعنوان مباشرة، ونبقي اسم المضيف للتحقق من الشهادة.
async function createTransport() {
  const host = process.env.SMTP_HOST;
  let address = host;
  try {
    const ips = await dns.resolve4(host);
    if (ips.length) address = ips[0];
  } catch (err) {
    console.warn('تعذّر حل IPv4 لخادم SMTP، سيُستخدم الاسم كما هو:', err && err.code);
  }
  return nodemailer.createTransport({
    host: address,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { servername: host },
    connectionTimeout: 10000,
    socketTimeout: 15000
  });
}

/* ---------- نموذج الاتصال ---------- */
const contactLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

app.post(
  '/api/contact',
  contactLimiter,
  express.json({ limit: '10kb' }),
  async (req, res) => {
    const { data, errors, isBot } = validateContact(req.body);

    // الحقل المخفي: الروبوتات تملؤه. نردّ بنجاح شكلي دون إرسال.
    if (isBot) return res.json({ ok: true });

    if (Object.keys(errors).length) {
      return res.status(400).json({
        ok: false,
        message: 'راجع الحقول المعلَّمة ثم أعد الإرسال.',
        errors
      });
    }

    if (!mailConfigured()) {
      console.error('إعدادات SMTP ناقصة: تحقق من متغيرات البيئة.');
      return res.status(503).json({
        ok: false,
        message: 'خدمة الرسائل غير متاحة الآن. حاول لاحقا.'
      });
    }

    const text = [
      `الاسم: ${data.name}`,
      `البريد: ${data.email}`,
      `الهاتف: ${data.phone || '—'}`,
      `السبب: ${REASONS[data.reason]}`,
      `الوقت: ${new Date().toISOString()}`,
      '',
      data.message
    ].join('\n');

    try {
      const transporter = await createTransport();
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: process.env.MAIL_TO,
        replyTo: { name: data.name, address: data.email },
        subject: `وين نروح؟ | ${REASONS[data.reason]} | ${data.name}`,
        text
      });
      return res.json({ ok: true });
    } catch (err) {
      console.error('فشل إرسال البريد:', err && err.message);
      return res.status(502).json({
        ok: false,
        message: 'تعذّر إرسال رسالتك. حاول مجددا بعد قليل.'
      });
    }
  }
);

/* ---------- الملفات الثابتة و404 ---------- */
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    maxAge: '1h'
  })
);

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

app.use((err, req, res, next) => {
  if (req.path.startsWith('/api/')) {
    if (err && (err.type === 'entity.parse.failed' || err.status === 400)) {
      return res.status(400).json({ ok: false, message: 'صيغة الطلب غير صحيحة.' });
    }
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ ok: false, message: 'الطلب كبير جدا.' });
    }
    console.error(err);
    return res.status(500).json({ ok: false, message: 'خطأ في الخادم.' });
  }
  console.error(err);
  res.status(500).type('text/plain; charset=utf-8').send('خطأ في الخادم.');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`الخادم يعمل على المنفذ ${PORT}`);
  if (!mailConfigured()) {
    console.warn('تنبيه: متغيرات SMTP غير مضبوطة، لن يعمل إرسال النموذج.');
  }
});
