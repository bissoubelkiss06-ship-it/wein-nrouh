(function () {
  'use strict';

  var grid = document.querySelector('.events-grid');
  var filtersBox = document.querySelector('.filters');
  if (!grid || !filtersBox) return;

  var FILTERS = [
    { key: 'all', label: 'الكل' },
    { key: 'youth', label: 'للشباب' },
    { key: 'family', label: 'للعائلات' },
    { key: 'free', label: 'مجانية' }
  ];
  var AUDIENCE_LABEL = { youth: 'شباب', family: 'عائلات', all: 'للجميع' };

  var events = [];
  var active = 'all';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatDate(iso, time) {
    var d = new Date(iso + 'T' + (time || '00:00') + ':00');
    if (isNaN(d.getTime())) return iso;
    var day = new Intl.DateTimeFormat('ar-u-nu-latn', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(d);
    return time ? day + ' — ' + time : day;
  }

  function isUpcoming(ev) {
    var end = new Date(ev.date + 'T23:59:59');
    return !isNaN(end.getTime()) && end >= new Date();
  }

  function matches(ev) {
    if (active === 'all') return true;
    if (active === 'free') return ev.free === true;
    return ev.audience === active || ev.audience === 'all';
  }

  function card(ev) {
    var art = el('article', 'event-card');

    var img = document.createElement('img');
    img.src = ev.image;
    img.alt = ev.imageAlt || ev.title;
    img.width = 800;
    img.height = 500;
    img.loading = 'lazy';
    img.decoding = 'async';
    art.appendChild(img);

    var body = el('div', 'event-body');

    var tags = el('div', 'tags');
    tags.appendChild(el('span', 'tag', AUDIENCE_LABEL[ev.audience] || 'للجميع'));
    tags.appendChild(el('span', 'tag', ev.free ? 'مجاني' : 'برسوم'));
    if (ev.sample) tags.appendChild(el('span', 'tag tag-sample', 'نموذج — يُستبدل'));
    body.appendChild(tags);

    body.appendChild(el('h3', '', ev.title));

    var when = el('p', 'event-meta');
    when.appendChild(el('strong', '', 'الموعد: '));
    when.appendChild(document.createTextNode(formatDate(ev.date, ev.time)));
    body.appendChild(when);

    var where = el('p', 'event-meta');
    where.appendChild(el('strong', '', 'المكان: '));
    where.appendChild(document.createTextNode(ev.place));
    body.appendChild(where);

    body.appendChild(el('p', 'event-desc', ev.description));

    var link = el('a', 'btn', 'سجّل الآن');
    link.href = ev.registerUrl;
    if (/^https?:\/\//i.test(ev.registerUrl)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    link.setAttribute('aria-label', 'سجّل في: ' + ev.title);
    body.appendChild(link);

    art.appendChild(body);
    return art;
  }

  function render() {
    grid.textContent = '';
    var list = events.filter(isUpcoming).filter(matches);
    list.sort(function (a, b) {
      return (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));
    });

    if (!list.length) {
      var empty = el('div', 'empty-state');
      empty.style.gridColumn = '1 / -1';
      empty.appendChild(el('p', '', 'لا توجد فعاليات في هذا التصنيف حاليا.'));
      var p = el('p');
      var a = el('a', '', 'نظّم فعالية وأرسلها لنا');
      a.href = '/contact';
      p.appendChild(a);
      empty.appendChild(p);
      grid.appendChild(empty);
      return;
    }
    list.forEach(function (ev) { grid.appendChild(card(ev)); });
  }

  function buildFilters() {
    FILTERS.forEach(function (f) {
      var b = el('button', 'filter-btn', f.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', f.key === active ? 'true' : 'false');
      b.addEventListener('click', function () {
        active = f.key;
        Array.prototype.forEach.call(filtersBox.children, function (c, i) {
          c.setAttribute('aria-pressed', FILTERS[i].key === active ? 'true' : 'false');
        });
        render();
      });
      filtersBox.appendChild(b);
    });
  }

  function showError() {
    grid.textContent = '';
    var box = el('div', 'empty-state', 'تعذّر تحميل قائمة الفعاليات. أعد تحميل الصفحة بعد لحظات.');
    box.style.gridColumn = '1 / -1';
    box.setAttribute('role', 'alert');
    grid.appendChild(box);
  }

  buildFilters();

  fetch('/data/events.json', { headers: { Accept: 'application/json' } })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      events = Array.isArray(data) ? data : [];
      render();
    })
    .catch(showError);
})();
