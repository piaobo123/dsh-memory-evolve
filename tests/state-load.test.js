/**
 * dsh-memory-evolve 运行态配置加载的防回归测试。
 *
 * 背景（2026-10-01 实测）：`loadState` 在插件 apply() 期间跑，以前只放过 ENOENT、
 * 其它错误一律 throw —— 于是「plugin-state.json 带 BOM / 半截 / 不是 JSON」会直接把
 * 整个 profile 的启动干掉（沙箱复现：`Unexpected token '﻿'` → dsh web 起不来）。
 * 现在必须：BOM 容忍、坏文件退化成默认值、绝不抛。
 *
 * 跑法：node --test tests/state-load.test.js
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { loadState } = await import('../lib/index.js')

const dir = mkdtempSync(join(tmpdir(), 'dsh-me-state-'))
const at = (name) => join(dir, name)

test('loadState: 文件不存在 → 空对象（不抛）', () => {
  assert.deepEqual(loadState(at('missing.json')), {})
})

test('loadState: 正常 JSON', () => {
  const p = at('ok.json')
  writeFileSync(p, JSON.stringify({ bookmarkEnabled: true }), 'utf8')
  assert.deepEqual(loadState(p), { bookmarkEnabled: true })
})

test('★ loadState: 带 UTF-8 BOM 的 JSON 也要认（以前会让整个 harness 起不来）', () => {
  const p = at('bom.json')
  writeFileSync(p, '\uFEFF' + JSON.stringify({ bookmarkEnabled: true, notifyEnabled: false }), 'utf8')
  assert.deepEqual(loadState(p), { bookmarkEnabled: true, notifyEnabled: false })
})

test('★ loadState: 坏 JSON → 退化成空对象（不抛，绝不阻断启动）', () => {
  const p = at('broken.json')
  writeFileSync(p, '{ "bookmarkEnabled": tr', 'utf8')
  assert.deepEqual(loadState(p), {})
})

test('loadState: 顶层不是对象（数组/字符串）→ 空对象', () => {
  const p = at('array.json')
  writeFileSync(p, '[1,2,3]', 'utf8')
  assert.deepEqual(loadState(p), {})
})

process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }) } catch { /* 清理失败无所谓 */ } })
