// ─── PtAI: 保存時の由来判定（db-write.ts の純粋関数）────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     --test scripts/ptai-db-write.test.mts
//
// ネットワークは使わない。
//   ownerOf    … Notion の「担当3」→ ダッシュボード表記（= 商談の owner）
//   nodeSource … 組織図ノードが 画面入力 / AI 生成 / 名刺 のどれか

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ownerOf, nodeSource } from '../src/lib/ptai/db-write.ts';

// ── owner（担当）──────────────────────────────────────────────────────────
// 操作者ではなく**アカウントの担当**。正本は Notion（§9-1）。

test('Notion 表記をダッシュボード表記に直す', () => {
  assert.equal(ownerOf(['Eri Kitada']),    'Eri');
  assert.equal(ownerOf(['BB']),            'Baba');
  assert.equal(ownerOf(['Shinichi Nagai']), 'Paul');
});

test('担当が複数いるときは先頭を採る（Twenty 側は単一値の TEXT）', () => {
  assert.equal(ownerOf(['Kubotie', 'Eri Kitada']), 'Kubotie');
});

test('「その他」は担当として扱わず、次の人を見る', () => {
  assert.equal(ownerOf(['その他', 'Eri Kitada']), 'Eri');
  assert.equal(ownerOf(['その他']), null);
});

test('対応表に無い名前はそのまま通す（勝手に捨てない）', () => {
  assert.equal(ownerOf(['新しい人']), '新しい人');
});

test('空・未設定は null。空文字を書き込まない', () => {
  assert.equal(ownerOf([]), null);
  assert.equal(ownerOf(undefined), null);
  assert.equal(ownerOf(['']), null);
});

// ── 組織図ノードの入力元 ────────────────────────────────────────────────────
// 2026-10-01 まで全部 'ui' で入れていたので、AI 生成が画面入力に見えていた。

test('画面で足したノードは ui', () => {
  assert.equal(nodeSource('手入力'), 'ui');
});

test('名刺から読み取ったノードは card', () => {
  assert.equal(nodeSource('名刺（card1.jpg）'), 'card');
  assert.equal(nodeSource('名刺'), 'card');
});

test('資料から AI が組み立てたノードは ai', () => {
  assert.equal(nodeSource('議事録 2026-09-12'), 'ai');
  assert.equal(nodeSource('組織資料（repo）'), 'ai');
});

test('src が空のノードも ai（手入力は必ず「手入力」が入る）', () => {
  assert.equal(nodeSource(''), 'ai');
});

test('返すのは Twenty の選択肢にある 3 値だけ', () => {
  const allowed = new Set(['ui', 'ai', 'card']);
  for (const s of ['手入力', '名刺（a.png）', '', '議事録', 'なにか']) {
    assert.ok(allowed.has(nodeSource(s)), `${s} → ${nodeSource(s)}`);
  }
});
