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
  /* 書き込みの世代。保存より前に始まったポーリングの結果は**捨てる**。
     保存には数秒かかるので、その間に出た GET が保存前の Twenty を読み、
     保存完了の後に届いて画面を元に戻していた（2026-10-06 Eri 指摘
     「NextAction の期日が 3 回に 1 回保存できない」）。 */
  var writes = 0;            /* 実行中の書き込み数 */
  /* 書き込みの後は「どの版とも一致しない rev」を送って全件取り直す。null（rev なし）にすると
     初回読み込み扱いになり、サーバーが一部読めなかった結果まで受け取ってしまう */
  var STALE = 'stale';
  var failStreak = 0;        /* 続けて読めなかった回数。続くときは一部欠けでも受け取る */
  var writeGen = 0;          /* 書き込みが始まる／終わるたびに増える */
  async function guarded(fn) {
    writes++; writeGen++;
    try { return await fn(); }
    finally { writes--; writeGen++; rev = STALE; }
  }

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
    var gen = writeGen;
    try {
      /* 3 回続けて読めなければ rev を付けずに引く（サーバーは一部欠けでも返す）。
         一部の読み取りがずっと失敗していると、他の人の変更がいつまでも入らないため */
      var useRev = rev && failStreak < 3;
      var json = await api('/db' + (useRev ? '?rev=' + encodeURIComponent(rev) : ''), { method: 'GET' });
      failStreak = 0;
      if (writes || gen !== writeGen) return;   /* 保存と行き違った結果。次の回で取り直す */
      if (json && json.unchanged) return;
      if (!json || !json.collections) return;
      state = json.collections;
      rev = json.rev || null;
      notify();
    } catch (e) {
      failStreak++;
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
      /* board.js の minutesLoad が使う。**実装していなかったので議事録タブが
         いつも空だった**（2026-10-01 修正）。まだ 1 度もポーリングしていなければ
         先に 1 回引いてから答える。 */
      get: async function () {
        if (!started) { started = true; startPolling(); }
        if (!Object.keys(state).length) { try { await poll(); } catch (_) {} }
        return docSnap(collection, docId);
      },
      set: async function (body) {
        await guarded(async function () {
          try {
            await api('/db', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: path, data: body }),
            });
          } catch (e) { throw mapWriteError(e); }
        });
        applyLocal(collection, docId, body);
        rev = STALE;                      /* 次のポーリングで必ず取り直す */
        notify(collection);
      },
      delete: async function () {
        await guarded(async function () {
          try {
            await api('/db?path=' + encodeURIComponent(path), { method: 'DELETE' });
          } catch (e) { throw mapWriteError(e); }
        });
        removeLocal(collection, docId);
        rev = STALE;
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
        var out = await guarded(async function () {
          try {
            return await api('/db', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ collection: name, data: body }),
            });
          } catch (e) { throw mapWriteError(e); }
        });
        applyLocal(name, (out && out.id) || String(Date.now()), body);
        rev = STALE;
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

  /* limits() は **サーバーが持つ**（値を 2 箇所に書かない）。
     1 回だけ GET して覚える。取れなければ控えめな既定で続ける。
     原本の実値は 65536 だが、こちらは揃えない（route.ts の §D を参照）。 */
  var LIMITS_FALLBACK = { maxPromptBytes: 65536, images: { maxCount: 8 } };
  var limitsPromise = null;
  function getLimits() {
    if (!limitsPromise) {
      limitsPromise = fetch(API + '/ai', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          return j && typeof j.maxPromptBytes === 'number' ? j : LIMITS_FALLBACK;
        })
        .catch(function () { return LIMITS_FALLBACK; });
    }
    return limitsPromise;
  }

  function fileToDataUrl(f) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(err('tool_error', '画像を読めませんでした')); };
      r.readAsDataURL(f);
    });
  }

  var sampleNs = {
    limits: function () { return getLimits(); },
    json: async function (promptOrTurns, opts) {
      opts = opts || {};
      var turns = Array.isArray(promptOrTurns)
        ? promptOrTurns.map(function (t) { return { role: t.role, content: String(t.content) }; })
        : [{ role: 'user', content: String(promptOrTurns) }];

      var lim = await getLimits();
      var maxImgs = (lim.images && lim.images.maxCount) || 0;
      var images = [];
      if (opts.images && opts.images.length) {
        if (!maxImgs) throw err('images_unavailable', 'このビューでは画像を送れません');
        for (var i = 0; i < Math.min(opts.images.length, maxImgs); i++) {
          var im = opts.images[i];
          images.push(typeof im === 'string' ? im : await fileToDataUrl(im));
        }
      }

      /* onText を渡されたときだけ中継つきで呼ぶ。
         原本は生成中に画面の文言を切り替えるためだけに使っていて、
         引数のテキストは見ていない。欠片が届けば同じ見た目になる。 */
      var wantStream = typeof opts.onText === 'function';

      var res;
      try {
        res = await fetch(API + '/ai', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          /* cache は原本と同じ扱い。false のときだけ毎回問い合わせる
             （board.js: 組織図・計画相談・プラン生成は false、直近の動きは既定） */
          body: JSON.stringify({
            turns: turns, images: images, stream: wantStream,
            cache: opts.cache === false ? false : undefined,
          }),
          signal: opts.signal,
        });
      } catch (e) {
        if (e && e.name === 'AbortError') throw err('cancelled');
        throw err('unavailable');
      }

      if (!wantStream) {
        var json = await res.json().catch(function () { return {}; });
        if (json && json.ok) return json.data;
        throw err((json && json.code) || 'tool_error', json && json.message);
      }
      return await readNdjson(res, opts.onText);
    },
  };

  /* NDJSON を 1 行ずつ読む。
     {"t":"delta","v":…} → onText / {"t":"done","data":…} → 戻り値 / {"t":"error","code":…} → throw
     **JSON の取り出しはサーバー側だけ。** ここでは組み立て直さない。 */
  async function readNdjson(res, onText) {
    if (!res.body) throw err('unavailable');
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '', acc = '', result, failed = null;

    var handle = function (raw) {
      var s = raw.trim();
      if (!s) return;
      var ev;
      try { ev = JSON.parse(s); } catch (_) { return; }   /* 途切れた行は捨てる */
      if (ev.t === 'delta') {
        /* 原本は {text: ここまでの全文, delta: 増分} を渡す（Utty 仕様 1-4）。
           board.js は引数を見ていないが、形は合わせておく。 */
        acc += ev.v;
        try { onText({ text: acc, delta: ev.v }); } catch (_) {}
      }
      else if (ev.t === 'done')  result = ev.data;
      else if (ev.t === 'error') failed = ev.code || 'tool_error';
    };

    for (;;) {
      var r;
      try { r = await reader.read(); }
      catch (e) { if (e && e.name === 'AbortError') throw err('cancelled'); throw err('unavailable'); }
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      var i;
      while ((i = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 1); }
    }
    handle(buf);

    if (failed) throw err(failed);
    if (result === undefined) throw err('invalid_json');
    return result;
  }

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
