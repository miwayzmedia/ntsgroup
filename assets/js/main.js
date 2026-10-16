(function(){
  "use strict";

  /* ---------- Mobile navigation ---------- */
  var menuToggle = document.querySelector('.menu-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  var mnClose = document.getElementById('mn-close');
  function openNav(){
    mobileNav.classList.add('open');
    document.body.classList.add('nav-open');
    menuToggle.setAttribute('aria-expanded','true');
    if(mnClose) mnClose.focus();
  }
  function closeNav(){
    mobileNav.classList.remove('open');
    document.body.classList.remove('nav-open');
    menuToggle.setAttribute('aria-expanded','false');
    menuToggle.focus();
  }
  if(menuToggle && mobileNav){
    menuToggle.addEventListener('click', function(){
      mobileNav.classList.contains('open') ? closeNav() : openNav();
    });
    if(mnClose) mnClose.addEventListener('click', closeNav);
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && mobileNav.classList.contains('open')) closeNav();
    });
    mobileNav.addEventListener('click', function(e){
      if(e.target.tagName === 'A') closeNav();
    });
  }

  /* Mobile accordion sub-menus */
  document.querySelectorAll('.mn-toggle').forEach(function(btn){
    btn.addEventListener('click', function(){
      var sub = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      if(sub) sub.style.display = open ? 'none' : 'block';
    });
  });

  /* ---------- Cookie consent (UK GDPR / PECR) ----------
     - Nothing optional runs until the visitor opts in: no pre-ticked boxes,
       no implied consent from scrolling/browsing/closing, no auto-dismiss.
     - The choice is stored (first-party, strictly necessary) in localStorage and
       re-requested after CONSENT_MAX_AGE_DAYS or when CONSENT_VERSION is bumped
       (bump it whenever cookie purposes/providers change materially).
     - Optional scripts/embeds are written in the HTML as inert placeholders and
       are only switched on when their category is consented:
         <script type="text/plain" data-consent="analytics" src="…"></script>
         <script type="text/plain" data-consent="marketing">...inline code...</script>
         <iframe data-consent="marketing" data-src="https://…"></iframe>
       Code can also use window.NTSConsent.has('analytics') / .onChange(fn), and
       register clean-up for a category with .registerCleanup('analytics', fn).
     - Withdrawing consent deletes known non-essential cookies/storage and, if
       an optional script had already been activated, reloads the page so it stops. */
  var COOKIE_KEY = 'nts_cookie_consent_v2';
  try { localStorage.removeItem('nts_cookie_consent_v1'); } catch(e){}   // superseded record from the earlier banner
  var CONSENT_VERSION = 2;
  var CONSENT_MAX_AGE_DAYS = 180;
  var CATEGORIES = ['functional', 'analytics', 'marketing'];
  // Cookie-name patterns removed when the matching category is withdrawn.
  // This site sets none itself today; these cover common third-party tools so
  // that adding one later can't leave its cookies behind.
  var COOKIE_PATTERNS = {
    analytics: [/^_ga/, /^_gid$/, /^_gat/, /^_gcl_/, /^__utm/, /^_hj/, /^_pk_/, /^ajs_/, /^mp_/, /^_clck$/, /^_clsk$/, /^_dc_gtm_/],
    marketing: [/^_fbp$/, /^_fbc$/, /^fr$/, /^IDE$/, /^test_cookie$/, /^_ttp$/, /^_tt_/, /^_pin_/, /^li_/, /^lidc$/, /^bcookie$/, /^MUID$/, /^_uet/, /^YSC$/, /^VISITOR_INFO1_LIVE$/, /^__gads$/, /^__gpi$/],
    functional: []
  };
  var consentListeners = [], cleanups = {functional: [], analytics: [], marketing: []};
  var activatedCategories = {};

  function readConsent(){
    try {
      var c = JSON.parse(localStorage.getItem(COOKIE_KEY));
      if(!c || c.version !== CONSENT_VERSION || !c.timestamp) return null;
      if(Date.now() - c.timestamp > CONSENT_MAX_AGE_DAYS * 86400000) return null; // expired → ask again
      return c;
    } catch(e){ return null; }
  }
  var consent = readConsent();   // null = no valid choice yet → everything optional stays OFF
  function has(cat){ return cat === 'necessary' || !!(consent && consent[cat] === true); }

  function deleteCookie(name){
    var host = location.hostname, parts = host.split('.'), domains = [undefined, host];
    for(var i = 1; i < parts.length - 1; i++) domains.push('.' + parts.slice(i).join('.'));
    domains.push('.' + host);
    var past = '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    domains.forEach(function(d){ document.cookie = name + past + (d ? '; domain=' + d : ''); });
  }
  function clearCategory(cat){
    var pats = COOKIE_PATTERNS[cat] || [];
    (document.cookie ? document.cookie.split('; ') : []).forEach(function(kv){
      var name = kv.split('=')[0];
      if(pats.some(function(re){ return re.test(name); })) deleteCookie(name);
    });
    (cleanups[cat] || []).forEach(function(fn){ try { fn(); } catch(e){} });
  }

  // Switch on inert optional scripts/embeds whose category has been consented.
  function activateOptional(){
    document.querySelectorAll('script[type="text/plain"][data-consent]').forEach(function(old){
      var cat = old.getAttribute('data-consent');
      if(!has(cat) || old.getAttribute('data-consent-done')) return;
      old.setAttribute('data-consent-done', '1');
      var s = document.createElement('script');
      Array.prototype.forEach.call(old.attributes, function(a){
        if(a.name !== 'type' && a.name !== 'data-consent' && a.name !== 'data-consent-done') s.setAttribute(a.name, a.value);
      });
      s.text = old.text;
      old.parentNode.insertBefore(s, old.nextSibling);
      activatedCategories[cat] = true;
    });
    document.querySelectorAll('iframe[data-consent][data-src]').forEach(function(f){
      var cat = f.getAttribute('data-consent');
      if(has(cat) && !f.getAttribute('src')){ f.setAttribute('src', f.getAttribute('data-src')); activatedCategories[cat] = true; }
    });
  }

  window.NTSConsent = {
    has: has,
    get: function(){ return consent ? {necessary:true, functional:!!consent.functional, analytics:!!consent.analytics, marketing:!!consent.marketing} : {necessary:true, functional:false, analytics:false, marketing:false}; },
    onChange: function(fn){ consentListeners.push(fn); if(consent) fn(window.NTSConsent.get()); },
    registerCleanup: function(cat, fn){ if(cleanups[cat]) cleanups[cat].push(fn); }
  };

  var banner = document.getElementById('cookie-banner');
  if(banner){
    var ckBoxes = {
      functional: document.getElementById('ck-functional'),
      analytics: document.getElementById('ck-analytics'),
      marketing: document.getElementById('ck-marketing')
    };
    var acceptAll = document.getElementById('cookie-accept-all');
    var rejectAll = document.getElementById('cookie-reject');
    var manageBtn = document.getElementById('cookie-manage');
    var saveBtn = document.getElementById('cookie-save-prefs');
    var prefsPanel = document.getElementById('cookie-prefs');
    var settingsLink = document.getElementById('cookie-settings-link');
    var lastFocus = null;

    // Boxes always mirror what is actually saved: all unticked until the visitor opts in.
    function syncBoxes(){ CATEGORIES.forEach(function(c){ if(ckBoxes[c]) ckBoxes[c].checked = has(c); }); }
    function setPanel(open){
      prefsPanel.classList.toggle('show', open);
      if(manageBtn) manageBtn.setAttribute('aria-expanded', String(open));
    }
    function showBanner(openPanel){
      syncBoxes();
      setPanel(!!openPanel);
      banner.classList.remove('hidden');
    }
    function hideBanner(){
      banner.classList.add('hidden');
      setPanel(false);
      if(lastFocus && document.contains(lastFocus)){ try { lastFocus.focus(); } catch(e){} }
      lastFocus = null;
    }

    function saveConsent(choice){
      var previous = consent;
      var rec = {version: CONSENT_VERSION, timestamp: Date.now(), necessary: true,
                 functional: !!choice.functional, analytics: !!choice.analytics, marketing: !!choice.marketing};
      try { localStorage.setItem(COOKIE_KEY, JSON.stringify(rec)); } catch(e){}
      consent = rec;
      var needsReload = false;
      CATEGORIES.forEach(function(c){
        var was = !!(previous && previous[c]);
        if(was && !rec[c]){            // withdrawn → stop & remove
          clearCategory(c);
          if(activatedCategories[c]) needsReload = true;
        }
      });
      activateOptional();
      consentListeners.forEach(function(fn){ try { fn(window.NTSConsent.get()); } catch(e){} });
      hideBanner();
      if(needsReload) setTimeout(function(){ location.reload(); }, 50);  // halts scripts already running
    }

    if(consent){ banner.classList.add('hidden'); syncBoxes(); }   // valid choice → don't nag on every page
    else { syncBoxes(); }                                          // no choice → banner stays until they decide

    acceptAll.addEventListener('click', function(){ saveConsent({functional:true, analytics:true, marketing:true}); });
    rejectAll.addEventListener('click', function(){ saveConsent({functional:false, analytics:false, marketing:false}); });
    manageBtn.addEventListener('click', function(){ setPanel(!prefsPanel.classList.contains('show')); });
    saveBtn.addEventListener('click', function(){
      saveConsent({functional: ckBoxes.functional.checked, analytics: ckBoxes.analytics.checked, marketing: ckBoxes.marketing.checked});
    });
    // Footer "Cookie Settings": reopen with the visitor's currently saved choices,
    // so they can change or withdraw consent at any time (as easy as giving it).
    if(settingsLink) settingsLink.addEventListener('click', function(){
      lastFocus = document.activeElement;
      showBanner(true);
      banner.focus();
    });
    // Escape closes a re-opened panel without changing anything (only once a choice exists;
    // closing never counts as consent).
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && consent && !banner.classList.contains('hidden')) hideBanner();
    });
  }
  activateOptional();   // enables only what the stored choice allows (nothing on a first visit)

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && revealEls.length){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, {threshold:.15});
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in'); });
  }

  /* ---------- Count-up stats ---------- */
  var statEls = document.querySelectorAll('.stat .num[data-count]');
  function animateCount(el){
    var target = parseInt(el.getAttribute('data-count'), 10);
    var suffix = el.getAttribute('data-suffix') || '';
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduced){ el.textContent = target + suffix; return; }
    var start = 0, duration = 850, startTime = null;
    function step(ts){
      if(!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      el.textContent = Math.floor(progress * (target - start) + start) + suffix;
      if(progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if('IntersectionObserver' in window && statEls.length){
    var ioStats = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ animateCount(en.target); ioStats.unobserve(en.target); }
      });
    }, {threshold:.4});
    statEls.forEach(function(el){ ioStats.observe(el); });
  } else {
    statEls.forEach(animateCount);
  }

  /* ---------- Accordion ---------- */
  document.querySelectorAll('.accordion-trigger').forEach(function(btn){
    btn.addEventListener('click', function(){
      var item = btn.closest('.accordion-item');
      var wasOpen = item.classList.contains('open');
      if(item.parentElement.hasAttribute('data-single-open')){
        item.parentElement.querySelectorAll('.accordion-item.open').forEach(function(o){
          o.classList.remove('open'); o.querySelector('.accordion-trigger').setAttribute('aria-expanded','false');
        });
      }
      item.classList.toggle('open', !wasOpen);
      btn.setAttribute('aria-expanded', String(!wasOpen));
    });
  });

  /* ---------- Timeline (About page growth strip) ---------- */
  /* Each point's milestone lives in a floating "magnifier" card that opens
     on hover, keyboard focus, or tap — never a scrollable strip. Points near
     either edge would otherwise push their (horizontally centred) card past
     the viewport, so its horizontal offset is nudged back in just before it
     shows, and click-away/Escape/tap close it again. */
  (function(){
    var points = document.querySelectorAll('.timeline-point');
    if(!points.length) return;
    var EDGE_PAD = 16;
    function positionTip(p){
      var tip = p.querySelector('.timeline-tip');
      if(!tip) return;
      p.style.setProperty('--tip-shift', '0px');
      var pRect = p.getBoundingClientRect();
      var tipWidth = tip.offsetWidth;
      var centerX = pRect.left + pRect.width / 2;
      var left = centerX - tipWidth / 2;
      var right = centerX + tipWidth / 2;
      var shift = 0;
      if(left < EDGE_PAD) shift = EDGE_PAD - left;
      else if(right > window.innerWidth - EDGE_PAD) shift = (window.innerWidth - EDGE_PAD) - right;
      p.style.setProperty('--tip-shift', shift + 'px');
    }
    function closeAll(except){
      points.forEach(function(p){
        if(p !== except){ p.classList.remove('active'); p.setAttribute('aria-expanded','false'); }
      });
    }
    function positionAll(){ points.forEach(positionTip); }
    // Even while hidden (opacity/visibility only), an absolutely-positioned
    // tip still occupies its laid-out box, so an edge point's tip can push
    // the page's horizontal scroll range even before anyone opens it —
    // position every tip up front, not just on hover/click.
    positionAll();
    var resizeTimer = null;
    window.addEventListener('resize', function(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(positionAll, 150);
    });
    points.forEach(function(p){
      p.addEventListener('mouseenter', function(){ positionTip(p); });
      p.addEventListener('focus', function(){ positionTip(p); });
      p.addEventListener('click', function(){
        var willOpen = !p.classList.contains('active');
        closeAll();
        if(willOpen) positionTip(p);
        p.classList.toggle('active', willOpen);
        p.setAttribute('aria-expanded', String(willOpen));
      });
    });
    document.addEventListener('click', function(e){
      if(!e.target.closest('.timeline-point')) closeAll();
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape') closeAll();
    });
  })();

  /* ---------- Tabs (contact page) ---------- */
  document.querySelectorAll('[data-tabs]').forEach(function(tabGroup){
    var buttons = tabGroup.querySelectorAll('.tab-btn');
    var panels = tabGroup.querySelectorAll('.tab-panel');
    function activate(id, focus){
      buttons.forEach(function(b){ b.setAttribute('aria-selected', String(b.dataset.tab === id)); });
      panels.forEach(function(p){ p.classList.toggle('active', p.id === 'panel-' + id); });
      if(focus){ var p = tabGroup.querySelector('#panel-' + id); if(p) p.setAttribute('tabindex','-1'); }
    }
    buttons.forEach(function(b){
      b.addEventListener('click', function(){ activate(b.dataset.tab, true); history.replaceState(null,'','#'+b.dataset.tab); });
    });
    var hash = window.location.hash.replace('#','');
    if(hash && tabGroup.querySelector('[data-tab="'+hash+'"]')){ activate(hash); }
  });

  /* ---------- Generic form validation + success state ---------- */
  document.querySelectorAll('form[data-validate]').forEach(function(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var valid = true;
      form.querySelectorAll('[required]').forEach(function(input){
        var field = input.closest('.field');
        var ok = input.type === 'checkbox' ? input.checked : String(input.value || '').trim().length > 0;
        if(input.type === 'email' && ok){ ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value); }
        if(field){ field.classList.toggle('invalid', !ok); }
        if(!ok) valid = false;
      });
      if(!valid){
        var firstInvalid = form.querySelector('.invalid input, .invalid select, .invalid textarea, .invalid');
        if(firstInvalid) firstInvalid.focus();
        return;
      }
      var mailto = form.getAttribute('data-mailto');
      if(mailto){
        var nameVal = '', emailVal = '', messageVal = '';
        form.querySelectorAll('input, textarea, select').forEach(function(input){
          var n = (input.name || input.id || '').toLowerCase();
          if(input.type === 'checkbox') return;
          if(n.indexOf('name') > -1 && !nameVal) nameVal = input.value;
          else if(n.indexOf('email') > -1 && !emailVal) emailVal = input.value;
          else if(n.indexOf('message') > -1 && !messageVal) messageVal = input.value;
        });
        var subject = 'Website enquiry' + (nameVal ? ' from ' + nameVal : '');
        var bodyLines = [];
        if(nameVal) bodyLines.push('Name: ' + nameVal);
        if(emailVal) bodyLines.push('Email: ' + emailVal);
        bodyLines.push('');
        bodyLines.push(messageVal || '');
        var mailtoUrl = 'mailto:' + mailto +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(bodyLines.join('\n'));
        window.location.href = mailtoUrl;
      }
      form.style.display = 'none';
      var successId = form.getAttribute('data-success');
      var success = successId ? document.getElementById(successId) : form.nextElementSibling;
      if(success){ success.classList.add('show'); success.setAttribute('tabindex','-1'); success.focus(); }
    });
  });

  /* ---------- Location Finder ---------- */
  /* Build a link to a root-relative site path (e.g. "locations/nts-calne.html") that
     resolves correctly regardless of how deep the current page sits, since this
     hosting does not resolve root-absolute ("/x") paths against the site's own root. */
  var NTS_DEPTH = window.NTS_DEPTH || 0;
  function siteLink(rootRelativePath){
    var prefix = '';
    for(var i=0;i<NTS_DEPTH;i++){ prefix += '../'; }
    return prefix + rootRelativePath;
  }

  var finder = document.getElementById('location-finder');
  if(finder){
    // Store data is loaded dynamically from a generated JSON file rather
    // than being hand-coded into this script — adding a new store to the
    // site's data source makes it appear here automatically on the next
    // build, with no map/list code to edit.
    fetch(siteLink('assets/data/stores.json'))
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function(payload){ initStoreFinder(payload.stores || [], payload.facility_labels || {}); })
      .catch(function(err){
        console.error('Store Finder: could not load store data', err);
        var resultsEl = document.getElementById('finder-results');
        if(resultsEl) resultsEl.innerHTML = '<div class="results-empty">Sorry &mdash; store locations could not be loaded right now. Please refresh the page.</div>';
      });
  }

  function initStoreFinder(data, facilityLabels){
    var searchInput = document.getElementById('finder-search');
    var chips = finder.querySelectorAll('.filter-chip');
    var resultsEl = document.getElementById('finder-results');
    var countEl = document.getElementById('finder-count');
    var clearBtn = document.getElementById('finder-clear');
    var activeFilters = {};
    var userCoords = null;   // [lat, lng] — reserved for a future "use my location" control
    var searchOrigin = null; // [lat, lng] once a postcode/outcode search resolves via postcodes.io

    function facilityIcons(loc){
      return Object.keys(loc.facilities).filter(function(k){ return loc.facilities[k]; });
    }

    // Real-world distance in km between two [lat, lng] points (haversine),
    // used to sort by actual nearness once the visitor shares their location
    // — not a text match against county names.
    function distanceKm(a, b){
      var toRad = function(d){ return d * Math.PI / 180; };
      var dLat = toRad(b[0] - a[0]);
      var dLng = toRad(b[1] - a[1]);
      var lat1 = toRad(a[0]), lat2 = toRad(b[0]);
      var h = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
      return 6371 * 2 * Math.asin(Math.sqrt(h));
    }

    var DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    // Parses either a 24-hour "06:00" or a 12-hour "8:30am" time into
    // minutes-since-midnight, or null if it doesn't match either shape.
    function parseTimeStr(s){
      var m = (s || '').trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
      if(!m) return null;
      var hh = parseInt(m[1], 10);
      var mm = parseInt(m[2], 10);
      if(m[3]){
        var ap = m[3].toLowerCase();
        if(hh === 12) hh = 0;
        if(ap === 'pm') hh += 12;
      }
      return hh * 60 + mm;
    }

    function parseRangeMins(rangeStr){
      var parts = (rangeStr || '').split(/[–-]/).map(function(p){ return p.trim(); });
      if(parts.length !== 2) return null;
      var open = parseTimeStr(parts[0]);
      var close = parseTimeStr(parts[1]);
      if(open === null || close === null) return null;
      return [open, close];
    }

    function minsInRange(nowMins, openMins, closeMins){
      if(closeMins <= openMins){
        // Range crosses midnight (e.g. 06:00–00:00).
        return nowMins >= openMins || nowMins < closeMins;
      }
      return nowMins >= openMins && nowMins < closeMins;
    }

    // Expands confirmed weekly hours (e.g. [["Monday–Friday","8:30am – 5:30pm"], ...])
    // into a day-index (0=Sunday..6=Saturday) -> hours-string map.
    function expandWeeklyHours(weeklyHours){
      var map = {};
      weeklyHours.forEach(function(row){
        var dayPart = row[0], hrs = row[1];
        var days = dayPart.split(/[–-]/).map(function(d){ return d.trim(); });
        if(days.length === 2){
          var startIdx = DAY_NAMES.indexOf(days[0]);
          var endIdx = DAY_NAMES.indexOf(days[1]);
          if(startIdx > -1 && endIdx > -1){
            for(var i = startIdx; ; i = (i + 1) % 7){
              map[i] = hrs;
              if(i === endIdx) break;
            }
          }
        } else {
          var idx = DAY_NAMES.indexOf(dayPart);
          if(idx > -1) map[idx] = hrs;
        }
      });
      return map;
    }

    // "Open Now" reads the same hours already shown elsewhere on each
    // site's own page against the visitor's actual local time — not a
    // guess. Sites with client-confirmed day-by-day hours are checked
    // against today's actual day of the week; everything else uses the
    // single forecourt-hours range (24hr, or a "HH:MM – HH:MM daily" range).
    // A range this can't safely parse is left out of the match rather than
    // assumed open.
    function isOpenNow(loc){
      if(loc.twentyfour_hour) return true;
      var now = new Date();
      if(loc.weekly_hours && loc.weekly_hours.length){
        var todayHrs = expandWeeklyHours(loc.weekly_hours)[now.getDay()];
        if(todayHrs === undefined || /closed/i.test(todayHrs)) return false;
        var wRange = parseRangeMins(todayHrs);
        if(!wRange) return false;
        return minsInRange(now.getHours() * 60 + now.getMinutes(), wRange[0], wRange[1]);
      }
      var h = loc.forecourt_hours || '';
      if(!h || h.indexOf('24 hours') > -1) return loc.twentyfour_hour;
      var m = h.match(/(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})/);
      if(!m) return false;
      var openMins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      var closeMins = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
      return minsInRange(now.getHours() * 60 + now.getMinutes(), openMins, closeMins);
    }

    // Text describing this site's hours for the map popup — mirrors the
    // same precedence used elsewhere (pending, 24hr, day-by-day, or a
    // single range), so the popup never disagrees with the card/detail page.
    function hoursSummary(loc){
      if(loc.facilities_pending) return 'Coming soon';
      if(loc.twentyfour_hour) return 'Open 24 hours';
      if(loc.weekly_hours && loc.weekly_hours.length){
        return loc.weekly_hours.map(function(row){ return row[0] + ': ' + row[1]; }).join('<br>');
      }
      return loc.forecourt_hours || 'Hours not yet confirmed';
    }

    function mapsHrefFor(loc){
      return loc.map_link ? loc.map_link.replace(/&/g, '&amp;') : ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc.full_address));
    }

    function buildPopupHtml(loc){
      var facilitiesHtml = loc.facility_tags && loc.facility_tags.length ?
        '<div class="popup-tags">' + loc.facility_tags.slice(0, 6).map(function(t){ return '<span class="tag">' + t + '</span>'; }).join('') + '</div>' : '';
      return '' +
        '<div class="map-popup">' +
          '<h4>' + loc.name + '</h4>' +
          '<p class="meta">' + loc.full_address + '</p>' +
          '<p class="meta">' + hoursSummary(loc) + '</p>' +
          facilitiesHtml +
          '<div class="actions">' +
            '<a class="btn btn-primary btn-sm" href="' + mapsHrefFor(loc) + '" target="_blank" rel="noopener">Get Directions</a>' +
          '</div>' +
        '</div>';
    }

    /* ---------- Interactive map (Leaflet + marker clustering) ---------- */
    // Every store gets exactly one marker, built automatically from its
    // lat/lng — nothing here is hand-plotted. Markers close together
    // cluster until the visitor zooms in, so this stays fast and legible
    // whether there are 29 stores or 500.
    var map = null, markerCluster = null, markersBySlug = {};
    var mapEl = document.getElementById('store-map');
    if(window.L && mapEl){
      map = L.map(mapEl, {scrollWheelZoom: false});
      var tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Some preview environments (this included, if you're viewing a
      // published Claude Artifact) block outbound image requests to third-
      // party map-tile servers, so the street/terrain imagery can't load
      // there — pins, search and filtering still work fine either way.
      // Leaflet's own 'load' event fires once every currently-visible tile
      // has settled, whether it loaded OR errored, so it can't be used on
      // its own to detect this; track successful tile loads separately and
      // only show the fallback once a batch settles with zero successes.
      var tileSuccessCount = 0;
      var captionEl = mapEl.parentElement && mapEl.parentElement.querySelector('.map-caption');
      tileLayer.on('tileload', function(){
        tileSuccessCount++;
        mapEl.classList.remove('tiles-unavailable');
        if(captionEl) captionEl.textContent = 'Search, filter, or click a pin to explore. Map data © OpenStreetMap contributors.';
      });
      tileLayer.on('load', function(){
        if(tileSuccessCount === 0){
          mapEl.classList.add('tiles-unavailable');
          if(captionEl) captionEl.textContent = 'Map imagery isn\'t loading in this preview, but every pin below is plotted correctly — click a pin or a location card to see its details, or use search and filters as normal.';
        }
      });
      // Only zoom with the scroll wheel once the visitor has deliberately
      // engaged with the map — otherwise an ordinary page-scroll over the
      // map would get hijacked into a zoom.
      mapEl.addEventListener('mouseenter', function(){ map.scrollWheelZoom.enable(); });
      mapEl.addEventListener('mouseleave', function(){ map.scrollWheelZoom.disable(); });

      markerCluster = L.markerClusterGroup({ maxClusterRadius: 45 });
      map.addLayer(markerCluster);

      var pinIcon = function(color){
        return L.divIcon({
          className: 'store-pin',
          html: '<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="' + color + '"/><circle cx="15" cy="15" r="6" fill="#fff"/></svg>',
          iconSize: [30, 40], iconAnchor: [15, 39], popupAnchor: [0, -34]
        });
      };
      var PIN_DEFAULT = pinIcon('#0a5e7a');
      var PIN_PENDING = pinIcon('#FF9015');

      data.forEach(function(loc){
        if(!loc.coords) return;
        var marker = L.marker(loc.coords, {icon: loc.facilities_pending ? PIN_PENDING : PIN_DEFAULT, title: loc.name});
        marker.bindPopup(buildPopupHtml(loc), {maxWidth: 260});
        marker.on('click', function(){ selectStore(loc.slug, {fromMap: true}); });
        markersBySlug[loc.slug] = marker;
        markerCluster.addLayer(marker);
      });

      // Fit so every store is visible the moment the page loads.
      var allCoords = data.filter(function(l){ return l.coords; }).map(function(l){ return l.coords; });
      if(allCoords.length) map.fitBounds(allCoords, {padding: [32, 32]});
    }

    // Keeps the map's visible pins in lockstep with whatever the list is
    // currently showing (search text + active facility filters).
    function updateMapMarkers(filtered){
      if(!map || !markerCluster) return;
      var visible = {};
      filtered.forEach(function(l){ visible[l.slug] = true; });
      Object.keys(markersBySlug).forEach(function(slug){
        var marker = markersBySlug[slug];
        var shouldShow = !!visible[slug];
        var isShown = markerCluster.hasLayer(marker);
        if(shouldShow && !isShown) markerCluster.addLayer(marker);
        if(!shouldShow && isShown) markerCluster.removeLayer(marker);
      });
    }

    function highlightCard(slug){
      resultsEl.querySelectorAll('.location-card').forEach(function(card){
        card.classList.toggle('is-selected', card.dataset.slug === slug);
      });
    }

    // Centres/zooms the map on one store and opens its popup (expanding its
    // cluster first if it's currently grouped away), and highlights the
    // matching card — the single link that keeps map and list in sync
    // whichever side triggered the selection.
    function selectStore(slug, opts){
      opts = opts || {};
      var loc = data.filter(function(l){ return l.slug === slug; })[0];
      if(!loc) return;
      highlightCard(slug);
      if(map && loc.coords){
        map.setView(loc.coords, Math.max(map.getZoom() || 0, 14), {animate: true});
      }
      var marker = markersBySlug[slug];
      if(marker){
        if(markerCluster.hasLayer(marker) && typeof markerCluster.zoomToShowLayer === 'function'){
          markerCluster.zoomToShowLayer(marker, function(){ marker.openPopup(); });
        } else {
          marker.openPopup();
        }
      }
      if(!opts.fromMap && mapEl && window.innerWidth <= 900){
        // On the stacked mobile layout the map sits above the list, so
        // scroll up to it when a list item is the thing that was clicked.
        var mapTop = mapEl.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({top: mapTop, behavior: 'smooth'});
      }
    }

    // A UK postcode ("CM0 8NS") or outward code ("CM0") shaped query is
    // resolved to real coordinates via the free postcodes.io lookup rather
    // than text-matched — see handleSearchInput below. While that's the
    // shape of the query, every store stays in the (facility-filtered)
    // result set and gets reordered/recentred by actual distance instead.
    var POSTCODE_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;
    var OUTCODE_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?$/;

    function render(){
      var qRaw = (searchInput.value || '').trim();
      var q = qRaw.toLowerCase();
      var isGeoQuery = !!qRaw && (POSTCODE_RE.test(qRaw) || OUTCODE_RE.test(qRaw));
      var activeKeys = Object.keys(activeFilters).filter(function(k){ return activeFilters[k]; });
      var filtered = data.filter(function(loc){
        var matchesQuery = !q || isGeoQuery || loc.name.toLowerCase().indexOf(q) > -1 ||
          (loc.county||'').toLowerCase().indexOf(q) > -1 || loc.town.toLowerCase().indexOf(q) > -1 ||
          (loc.full_address||'').toLowerCase().indexOf(q) > -1;
        var matchesFilters = activeKeys.every(function(k){
          // A site with facilities/hours still marked "Coming soon" shows no
          // hours claim on its own card, so it shouldn't match either hours
          // filter — its 24hr/open data is placeholder, not confirmed.
          if(k === '24hr') return loc.twentyfour_hour && !loc.facilities_pending;
          // "Open Now" lists only sites with set hours that are open right now;
          // 24-hour sites are deliberately left to the separate "Open 24 Hours" chip.
          if(k === 'open_now') return !loc.facilities_pending && !loc.twentyfour_hour && isOpenNow(loc);
          if(k.indexOf('brand:') === 0) return loc.fuel_brand === k.slice(6);
          if(k.indexOf('fascia:') === 0) return loc.shop_brand === k.slice(7);
          // Same reasoning as 24hr/open_now above — a "Coming soon" site's
          // underlying facility flags are placeholder data too. A
          // service_type site (e.g. an MOT/service garage) shows its one
          // descriptive tag instead of any facility tags on its own card,
          // so its raw facilities dict is unconfirmed and never matches. A
          // facility_tags_override site shows only its confirmed tag(s) —
          // it matches a facility filter only when that facility's label is
          // one of those confirmed tags, not from the rest of the
          // (unconfirmed) raw facilities dict.
          if(loc.facilities_pending || loc.service_type) return false;
          if(loc.facility_tags_override) return loc.facility_tags_override.indexOf(facilityLabels[k]) > -1;
          return loc.facilities[k];
        });
        return matchesQuery && matchesFilters;
      });
      // A resolved postcode search takes priority as the distance origin
      // (it's what the visitor just searched for); otherwise fall back to
      // their shared location, if any.
      var origin = searchOrigin || userCoords;
      if(origin){
        filtered = filtered.slice().sort(function(a, b){
          var da = a.coords ? distanceKm(origin, a.coords) : Infinity;
          var db = b.coords ? distanceKm(origin, b.coords) : Infinity;
          return da - db;
        });
      }
      countEl.textContent = filtered.length + (filtered.length === 1 ? ' location found' : ' locations found');
      if(!filtered.length){
        resultsEl.innerHTML = '<div class="results-empty">No locations match your search — try removing a filter.</div>';
        updateMapMarkers(filtered);
        return;
      }
      resultsEl.innerHTML = filtered.map(function(loc){
        // A site that's fundamentally not a fuel forecourt (e.g. a
        // co-located MOT/service garage) shows a single descriptive tag
        // in place of facility tags and the open/24hr status.
        var facilities;
        if(loc.service_type || loc.facilities_pending){
          facilities = '';
        } else if(loc.facility_tags_override && loc.facility_tags_override.length){
          // A specific amenity has been client-confirmed for this site, but
          // the full facility checklist hasn't — show only the confirmed
          // tag(s) rather than the placeholder-generated facility list.
          facilities = loc.facility_tags_override.map(function(t){ return '<span class="tag">' + t + '</span>'; }).join('');
        } else {
          facilities = facilityIcons(loc).map(function(k){
            return '<span class="tag">' + facilityLabels[k] + '</span>';
          }).join('');
        }
        // Live status: reflects the visitor's actual current time against
        // this site's hours (including day-of-week for sites with
        // confirmed weekly hours), not a static "Open now" claim.
        var openBadge = loc.twentyfour_hour ? '<span class="tag status-open">Open 24 hours</span>' :
          (isOpenNow(loc) ? '<span class="tag status-open">Open now</span>' : '<span class="tag status-closed">Closed now</span>');
        var status = loc.service_type ? (openBadge + '<span class="tag">' + loc.service_type + '</span>') :
          (loc.facilities_pending ? '<span class="tag status-soon">Coming soon</span>' : openBadge);
        // Blank (not "TBC"/"N/A") in this compact meta line when the fuel
        // brand isn't a confirmed real value — the detail page is where an
        // outright "N/A" is spelled out for a non-fuel site.
        var fuelBrandConfirmed = loc.fuel_brand && loc.fuel_brand !== 'N/A' && loc.fuel_brand.indexOf('[TBC') !== 0;
        var metaLine = loc.full_address + (fuelBrandConfirmed ? (' &middot; ' + loc.fuel_brand) : '');
        if(origin && loc.coords){
          metaLine += ' &middot; ' + distanceKm(origin, loc.coords).toFixed(1) + ' km away';
        }
        var phoneConfirmed = loc.phone && loc.phone !== 'N/A' && loc.phone.indexOf('[TBC') !== 0;
        var telHref = phoneConfirmed ? ('tel:' + loc.phone.replace(/[^\d+]/g, '')) : 'tel:0000000000';
        // "Site hours" reads correctly only when forecourt and shop keep
        // the same hours (true for nearly every location) — the one site
        // where they differ keeps the more precise "Forecourt:" label
        // rather than a single label that would understate its shop hours.
        var hoursLine = '';
        if(loc.forecourt_hours && !loc.twentyfour_hour){
          var sameHours = loc.forecourt_hours === loc.shop_hours;
          hoursLine = '<p class="meta">' + (sameHours ? 'Site hours: ' : 'Forecourt: ') + loc.forecourt_hours + '</p>';
        }
        // A client-confirmed Google Maps link is used when we have one for
        // this site, otherwise a maps search query built from the full address.
        var mapsHref = loc.map_link ? loc.map_link.replace(/&/g, '&amp;') : ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc.full_address));
        return '' +
          '<article class="location-card" data-slug="' + loc.slug + '">' +
            '<div class="info">' +
              '<h3>' + loc.name + '</h3>' +
              '<p class="meta">' + metaLine + '</p>' +
              hoursLine +
              status +
              '<div class="facilities">' + facilities + '</div>' +
              '<div class="actions">' +
                '<a class="btn btn-primary btn-sm" href="' + mapsHref + '" target="_blank" rel="noopener">Directions</a>' +
                (phoneConfirmed ? ('<a class="btn btn-secondary btn-sm" href="' + telHref + '">' + loc.phone + '</a>') : '') +
                (loc.external_link ? ('<a class="btn btn-nts-garage btn-sm" href="' + loc.external_link.url + '" target="_blank" rel="noopener">' + loc.external_link.label + '</a>') : '') +
              '</div>' +
            '</div>' +
          '</article>';
      }).join('');
      updateMapMarkers(filtered);
      if(searchOrigin && map){
        // Centre on the searched area and frame it against the nearest
        // still-visible (filter-matching) stores.
        var frameCoords = filtered.slice(0, 10).map(function(l){ return l.coords; }).filter(Boolean);
        frameCoords.push(searchOrigin);
        map.fitBounds(frameCoords, {padding: [32, 32], maxZoom: 13});
      }
    }

    // Postcode/outward-code lookups use postcodes.io — a free, keyless UK
    // postcode API — to resolve real coordinates; anything else (a town,
    // city or street) is matched as text against the store data itself,
    // both above in render(). Geocoding is debounced so it only fires once
    // the visitor pauses typing, not on every keystroke.
    var geocodeTimer = null;
    function handleSearchInput(){
      searchOrigin = null;
      render();
      clearTimeout(geocodeTimer);
      var qRaw = searchInput.value.trim();
      if(!qRaw) return;
      var isPostcode = POSTCODE_RE.test(qRaw);
      var isOutcode = OUTCODE_RE.test(qRaw);
      if(!isPostcode && !isOutcode) return;
      geocodeTimer = setTimeout(function(){
        var endpoint = isPostcode ?
          'https://api.postcodes.io/postcodes/' + encodeURIComponent(qRaw.replace(/\s+/g, '')) :
          'https://api.postcodes.io/outcodes/' + encodeURIComponent(qRaw.replace(/\s+/g, ''));
        fetch(endpoint).then(function(r){ return r.json(); }).then(function(j){
          // Only apply the result if the box still holds the query it
          // answers — the visitor may have kept typing while this was in flight.
          if(j && j.result && searchInput.value.trim() === qRaw){
            searchOrigin = [j.result.latitude, j.result.longitude];
            render();
          }
        }).catch(function(){ /* leave the plain text-filtered result showing */ });
      }, 400);
    }
    searchInput.addEventListener('input', handleSearchInput);
    // Clicking anywhere on a store's card centres/zooms the map onto it and
    // opens its popup (delegated since cards are rebuilt on every render).
    // A click on one of the card's own links or buttons (the store-name
    // link, Directions, Call, NTS Garage) still does its normal job instead
    // — only a click on the card itself triggers the map selection.
    resultsEl.addEventListener('click', function(e){
      if(e.target.closest && e.target.closest('a, button')) return;
      var card = e.target.closest && e.target.closest('.location-card');
      if(card && card.dataset.slug) selectStore(card.dataset.slug, {fromMap: false});
    });
    chips.forEach(function(chip){
      chip.addEventListener('click', function(){
        var key = chip.dataset.filter;
        if(!key) return; // e.g. the "Clear Filters" button shares this class but has its own handler below
        var pressed = chip.getAttribute('aria-pressed') === 'true';
        // Fuel-brand chips are single-select: a location has one fuel
        // brand, so pressing a different brand chip clears whichever
        // brand chip was active and selects only the new one, instead of
        // stacking brands (which would always return zero results).
        if(key.indexOf('brand:') === 0){
          chips.forEach(function(c){
            if(c !== chip && c.dataset.filter && c.dataset.filter.indexOf('brand:') === 0){
              c.setAttribute('aria-pressed', 'false');
              activeFilters[c.dataset.filter] = false;
            }
          });
        }
        chip.setAttribute('aria-pressed', String(!pressed));
        activeFilters[key] = !pressed;
        render();
      });
    });
    if(clearBtn) clearBtn.addEventListener('click', function(){
      searchInput.value = '';
      searchOrigin = null;
      chips.forEach(function(c){ c.setAttribute('aria-pressed','false'); });
      activeFilters = {};
      render();
      if(map){
        var allCoords = data.filter(function(l){ return l.coords; }).map(function(l){ return l.coords; });
        if(allCoords.length) map.fitBounds(allCoords, {padding: [32, 32]});
      }
    });

    var params = new URLSearchParams(window.location.search);
    if(params.get('q')) searchInput.value = params.get('q');
    if(params.get('filter')){
      var f = params.get('filter');
      activeFilters[f] = true;
      var chipEl = finder.querySelector('.filter-chip[data-filter="'+f+'"]');
      if(chipEl) chipEl.setAttribute('aria-pressed','true');
    }
    if(params.get('q')) handleSearchInput(); else render();

    // Keep the live "Open now" / "Closed now" badges accurate if the page
    // is left open across an opening or closing time, without needing any
    // visitor interaction to refresh them.
    setInterval(render, 60000);
  }

})();
