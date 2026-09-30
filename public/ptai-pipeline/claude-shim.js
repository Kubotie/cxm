/* ─── window.claude 互換シム ──────────────────────────────────────────────────
 *
 * board.js（アーティファクト原本）は window.claude.use('db'|'sample'|'mcp'|'user')
 * の 4 つしか外部に触らない。ここで同じ形の実装を用意して、CXM のサーバー API に
 * つなぎ替える（HANDOVER 12-1-1：原本のロジックと DOM 出力はそのまま使う）。
 *
 * board.js より前に読み込むこと。
 */
(function () {
  'use strict';
  if (window.claude) return;

  var API = '/api/ptai';

  function err(code, message, extra) {
    var e = new Error(message || code);
    e.code = code;
    if (extra) for (var k in extra) e[k] = extra[k];
    return e;
  }

  async function api(path, init) {
    var res;
    try {
      res = await fetch(API + path, Object.assign({ credentials: 'same-origin' }, init));
    } catch (_) {
      throw err('unavailable', 'ネットワークに接続できません');
    }
    if (res.status === 401) throw err('session_expired');
    if (res.status === 503) throw err('unavailable');
    if (!res.ok && res.status !== 422 && res.status !== 429 && res.status !== 413) {
      throw err('unavailable', 'サーバーエラー ' + res.status);
    }
    return res.json().catch(function () { return {}; });
  }

  /* ── user ─────────────────────────────────────────────────────────────── */

  var mePromise = null;
  function me() {
    if (!mePromise) mePromise = api('/me', { method: 'GET' }).catch(function () { return {}; });
    return mePromise;
  }

  var userNs = {
    id:      function () { return me().then(function (u) { return u.id || null; }); },
    isOwner: function () { return me().then(function (u) { return !!u.isOwner; }); },
    profiles: function (ids) {
      return api('/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ids || [] }),
      });
    },
  };

  /* ── db（Firestore 風。onSnapshot はポーリングで代替）──────────────────── */

  var POLL_MS = 6000;
  var state = {};            /* collection -> [{id, data}] */
  var listeners = [];        /* {collection, docId, cb, errCb, order, dir, limit} */
  var rev = null;
  var started = false;
  var polling = false;

  function docSnap(collection, docId) {
    var rows = state[collection] || [];
    var hit = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].id === docId) { hit = rows[i]; break; }
    return { id: docId, exists: !!hit, data: function () { return hit ? hit.data : undefined; } };
  }

  function querySnap(l) {
    var rows = (state[l.collection] || []).slice();
    if (l.order) {
      var f = l.order, dir = l.dir === 'desc' ? -1 : 1;
      rows.sort(function (a, b) {
        var av = (a.data && a.data[f]) || '', bv = (b.data && b.data[f]) || '';
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }
    if (l.limit) rows = rows.slice(0, l.limit);
    return {
      docs: rows.map(function (r) {
        return { id: r.id, exists: true, data: function () { return r.data; } };
      }),
    };
  }

  function notify(only) {
    listeners.forEach(function (l) {
      if (only && l.collection !== only) return;
      try {
        l.cb(l.docId ? docSnap(l.collection, l.docId) : querySnap(l));
      } catch (_) { /* 描画側の例外はここで握る */ }
    });
  }

  async function poll() {
    if (polling) return;
    polling = true;
    try {
      var json = await api('/db' + (rev ? '?rev=' + encodeURIComponent(rev) : ''), { method: 'GET' });
      if (json && json.unchanged) return;
      if (!json || !json.collections) return;
      state = json.collections;
      rev = json.rev || null;
      notify();
    } catch (e) {
      if (e && e.code === 'session_expired') {
        listeners.forEach(function (l) { if (l.errCb) l.errCb(err('revoked')); });
        stopPolling();
      }
    } finally {
      polling = false;
    }
  }

  var timer = null;
  function startPolling() {
    if (timer) return;
    timer = setInterval(function () { if (!document.hidden) poll(); }, POLL_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
  }
  function stopPolling() { if (timer) { clearInterval(timer); timer = null; } }

  /** ローカル状態を先に書き換える（Firestore の楽観反映と同じ）*/
  function applyLocal(collection, docId, data) {
    var rows = state[collection] || (state[collection] = []);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === docId) { rows[i] = { id: docId, data: data }; return; }
    }
    rows.push({ id: docId, data: data });
  }
  function removeLocal(collection, docId) {
    var rows = state[collection];
    if (!rows) return;
    state[collection] = rows.filter(function (r) { return r.id !== docId; });
  }

  function mapWriteError(e) {
    if (e && e.code) return e;
    return err('unavailable');
  }

  function docRef(path) {
    var i = path.indexOf('/');
    var collection = path.slice(0, i), docId = path.slice(i + 1);
    return {
      set: async function (body) {
        try {
          await api('/db', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: path, data: body }),
          });
        } catch (e) { throw mapWriteError(e); }
        applyLocal(collection, docId, body);
        rev = null;                       /* 次のポーリングで必ず取り直す */
        notify(collection);
      },
      delete: async function () {
        try {
          await api('/db?path=' + encodeURIComponent(path), { method: 'DELETE' });
        } catch (e) { throw mapWriteError(e); }
        removeLocal(collection, docId);
        rev = null;
        notify(collection);
      },
      onSnapshot: function (cb, errCb) {
        var l = { collection: collection, docId: docId, cb: cb, errCb: errCb };
        listeners.push(l);
        if (!started) { started = true; startPolling(); poll(); }
        else cb(docSnap(collection, docId));
        return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
      },
    };
  }

  function collectionRef(name, opts) {
    opts = opts || {};
    var self = {
      add: async function (body) {
        var out;
        try {
          out = await api('/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection: name, data: body }),
          });
        } catch (e) { throw mapWriteError(e); }
        applyLocal(name, (out && out.id) || String(Date.now()), body);
        rev = null;
        notify(name);
        return { id: out && out.id };
      },
      orderBy: function (field, dir) { return collectionRef(name, Object.assign({}, opts, { order: field, dir: dir })); },
      limit:   function (n)          { return collectionRef(name, Object.assign({}, opts, { limit: n })); },
      onSnapshot: function (cb, errCb) {
        var l = { collection: name, cb: cb, errCb: errCb, order: opts.order, dir: opts.dir, limit: opts.limit };
        listeners.push(l);
        if (!started) { started = true; startPolling(); poll(); }
        else cb(querySnap(l));
        return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
      },
    };
    return self;
  }

  var dbNs = {
    doc:        function (path) { return docRef(path); },
    collection: function (name) { return collectionRef(name); },
  };

  /* ── sample（Claude 呼び出し）─────────────────────────────────────────── */

  var LIMITS = { maxPromptBytes: 180000, images: { maxCount: 8 } };

  function fileToDataUrl(f) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(err('tool_error', '画像を読めませんでした')); };
      r.readAsDataURL(f);
    });
  }

  var sampleNs = {
    limits: function () { return Promise.resolve(LIMITS); },
    json: async function (promptOrTurns, opts) {
      opts = opts || {};
      var turns = Array.isArray(promptOrTurns)
        ? promptOrTurns.map(function (t) { return { role: t.role, content: String(t.content) }; })
        : [{ role: 'user', content: String(promptOrTurns) }];

      var images = [];
      if (opts.images && opts.images.length) {
        for (var i = 0; i < Math.min(opts.images.length, LIMITS.images.maxCount); i++) {
          var im = opts.images[i];
          images.push(typeof im === 'string' ? im : await fileToDataUrl(im));
        }
      }

      var res;
      try {
        res = await fetch(API + '/ai', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ turns: turns, images: images }),
          signal: opts.signal,
        });
      } catch (e) {
        if (e && e.name === 'AbortError') throw err('cancelled');
        throw err('unavailable');
      }
      var json = await res.json().catch(function () { return {}; });
      if (json && json.ok) return json.data;
      throw err((json && json.code) || 'tool_error', json && json.message);
    },
  };

  /* ── mcp ──────────────────────────────────────────────────────────────── */

  var mcpNs = {
    callTool: async function (server, tool, input) {
      var json = await api('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: server, tool: tool, input: input || {} }),
      });
      if (json && json.ok) return { payload: json.payload };
      throw err((json && json.code) || 'tool_error', json && json.message, { retryable: !!(json && json.retryable) });
    },
  };

  /* ── 公開 ─────────────────────────────────────────────────────────────── */

  window.claude = {
    use: function (name) {
      if (name === 'user')   return Promise.resolve(userNs);
      if (name === 'db')     return Promise.resolve(dbNs);
      if (name === 'sample') return Promise.resolve(sampleNs);
      if (name === 'mcp')    return Promise.resolve(mcpNs);
      return Promise.resolve(null);
    },
  };
})();
