# 🔌 MomsNest — API Documentation

**Version:** 1.0  
**Date:** March 4, 2026  
**API Type:** Supabase Client SDK (REST + Realtime WebSocket)  

---

## 1. Authentication API

All API calls use Supabase Auth JWT tokens. The client auto-attaches tokens after login.

### 1.1 Sign Up
```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
  options: {
    data: {
      name: 'Amira',
      username: 'amira_mom'
    }
  }
})
```

**Response:** `{ user: User, session: Session }`

### 1.2 Sign In
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword'
})
```

### 1.3 Sign Out
```typescript
await supabase.auth.signOut()
```

### 1.4 Get Session
```typescript
const { data: { session } } = await supabase.auth.getSession()
```

---

## 2. Database API (CRUD Endpoints)

All database operations use `supabase.from('table_name').*` syntax. Below are the key endpoints organized by domain.

### 2.1 Profiles

| Operation | Method | Example |
|-----------|--------|---------|
| Get profile | `SELECT` | `supabase.from('profiles').select('*, profile_stats(*)').eq('id', userId).single()` |
| Update profile | `UPDATE` | `supabase.from('profiles').update({ name, bio, avatar_url }).eq('id', userId)` |
| Search users | `SELECT` | `supabase.from('profiles').select('*').ilike('name', '%query%')` |

### 2.2 Posts

| Operation | Method | Example |
|-----------|--------|---------|
| Create post | `INSERT` | `supabase.from('posts').insert({ content, media_urls, user_id, circle_id })` |
| Get feed | `SELECT` | `supabase.from('posts').select('*, profiles!inner(*)').order('created_at', { ascending: false })` |
| Like post | `INSERT` | `supabase.from('likes').insert({ post_id, user_id })` |
| Unlike post | `DELETE` | `supabase.from('likes').delete().eq('post_id', id).eq('user_id', userId)` |
| Add comment | `INSERT` | `supabase.from('comments').insert({ post_id, content, user_id, parent_id })` |
| Save post | `INSERT` | `supabase.from('saves').insert({ post_id, user_id })` |

### 2.3 Shop Items

| Operation | Method | Example |
|-----------|--------|---------|
| List items | `SELECT` | `supabase.from('shop_items').select('*, shop_item_stats(*)').eq('status', 'active')` |
| Create item | `INSERT` | `supabase.from('shop_items').insert({ title, price, images, category, seller_id })` |
| Search items | `SELECT` | `supabase.from('shop_items').select('*').ilike('title', '%query%')` |
| Get by category | `SELECT` | `supabase.from('shop_items').select('*').eq('category', category)` |

### 2.4 Orders

| Operation | Method | Example |
|-----------|--------|---------|
| Create order | `INSERT` | `supabase.from('orders').insert({ buyer_id, subtotal, total, order_number })` |
| Get user orders | `SELECT` | `supabase.from('orders').select('*, order_items(*, shop_items(*))').eq('buyer_id', userId)` |
| Update status | `UPDATE` | `supabase.from('orders').update({ status: 'shipped' }).eq('id', orderId)` |

### 2.5 Questions & Answers

| Operation | Method | Example |
|-----------|--------|---------|
| Post question | `INSERT` | `supabase.from('questions').insert({ question, category, user_id, is_anonymous })` |
| Get questions | `SELECT` | `supabase.from('questions').select('*, profiles(*)').order('created_at', { ascending: false })` |
| Post answer | `INSERT` | `supabase.from('answers').insert({ answer, question_id, user_id })` |
| Vote answer | `INSERT` | `supabase.from('answer_votes').insert({ answer_id, user_id })` |

### 2.6 SOS Alerts

| Operation | Method | Example |
|-----------|--------|---------|
| Create alert | `INSERT` | `supabase.from('sos_alerts').insert({ sos_type, description, urgency, location_lat, location_lng, user_id })` |
| Get nearby alerts | `SELECT` | `supabase.from('sos_alerts').select('*').eq('status', 'active')` |
| Accept help | `INSERT` | `supabase.from('sos_helpers').insert({ alert_id, helper_user_id })` |
| Send SOS message | `INSERT` | `supabase.from('sos_messages').insert({ alert_id, message_text, sender_id })` |

### 2.7 Circles

| Operation | Method | Example |
|-----------|--------|---------|
| Create circle | `INSERT` | `supabase.from('circles').insert({ name, description, category, creator_id })` |
| Join circle | `INSERT` | `supabase.from('circle_members').insert({ circle_id, user_id, role: 'member' })` |
| Create event | `INSERT` | `supabase.from('circle_events').insert({ circle_id, title, event_date, event_type })` |
| Book service | `INSERT` | `supabase.from('circle_service_bookings').insert({ service_id, user_id, booking_date })` |

### 2.8 Wallet & Coins

| Operation | Method | Example |
|-----------|--------|---------|
| Get balance | `SELECT` | `supabase.from('coin_wallets').select('*').eq('user_id', userId).single()` |
| Get transactions | `SELECT` | `supabase.from('coin_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false })` |
| Top up | `INSERT` | `supabase.from('coin_topups').insert({ user_id, amount, payment_method })` |

---

## 3. Edge Functions API

### 3.1 Generate AI Insight
```
POST /functions/v1/generate-ai-insight
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "question_id": "uuid",
  "question_text": "How do I handle colic?"
}

Response: { "insight": "Colic typically peaks around 6 weeks..." }
```

### 3.2 Get Mapbox Token
```
POST /functions/v1/get-mapbox-token
Authorization: Bearer <jwt_token>

Response: { "token": "pk.eyJ1..." }
```

### 3.3 Send Push Notification
```
POST /functions/v1/send-push-notification
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "user_id": "uuid",
  "title": "New message",
  "body": "Sara sent you a message"
}

Response: { "success": true }
```

### 3.4 Notify Emergency Contacts
```
POST /functions/v1/notify-emergency-contacts
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "user_id": "uuid",
  "alert_id": "uuid",
  "location": { "lat": 9.0192, "lng": 38.7525 }
}

Response: { "contacted": 3 }
```

---

## 4. Realtime Subscriptions

```typescript
// Subscribe to new posts
supabase.channel('posts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'posts'
  }, (payload) => {
    console.log('New post:', payload.new)
  })
  .subscribe()

// Subscribe to messages in a conversation
supabase.channel(`messages:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    console.log('New message:', payload.new)
  })
  .subscribe()
```

---

## 5. Error Codes

| Code | Description | Handling |
|------|-------------|----------|
| `PGRST116` | Row not found (single) | Create resource or show 404 |
| `PGRST301` | JWT invalid/expired | Re-authenticate user |
| `23505` | Unique constraint violation | Show "already exists" message |
| `23503` | Foreign key violation | Validate relationships before insert |
| `42501` | RLS policy violation | User lacks permission |
| `NETWORK_ERROR` | Connection failed | Show offline banner, use cache |

---

## 6. Rate Limits

| Resource | Limit | Window |
|----------|-------|--------|
| Auth requests | 30 | Per minute |
| Database requests | 500 | Per second (project level) |
| Storage uploads | 5MB per file | Per request |
| Edge Function invocations | 500K | Per month (Pro plan) |
| Realtime connections | 200 | Concurrent |
