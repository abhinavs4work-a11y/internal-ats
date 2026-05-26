import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Run: node --env-file=.env.local scripts/seed-users.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const PASSWORD = 'Avkalan@123'

const USERS = [
  { email: 'nitish.kumar@avkalan.ai',       name: 'Nitish Kumar',       role: 'Recruiter' },
  { email: 'abhinav.srivastava@avkalan.ai', name: 'Abhinav Srivastava', role: 'Recruiter' },
  { email: 'ayushi.mandhyan@avkalan.ai',    name: 'Ayushi Mandhyan',    role: 'Recruiter' },
]

for (const u of USERS) {
  process.stdout.write(`Creating ${u.email} ... `)

  // 1. Create Supabase Auth user
  let userId
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
  })

  if (error) {
    if (error.code === 'email_exists' || error.message?.includes('already')) {
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers()
      if (listErr) { console.error('\nlistUsers error:', listErr); process.exit(1) }
      userId = list.users.find(x => x.email === u.email)?.id
      if (!userId) { console.error('\nCould not find existing user'); process.exit(1) }
    } else {
      console.error('\nAuth error:', error)
      process.exit(1)
    }
  } else {
    userId = data.user.id
  }

  // 2. Upsert into users table
  const { error: dbErr } = await supabase
    .from('users')
    .upsert(
      {
        id:         randomUUID(),
        supabase_id: userId,
        email:      u.email,
        name:       u.name,
        role:       u.role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'supabase_id' }
    )

  if (dbErr) { console.error('\nDB error:', dbErr); process.exit(1) }

  console.log('✓')
}

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✓  All users created')
console.log('   Password for all: Avkalan@123')
for (const u of USERS) console.log(`   ${u.email}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
