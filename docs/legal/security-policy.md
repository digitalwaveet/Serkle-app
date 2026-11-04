# Security Policy

**MomsNest — Security Policy**  
**Version:** 1.0  
**Effective Date:** March 4, 2026  
**Classification:** Internal / Public  

---

## 1. Purpose

This Security Policy defines the security framework, controls, and procedures that MomsNest implements to protect user data, platform integrity, and service availability. It establishes security standards for development, deployment, and operations.

---

## 2. Scope

This policy applies to:
- All MomsNest application components (frontend, backend, native apps)
- All data stored, processed, or transmitted by MomsNest
- All team members with access to production systems
- All third-party service providers handling MomsNest data

---

## 3. Security Architecture

### 3.1 Authentication & Access Control

| Control | Implementation |
|---------|---------------|
| **User Authentication** | Supabase Auth (GoTrue) with email + password |
| **Password Storage** | bcrypt hashing (never stored in plaintext) |
| **Session Management** | JWT with 1-hour access token, 7-day refresh token |
| **Token Storage (Web)** | `localStorage` with automatic token refresh |
| **Token Storage (Native)** | Capacitor `Preferences` (encrypted key-value store) |
| **Session Invalidation** | Automatic on sign-out, token expiry, or auth error |
| **Failed Login Handling** | Supabase rate limiting (30 requests/minute) |
| **Multi-Factor Authentication** | Planned for Phase 2 |

### 3.2 Authorization

| Level | Mechanism |
|-------|-----------|
| **Database Level** | Row Level Security (RLS) on all tables |
| **Application Level** | Protected routes with `ProtectedRoute` component |
| **API Level** | JWT verification on all Supabase requests |
| **Edge Function Level** | Auth header validation before execution |

### 3.3 RLS Policy Examples
```sql
-- Users can only read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Posts are readable by all authenticated users
CREATE POLICY "Authenticated users can read posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

-- Users can only delete their own posts
CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 4. Data Protection

### 4.1 Encryption

| Layer | Standard | Protocol |
|-------|----------|----------|
| **Data in Transit** | TLS 1.3 | HTTPS for all API calls, WSS for Realtime |
| **Data at Rest** | AES-256 | Supabase database and storage encryption |
| **Password Hashing** | bcrypt | Supabase Auth default |
| **JWT Signing** | HS256 | HMAC with SHA-256 |

### 4.2 Sensitive Data Handling

| Data Type | Classification | Handling |
|-----------|---------------|----------|
| Passwords | **Critical** | bcrypt-hashed, never logged, never transmitted in plaintext |
| JWT Tokens | **Critical** | Short-lived, auto-refreshed, cleared on sign-out |
| Location Data | **Sensitive** | Opt-in only, stored with RLS, used for SOS only |
| Financial Data | **Sensitive** | Card last-four only (no full card numbers stored) |
| Personal Info | **Confidential** | Encrypted at rest, RLS-protected, deletable on request |
| Public Content | **Public** | Accessible to authenticated users |

### 4.3 Data Minimization
- We collect only data necessary for the stated features
- Location data is collected only when users actively enable it
- Camera access is requested only when uploading media
- FCM tokens are stored only if notification permission is granted

---

## 5. Application Security

### 5.1 Frontend Security Controls

| Threat | Mitigation |
|--------|------------|
| **Cross-Site Scripting (XSS)** | React's default JSX escaping; no `dangerouslySetInnerHTML` |
| **Cross-Site Request Forgery (CSRF)** | JWT-based auth (not cookie-based); no CSRF vulnerability |
| **SQL Injection** | Supabase parameterized queries; no raw SQL from client |
| **Input Validation** | Zod schema validation on all form inputs |
| **Dependency Vulnerabilities** | Regular `npm audit` scans; pinned major versions |
| **Sensitive Data in Code** | Environment variables for all secrets (`.env` file, not committed) |
| **Error Information Leakage** | React Error Boundary catches rendering errors; no stack traces to users |
| **Insecure Direct Object References** | RLS policies prevent unauthorized data access |

### 5.2 API Security Controls

| Control | Implementation |
|---------|---------------|
| **Authentication Required** | All API endpoints require valid JWT |
| **Rate Limiting** | Supabase built-in rate limits (auth: 30/min, DB: 500/sec) |
| **Request Validation** | Supabase validates types and constraints |
| **Error Handling** | Generic error messages to clients; detailed logs server-side |
| **CORS** | Configured via Supabase dashboard |
| **Content Security Policy** | Planned for production deployment |

### 5.3 Edge Function Security

| Control | Implementation |
|---------|---------------|
| **Auth Verification** | JWT token validation before function execution |
| **Secret Management** | Supabase Vault for API keys (Mapbox, FCM) |
| **Input Sanitization** | Request body validation in each function |
| **Least Privilege** | Functions only access required database tables |
| **Timeout** | Maximum execution time enforced by Supabase |

---

## 6. Infrastructure Security

### 6.1 Network Security

| Control | Description |
|---------|-------------|
| **HTTPS Enforcement** | All traffic encrypted via TLS 1.3 |
| **CDN Protection** | Cloudflare DDoS protection and WAF |
| **WebSocket Security** | WSS (encrypted) for Realtime subscriptions |
| **API Gateway** | Supabase Kong API gateway with rate limiting |

### 6.2 Platform Security

| Platform | Security Controls |
|----------|------------------|
| **Supabase** | ISO 27001, SOC 2 Type II compliant; encrypted backups; automated patching |
| **Cloudflare** | DDoS mitigation; WAF; SSL/TLS management |
| **Firebase (FCM)** | Google Cloud security; encrypted notification delivery |
| **Capacitor (Native)** | App signing; ProGuard obfuscation (Android); secure storage |

---

## 7. Native App Security (Capacitor)

| Control | Implementation |
|---------|---------------|
| **Session Storage** | `@capacitor/preferences` (encrypted native key-value store) |
| **Debug Mode** | `webContentsDebuggingEnabled: false` in production |
| **Mixed Content** | `allowMixedContent: false` (prevents HTTP in HTTPS context) |
| **URL Auth Detection** | Disabled on native (`detectSessionInUrl: false`) |
| **App Signing** | Android APK/AAB signed with release keystore |
| **ProGuard** | Code obfuscation enabled for release builds |
| **Certificate Pinning** | Planned for Phase 2 |

---

## 8. Incident Response Plan

### 8.1 Incident Classification

| Severity | Description | Response Time |
|----------|-------------|---------------|
| **SEV-1: Critical** | Data breach, auth bypass, SOS failure | Immediate (< 1 hour) |
| **SEV-2: High** | Unauthorized data access, service outage | < 4 hours |
| **SEV-3: Medium** | Vulnerability discovered, partial outage | < 24 hours |
| **SEV-4: Low** | Minor security concern, cosmetic issue | < 1 week |

### 8.2 Response Procedure

```
1. DETECT     → Monitor, user reports, automated alerts
2. CONTAIN    → Isolate affected systems, revoke compromised credentials
3. ASSESS     → Determine scope, affected users, data exposure
4. REMEDIATE  → Patch vulnerability, rotate secrets, deploy fix
5. NOTIFY     → Inform affected users within 72 hours (per GDPR)
6. RECOVER    → Restore services, verify fix effectiveness
7. REVIEW     → Post-incident analysis, update procedures
```

### 8.3 Breach Notification
In the event of a personal data breach:
- Users will be notified within **72 hours** of discovery
- Notification will include: nature of breach, data affected, remedial actions
- Relevant authorities will be notified as required by law
- Contact: **security@momsnest.com**

---

## 9. Vulnerability Management

### 9.1 Dependency Scanning
```bash
# Run regularly
npm audit                    # Check for known vulnerabilities
npm audit fix                # Auto-fix where possible
npm outdated                 # Check for outdated packages
```

### 9.2 Code Review
- All code changes reviewed before merge
- Security-sensitive changes require additional reviewer
- No secrets in source code (enforced by `.gitignore`)

### 9.3 Penetration Testing (Planned)
| Test Type | Frequency | Scope |
|-----------|-----------|-------|
| **Automated scanning** | Monthly | OWASP Top 10 |
| **Manual penetration test** | Quarterly | API, auth flows, RLS |
| **Third-party audit** | Annually | Full application security |

---

## 10. Secure Development Practices

### 10.1 Development Guidelines
1. **Never hardcode secrets** — use `.env` files and Supabase Vault
2. **Validate all inputs** — use Zod schemas for form validation
3. **Use TypeScript strict mode** — catch type errors at compile time
4. **Follow RLS-first approach** — every table must have RLS policies
5. **Minimize permissions** — request only necessary device permissions
6. **Handle errors gracefully** — never expose stack traces or internal errors to users
7. **Review dependencies** — evaluate security posture before adding packages
8. **Use parameterized queries** — never construct raw SQL strings

### 10.2 Environment Configuration
```
.env                    → Local development secrets (NOT committed)
.gitignore              → Ensures .env files are never committed
supabase/config.toml    → Supabase project configuration
```

---

## 11. Compliance Status

| Framework | Status | Notes |
|-----------|--------|-------|
| **OWASP Top 10** | ✅ Addressed | XSS, injection, auth handled |
| **GDPR** | 🟡 Partial | Data access/update available; export/deletion in progress |
| **ISO 27001** | 📋 Via Supabase | Supabase is ISO 27001 certified |
| **SOC 2** | 📋 Via Supabase | Supabase is SOC 2 Type II compliant |
| **Ethiopian Data Protection** | 🟡 Awareness | Monitoring regulatory developments |
| **PCI DSS** | ❌ N/A | No direct card processing (handled by payment providers) |

---

## 12. Security Contacts

| Role | Contact |
|------|---------|
| **Security Team** | security@momsnest.com |
| **Privacy Officer** | privacy@momsnest.com |
| **Bug Reports** | security@momsnest.com (subject: "Security Bug Report") |
| **Emergency** | security@momsnest.com (subject: "URGENT — Security Incident") |

### Responsible Disclosure
We welcome responsible security researchers. If you discover a vulnerability:
1. Email **security@momsnest.com** with details
2. Do not publicly disclose until we have patched the issue
3. We commit to responding within **48 hours**
4. We will credit researchers (if desired) in our security acknowledgments
