(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;

  var statusBox = document.getElementById('form-status');
  var submitBtn = form.querySelector('button[type="submit"]');
  var message = document.getElementById('message');
  var counter = document.getElementById('message-counter');

  var REASONS = ['inquiry', 'suggest', 'organizer', 'other'];
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE_RE = /^\+?[0-9\s().-]{8,20}$/;
  var FIELDS = ['name', 'email', 'phone', 'reason', 'message'];

  function val(id) {
    return (document.getElementById(id).value || '').replace(/\r\n?/g, '\n').trim();
  }

  function validate() {
    var e = {};
    var name = val('name');
    var email = val('email');
    var phone = val('phone');
    var msg = val('message');

    if (name.length < 2 || name.length > 80) e.name = 'اكتب اسمك الكامل (من حرفين إلى 80 حرفا).';
    if (email.length > 254 || !EMAIL_RE.test(email)) e.email = 'اكتب بريدا إلكترونيا صحيحا، مثل name@example.com.';
    if (phone && !PHONE_RE.test(phone)) e.phone = 'رقم الهاتف غير صحيح. استخدم أرقاما فقط، ويمكن إضافة + في البداية.';
    if (REASONS.indexOf(val('reason')) === -1) e.reason = 'اختر سبب الرسالة من القائمة.';
    if (msg.length < 10 || msg.length > 1000) e.message = 'الرسالة بين 10 و1000 حرف.';
    return e;
  }

  function showErrors(errors) {
    var first = null;
    FIELDS.forEach(function (id) {
      var input = document.getElementById(id);
      var out = document.getElementById(id + '-error');
      if (errors[id]) {
        input.setAttribute('aria-invalid', 'true');
        out.textContent = errors[id];
        out.hidden = false;
        if (!first) first = input;
      } else {
        input.removeAttribute('aria-invalid');
        out.textContent = '';
        out.hidden = true;
      }
    });
    if (first) first.focus();
  }

  function setStatus(kind, text) {
    statusBox.className = 'form-status' + (kind ? ' is-' + kind : '');
    statusBox.textContent = text || '';
  }

  function updateCounter() {
    counter.textContent = message.value.length + ' / 1000';
  }
  message.addEventListener('input', updateCounter);
  updateCounter();

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    setStatus('', '');

    var errors = validate();
    showErrors(errors);
    if (Object.keys(errors).length) {
      setStatus('error', 'راجع الحقول المعلَّمة ثم أعد الإرسال.');
      return;
    }

    var payload = {
      name: val('name'),
      email: val('email'),
      phone: val('phone'),
      reason: val('reason'),
      message: val('message'),
      website: document.getElementById('website').value
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'جارٍ الإرسال…';

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (r) {
        if (r.status === 200 && r.body.ok) {
          form.reset();
          updateCounter();
          showErrors({});
          setStatus('success', 'وصلتنا رسالتك. سنرد على بريدك في أقرب وقت.');
          return;
        }
        if (r.status === 400 && r.body.errors) {
          showErrors(r.body.errors);
        }
        setStatus('error', r.body.message || 'تعذّر إرسال الرسالة. حاول مجددا.');
      })
      .catch(function () {
        setStatus('error', 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وأعد المحاولة.');
      })
      .then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'أرسل الرسالة';
      });
  });
})();
