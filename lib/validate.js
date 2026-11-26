'use strict';

const REASONS = {
  inquiry: 'استفسار عن فعالية',
  suggest: 'اقتراح فعالية',
  organizer: 'تسجيل منظّم',
  other: 'أخرى'
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s().-]{8,20}$/;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(value) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_RE, '').replace(/\r\n?/g, '\n').trim();
}

function singleLine(value) {
  return clean(value).replace(/\s*\n\s*/g, ' ');
}

function validateContact(body) {
  const b = body && typeof body === 'object' ? body : {};
  const data = {
    name: singleLine(b.name),
    email: singleLine(b.email).toLowerCase(),
    phone: singleLine(b.phone),
    reason: clean(b.reason),
    message: clean(b.message)
  };
  const errors = {};

  if (data.name.length < 2 || data.name.length > 80) {
    errors.name = 'اكتب اسمك الكامل (من حرفين إلى 80 حرفا).';
  }
  if (data.email.length > 254 || !EMAIL_RE.test(data.email)) {
    errors.email = 'اكتب بريدا إلكترونيا صحيحا، مثل name@example.com.';
  }
  if (data.phone && !PHONE_RE.test(data.phone)) {
    errors.phone = 'رقم الهاتف غير صحيح. استخدم أرقاما فقط، ويمكن إضافة + في البداية.';
  }
  if (!Object.prototype.hasOwnProperty.call(REASONS, data.reason)) {
    errors.reason = 'اختر سبب الرسالة من القائمة.';
  }
  if (data.message.length < 10 || data.message.length > 1000) {
    errors.message = 'الرسالة بين 10 و1000 حرف.';
  }

  return {
    data,
    errors,
    isBot: clean(b.website) !== ''
  };
}

module.exports = { validateContact, REASONS };
