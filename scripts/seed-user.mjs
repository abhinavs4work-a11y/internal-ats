import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing required environment variables. Run with: node --env-file=.env.local scripts/seed-user.mjs')
  process.exit(1)
}

const EMAIL    = 'admin@avkalan.ai'
const PASSWORD = 'Avkalan@123'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// 1. Create or fetch Supabase Auth user (email_confirm: true skips confirmation email)
console.log(`Creating Supabase Auth user: ${EMAIL} ...`)
let userId
const { data, error } = await supabase.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
})

if (error) {
  if (error.message?.includes('already been registered') || error.message?.includes('already exists') || error.code === 'email_exists') {
    console.log('User already exists in Supabase Auth — fetching...')
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) throw listError
    const existing = listData.users.find(u => u.email === EMAIL)
    if (!existing) throw new Error('Could not find existing user by email')
    userId = existing.id
  } else {
    throw error
  }
} else {
  userId = data.user.id
}

console.log(`✓ Auth user ready: ${userId}`)

// 2. Upsert into users table via PostgREST (service role bypasses RLS)
console.log('Upserting into users table...')
const { error: dbError } = await supabase
  .from('users')
  .upsert(
    { id: randomUUID(), supabase_id: userId, email: EMAIL, name: 'Admin', role: 'Admin', updated_at: new Date().toISOString() },
    { onConflict: 'supabase_id' }
  )

if (dbError) {
  if (dbError.code === '42P01') {
    console.error('\n⚠️  The "users" table does not exist yet.')
    console.error('Please run the schema SQL in your Supabase SQL Editor first.')
    console.error('Go to: https://supabase.com/dashboard/project/monrmtasnhrmccutyoam/sql/new')
    console.error('Then re-run this script.\n')
    process.exit(1)
  }
  throw dbError
}

console.log(`✓ User upserted in users table`)
console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`✓ Login credentials`)
console.log(`  Email:    ${EMAIL}`)
console.log(`  Password: ${PASSWORD}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
