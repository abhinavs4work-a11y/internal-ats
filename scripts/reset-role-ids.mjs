import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Run: node --env-file=.env.local scripts/reset-role-ids.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ─── Shorthand algorithm (mirrors src/lib/utils.ts) ──────────────────────────
function clientShorthand(name) {
  if (name.includes('/')) {
    return name.split('/').map(p => clientShorthand(p.trim())).join('/')
  }
  const words = name.trim().toUpperCase().split(/\s+/)
  if (words.length === 1) {
    const word = words[0]
    if (word.length <= 4) return word
    const rest = word.slice(1).replace(/[AEIOU]/g, '')
    return (word[0] + rest).slice(0, 4)
  }
  const take = words.length === 2 ? 3 : 2
  return words.map(w => w.slice(0, take)).join('').slice(0, 6)
}

function generateRoleId(clientName, sequence) {
  const shorthand = clientShorthand(clientName)
  const seq = String(sequence).padStart(2, '0')
  return `${shorthand}-${seq}`.slice(0, 12)
}

// ─── Fetch all clients ────────────────────────────────────────────────────────
const { data: clients, error: clientErr } = await supabase
  .from('clients')
  .select('id, name')

if (clientErr) { console.error('clients fetch error:', clientErr); process.exit(1) }

const clientMap = new Map(clients.map(c => [c.id, c.name]))

// ─── Fetch all roles ordered by created_date ──────────────────────────────────
const { data: roles, error: rolesErr } = await supabase
  .from('roles')
  .select('id, role_id, client_id, created_date')
  .order('created_date', { ascending: true })

if (rolesErr) { console.error('roles fetch error:', rolesErr); process.exit(1) }

// ─── Group by client ──────────────────────────────────────────────────────────
const byClient = new Map()
for (const role of roles) {
  const cid = role.client_id
  if (!byClient.has(cid)) byClient.set(cid, [])
  byClient.get(cid).push(role)
}

// ─── Assign new IDs and update ────────────────────────────────────────────────
console.log('')
let updated = 0
let skipped = 0

for (const [clientId, clientRoles] of byClient) {
  const clientName = clientMap.get(clientId) ?? 'UNKNOWN'
  console.log(`Client: ${clientName}`)

  for (let i = 0; i < clientRoles.length; i++) {
    const role = clientRoles[i]
    const newId = generateRoleId(clientName, i + 1)

    if (role.role_id === newId) {
      console.log(`  ✓  ${newId}  (no change)`)
      skipped++
      continue
    }

    process.stdout.write(`  ${role.role_id} → ${newId} ... `)
    const { error: upErr } = await supabase
      .from('roles')
      .update({ role_id: newId })
      .eq('id', role.id)

    if (upErr) {
      console.log(`✗  ${upErr.message}`)
    } else {
      console.log('✓')
      updated++
    }
  }
}

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`✓  Updated : ${updated}`)
console.log(`   Skipped : ${skipped}  (already correct)`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
