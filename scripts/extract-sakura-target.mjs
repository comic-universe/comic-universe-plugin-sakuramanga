import fs from 'node:fs/promises'
import path from 'node:path'

const targetRoot =
  process.env.SAKURA_TARGET_DIR ||
  '/Users/pablo/Projects/Comic Universe/comic-universe-web-scrapper/target/sakura-mangas'
const outputFile = process.env.SAKURA_ENV_FILE || path.resolve(process.cwd(), '.env.local')

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return walk(full)
      return full
    })
  )
  return files.flat()
}

function firstMatch(text, regexes) {
  for (const regex of regexes) {
    const m = text.match(regex)
    if (m && m[1]) return m[1].trim()
  }
  return ''
}

function mergeEnv(existing, updates) {
  const lines = existing ? existing.split(/\r?\n/) : []
  const map = new Map()
  for (const line of lines) {
    const idx = line.indexOf('=')
    if (idx > 0) {
      map.set(line.slice(0, idx).trim(), line.slice(idx + 1))
    }
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v) map.set(k, v)
    else if (!map.has(k)) map.set(k, '')
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
}

async function main() {
  const allFiles = await walk(targetRoot)
  const textFiles = allFiles.filter((file) => /\.(html?|js|txt)$/i.test(file))

  let token = ''
  let subtoken = ''
  let csrf = ''
  let signature = ''
  let verification1 = ''
  let verification2 = ''
  let proof = ''
  let challenge = ''

  for (const file of textFiles) {
    const text = await fs.readFile(file, 'utf8')
    if (!token) {
      token = firstMatch(text, [
        /<meta[^>]*\btoken=["']([^"']+)["']/i,
        /\btoken["']?\s*[:=]\s*["']([^"']+)["']/i
      ])
    }
    if (!subtoken) {
      subtoken = firstMatch(text, [
        /<meta[^>]*\bsubtoken=["']([^"']+)["']/i,
        /\bsubtoken["']?\s*[:=]\s*["']([^"']+)["']/i
      ])
    }
    if (!csrf) {
      csrf = firstMatch(text, [
        /<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i,
        /\bx-csrf-token["']?\s*[:=]\s*["']([^"']+)["']/i
      ])
    }
    if (!signature) {
      signature = firstMatch(text, [
        /\bx-client-signature["']?\s*[:=]\s*["']([^"']+)["']/i,
        /\b([A-Z0-9]{5}(?:-[A-Z0-9]{5}){2})\b/
      ])
    }
    if (!verification1) {
      verification1 = firstMatch(text, [
        /\bx-verification-key-1["']?\s*[:=]\s*["']([^"']+)["']/i,
        /\b([a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9-]{20,})\b/i
      ])
    }
    if (!verification2) {
      verification2 = firstMatch(text, [
        /\bx-verification-key-2["']?\s*[:=]\s*["']([^"']+)["']/i,
        /\b([a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9-]{20,})\b/i
      ])
    }
    if (!proof) {
      proof = firstMatch(text, [/\bproof["']?\s*[:=]\s*["']([a-f0-9]{32})["']/i])
    }
    if (!challenge) {
      challenge = firstMatch(text, [
        /\bchallenge["']?\s*[:=]\s*["']([^"']{30,})["']/i,
        /\bchallenge=([^&"'\\\s]{30,})/i
      ])
    }
  }

  const updates = {
    SAKURA_CSRF_TOKEN: csrf,
    SAKURA_CLIENT_SIGNATURE: signature,
    SAKURA_VERIFICATION_KEY_1: verification1,
    SAKURA_VERIFICATION_KEY_2: verification2,
    SAKURA_PROOF: proof,
    SAKURA_CHALLENGE: challenge,
    SAKURA_TOKEN: token,
    SAKURA_SUBTOKEN: subtoken,
    SAKURA_COOKIE: '',
    SAKURA_PHPSESSID: '',
    SAKURA_CF_CLEARANCE: ''
  }

  let existing = ''
  try {
    existing = await fs.readFile(outputFile, 'utf8')
  } catch {
    existing = ''
  }

  const merged = mergeEnv(existing, updates)
  await fs.writeFile(outputFile, `${merged}\n`, 'utf8')

  console.log(`Updated ${outputFile}`)
  console.log('Extracted:')
  console.log(`- SAKURA_CSRF_TOKEN: ${csrf ? 'yes' : 'no'}`)
  console.log(`- SAKURA_CLIENT_SIGNATURE: ${signature ? 'yes' : 'no'}`)
  console.log(`- SAKURA_VERIFICATION_KEY_1: ${verification1 ? 'yes' : 'no'}`)
  console.log(`- SAKURA_VERIFICATION_KEY_2: ${verification2 ? 'yes' : 'no'}`)
  console.log(`- SAKURA_PROOF: ${proof ? 'yes' : 'no'}`)
  console.log(`- SAKURA_CHALLENGE: ${challenge ? 'yes' : 'no'}`)
  console.log(`- SAKURA_TOKEN: ${token ? 'yes' : 'no'}`)
  console.log(`- SAKURA_SUBTOKEN: ${subtoken ? 'yes' : 'no'}`)
  console.log('Missing by design:')
  console.log('- SAKURA_COOKIE / SAKURA_PHPSESSID / SAKURA_CF_CLEARANCE (must come from live browser session)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
