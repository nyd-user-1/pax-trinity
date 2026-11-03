#!/usr/bin/env node
// The audience export's one way in and out of the bucket (perf round 2, 2026-11-02). Every object under exports/
// goes up with Cache-Control, so CloudFront answers from the edge instead of S3. index.json and the q/ files can be
// stored brotli-11 with Content-Encoding: br, which browsers decode on their own (index.json: 5.7 MB raw, 509 KB
// stored). S3 hands the stored bytes to everything else as they are, so every read here decodes them, and the app's
// own reader does the same (src/lib/chat-data/america-thinks.ts, readExport).
//
// A push keeps the encoding the bucket already uses: index.json and q/ go up brotli when the bucket's index.json is
// stored brotli, plain when it is plain. Only --brotli switches a plain bucket over, and it must wait until every
// deployed app that reads the bucket decodes (readExport), or Chat's data tools read bytes they can't parse.
//
//   node scripts/exports/sync.mjs pull <dir>                  every exports/ object into <dir>, decoded (local dev's copy)
//   node scripts/exports/sync.mjs get <dir> <key>...          those keys into <dir>, decoded
//   node scripts/exports/sync.mjs push <dir> [<key>...]       <dir>'s .json files (or those keys) up to exports/
//        --all      upload even where the bucket already holds the same bytes (to reset the headers)
//        --brotli   store index.json and q/ brotli even though the bucket's index.json is plain (the switch-over)
//        --plain    store everything plain (the way back)
//        --backup   first copy each object about to change to <key>.orig, unless one is there already
//        --dry-run  say what would go up, upload nothing
//   node scripts/exports/sync.mjs restore [--dry-run]         copy every <key>.orig back over <key>
//
// The bucket defaults to the new account's (--bucket, --profile, --region, --prefix override it).

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import zlib from "node:zlib"

import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

export const CACHE_CONTROL = "max-age=300, s-maxage=300, stale-while-revalidate=86400"
export const DEFAULTS = { bucket: "pax-trinity-audience-613473203863", profile: "pax-new", region: "us-east-2", prefix: "exports/" }

/** Whether a key is stored brotli: the index and the per-question files, the ones the pages fetch. */
export const storedBrotli = (key) => key === "index.json" || key.startsWith("q/")

const brotli = promisify(zlib.brotliCompress)
/** Brotli at quality 11, its window sized to the file (the largest a browser decodes is 24). */
export const compress = (buf) =>
  brotli(buf, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_LGWIN]: Math.min(24, Math.max(10, Math.ceil(Math.log2(buf.length + 1)))),
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    },
  })

const clients = new Map()
/** CopySource: the bucket and key, URL-encoded a segment at a time. */
const source = (o, key) => [o.bucket, ...(o.prefix + key).split("/")].map(encodeURIComponent).join("/")

const s3Of = (o) => {
  const id = `${o.profile}|${o.region}`
  if (!clients.has(id)) clients.set(id, new S3Client({ region: o.region, profile: o.profile }))
  return clients.get(id)
}

/** Runs `fn` over `items`, `n` at a time. */
async function pool(items, n, fn) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      await fn(items[i], i)
    }
  }))
}

/** Every key under the prefix (relative to it) with its ETag, the .orig backups included. */
export async function listExports(opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  const all = new Map()
  let token
  do {
    const r = await s3Of(o).send(new ListObjectsV2Command({ Bucket: o.bucket, Prefix: o.prefix, ContinuationToken: token }))
    for (const c of r.Contents ?? []) all.set(c.Key.slice(o.prefix.length), c.ETag?.replaceAll('"', ""))
    token = r.NextContinuationToken
  } while (token)
  return all
}

/** One object's bytes, decoded when it is stored brotli; null when there is none. */
export async function readExport(key, opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  try {
    const r = await s3Of(o).send(new GetObjectCommand({ Bucket: o.bucket, Key: o.prefix + key }))
    const body = Buffer.from(await r.Body.transformToByteArray())
    return r.ContentEncoding === "br" ? zlib.brotliDecompressSync(body) : body
  } catch (e) {
    if (e.name === "NoSuchKey") return null
    throw e
  }
}

/** Those keys into `dir`, decoded. */
export async function getExports(dir, keys, opts = {}) {
  await pool(keys, 16, async (key) => {
    const buf = await readExport(key, opts)
    if (!buf) throw new Error(`${key}: not in the bucket`)
    const to = path.join(dir, key)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.writeFileSync(to, buf)
  })
  return keys.length
}

/** Every exports/ object into `dir`, decoded. */
export async function pullExports(dir, opts = {}) {
  const keys = [...(await listExports(opts)).keys()].filter((k) => !k.endsWith(".orig"))
  return getExports(dir, keys, opts)
}

const jsonUnder = (dir) =>
  fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".json"))
    .map((d) => path.relative(dir, path.join(d.parentPath ?? d.path, d.name)).split(path.sep).join("/"))
    .sort()

/** Whether the bucket's index.json is stored brotli now. */
export async function bucketIsBrotli(opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  try {
    return (await s3Of(o).send(new HeadObjectCommand({ Bucket: o.bucket, Key: `${o.prefix}index.json` }))).ContentEncoding === "br"
  } catch (e) {
    if (e.name === "NotFound") return false
    throw e
  }
}

/** `dir`'s .json files (or just `keys`) up to the bucket: Cache-Control on all; index.json and q/ brotli-11 when the
 *  bucket already stores them so, or --brotli says to. */
export async function pushExports(dir, keys = null, opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  const want = keys?.length ? keys : jsonUnder(dir)
  const there = await listExports(o)
  const brotliOn = !o.plain && (o.brotli || (await bucketIsBrotli(o)))
  const s = { uploaded: 0, unchanged: 0, raw: 0, stored: 0, backedUp: 0, brotli: brotliOn }
  await pool(want, 8, async (key) => {
    const raw = fs.readFileSync(path.join(dir, key))
    JSON.parse(raw) // never upload a file that isn't whole JSON
    const br = brotliOn && storedBrotli(key)
    const body = br ? await compress(raw) : raw
    const md5 = crypto.createHash("md5").update(body).digest("hex")
    if (!o.all && there.get(key) === md5) return void s.unchanged++
    s.uploaded++
    s.raw += raw.length
    s.stored += body.length
    if (o.dryRun) return
    if (o.backup && there.has(key) && !there.has(`${key}.orig`)) {
      await s3Of(o).send(new CopyObjectCommand({ Bucket: o.bucket, Key: `${o.prefix}${key}.orig`, CopySource: source(o, key) }))
      s.backedUp++
    }
    await s3Of(o).send(new PutObjectCommand({
      Bucket: o.bucket,
      Key: o.prefix + key,
      Body: body,
      ContentType: "application/json",
      CacheControl: CACHE_CONTROL,
      ...(br ? { ContentEncoding: "br" } : {}),
    }))
  })
  return s
}

/** Every <key>.orig copied back over <key>, as it was (bytes and headers). */
export async function restoreExports(opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  const origs = [...(await listExports(o)).keys()].filter((k) => k.endsWith(".orig"))
  if (!o.dryRun)
    await pool(origs, 16, (k) => s3Of(o).send(new CopyObjectCommand({ Bucket: o.bucket, Key: o.prefix + k.slice(0, -5), CopySource: source(o, k) })))
  return origs.length
}

async function main(argv) {
  const opts = {}
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (["--bucket", "--profile", "--region", "--prefix"].includes(a)) opts[a.slice(2)] = argv[++i]
    else if (a === "--all") opts.all = true
    else if (a === "--plain") opts.plain = true
    else if (a === "--brotli") opts.brotli = true
    else if (a === "--backup") opts.backup = true
    else if (a === "--dry-run") opts.dryRun = true
    else rest.push(a)
  }
  const [cmd, dir, ...keys] = rest
  const at = `s3://${opts.bucket ?? DEFAULTS.bucket}/${opts.prefix ?? DEFAULTS.prefix}`
  if (opts.brotli && opts.plain) {
    console.error("--brotli and --plain contradict each other")
    process.exit(2)
  }
  if (cmd === "pull" && dir) console.log(`${await pullExports(dir, opts)} objects from ${at} into ${dir}, decoded`)
  else if (cmd === "get" && dir && keys.length) console.log(`${await getExports(dir, keys, opts)} objects from ${at} into ${dir}, decoded`)
  else if (cmd === "push" && dir) {
    const s = await pushExports(dir, keys, opts)
    const mb = (n) => (n < 1e6 ? `${(n / 1e3).toFixed(1)} KB` : `${(n / 1e6).toFixed(1)} MB`)
    console.log(`${opts.dryRun ? "would upload" : "uploaded"} ${s.uploaded} to ${at} (${mb(s.raw)} raw, ${mb(s.stored)} stored, index.json and q/ ${s.brotli ? "brotli" : "plain"}), ${s.unchanged} unchanged${s.backedUp ? `, ${s.backedUp} backed up to .orig` : ""}`)
  } else if (cmd === "restore") console.log(`${opts.dryRun ? "would restore" : "restored"} ${await restoreExports(opts)} objects from their .orig copies in ${at}`)
  else {
    console.error("usage: sync.mjs pull <dir> | get <dir> <key>... | push <dir> [<key>...] [--all] [--brotli | --plain] [--backup] [--dry-run] | restore [--dry-run]")
    process.exit(2)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main(process.argv.slice(2))
