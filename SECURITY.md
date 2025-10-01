# Security Configuration Guide

## Admin API Protection

The admin endpoints are now protected with API key authentication. This document explains how to configure and use the security features.

## Environment Variables

Add the following environment variable to your `.env` file:

```bash
# Admin Security - REQUIRED for production
ADMIN_API_KEY="your-secure-admin-api-key-here"

# Optional: Set to production for strict security
NODE_ENV="production"
```

## Generating a Secure API Key

Use one of these methods to generate a secure API key:

### Method 1: Using Node.js crypto
```javascript
const crypto = require('crypto');
console.log(crypto.randomBytes(32).toString('hex'));
```

### Method 2: Using OpenSSL
```bash
openssl rand -hex 32
```

### Method 3: Using online generator
Visit a secure random string generator and create a 64-character hexadecimal string.

## Using Admin Endpoints

### With curl
```bash
curl -H "X-Admin-Key: your-api-key-here" \
     -X POST \
     http://localhost:3000/admin/sync-randomseed
```

### With JavaScript/fetch
```javascript
fetch('/admin/sync-randomseed', {
  method: 'POST',
  headers: {
    'X-Admin-Key': 'your-api-key-here',
    'Content-Type': 'application/json'
  }
})
```

### With Postman
1. Add a new header: `X-Admin-Key`
2. Set the value to your admin API key
3. Make requests to admin endpoints

## Security Features

### 1. API Key Authentication
- All admin endpoints require `X-Admin-Key` header
- Invalid or missing keys return 401/403 errors
- Access attempts are logged

### 2. Rate Limiting
- Maximum 100 requests per 15 minutes per IP
- Rate limit headers included in responses
- Automatic cleanup of old request counts

### 3. Environment-based Security
- Development mode: More lenient (allows missing API key)
- Production mode: Strict security enforcement

### 4. Request Logging
- Successful admin access is logged
- Failed authentication attempts are logged with IP
- Helps with security monitoring

## Response Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 401  | Unauthorized - API key required |
| 403  | Forbidden - Invalid API key |
| 429  | Too Many Requests - Rate limited |
| 500  | Server Error - Configuration issue |

## Security Best Practices

### 1. API Key Management
- Use a strong, randomly generated API key (64+ characters)
- Store the API key securely (environment variables, not in code)
- Rotate API keys regularly
- Use different keys for different environments

### 2. Network Security
- Use HTTPS in production
- Restrict admin endpoint access to trusted IPs if possible
- Consider using a VPN for admin access

### 3. Monitoring
- Monitor admin endpoint access logs
- Set up alerts for failed authentication attempts
- Regular security audits

### 4. Environment Configuration
```bash
# Production environment
NODE_ENV=production
ADMIN_API_KEY=your-production-key

# Development environment
NODE_ENV=development
ADMIN_API_KEY=your-development-key
```

## Swagger Documentation

The Swagger UI now includes security information:
- Admin endpoints show a lock icon
- Security requirements are documented
- You can test endpoints directly in Swagger UI by providing the API key

## Troubleshooting

### Common Issues

1. **"Admin API key required"**
   - Add `X-Admin-Key` header to your request
   - Ensure the header name is correct (case-sensitive)

2. **"Invalid admin API key"**
   - Check that your API key matches the `ADMIN_API_KEY` environment variable
   - Ensure no extra spaces or characters

3. **"Admin API key not configured"**
   - Set the `ADMIN_API_KEY` environment variable
   - Restart the server after setting the variable

4. **Rate Limited**
   - Wait for the rate limit window to reset (15 minutes)
   - Consider if you're making too many requests

### Testing Configuration

Test your admin authentication:

```bash
# This should fail (no API key)
curl http://localhost:3000/admin/random-seed-status

# This should succeed
curl -H "X-Admin-Key: your-api-key" \
     http://localhost:3000/admin/random-seed-status
```

## Migration from Unprotected Endpoints

If you were previously using admin endpoints without authentication:

1. Set the `ADMIN_API_KEY` environment variable
2. Update all admin API calls to include the `X-Admin-Key` header
3. Test all integrations
4. Deploy with the new security configuration

## Security Incident Response

If you suspect your API key has been compromised:

1. Immediately change the `ADMIN_API_KEY` environment variable
2. Restart the server
3. Review access logs for suspicious activity
4. Update all legitimate clients with the new key
5. Consider additional security measures if needed
