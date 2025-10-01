/**
 * Authentication Middleware for Admin Routes
 * 
 * This middleware provides API key-based authentication for admin endpoints.
 * It checks for a valid admin API key in the request headers.
 */

import { Request, Response, NextFunction } from 'express'

/**
 * Admin API Key Authentication Middleware
 * 
 * Checks for 'X-Admin-Key' header and validates against ADMIN_API_KEY environment variable
 */
export const adminAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get admin API key from environment
    const adminApiKey = process.env.ADMIN_API_KEY

    // Check if admin API key is configured
    if (!adminApiKey || adminApiKey === '') {
      console.warn('⚠️ ADMIN_API_KEY not configured - admin endpoints are unprotected!')
      // In development, you might want to allow access without key
      // In production, this should be an error
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ 
          success: false, 
          error: 'Admin API key not configured' 
        })
        return
      }
      // Allow access in development mode
      next()
      return
    }

    // Get API key from request headers
    const providedKey = req.headers['x-admin-key'] as string

    // Check if API key is provided
    if (!providedKey) {
      res.status(401).json({ 
        success: false, 
        error: 'Admin API key required. Please provide X-Admin-Key header.' 
      })
      return
    }

    // Validate API key
    if (providedKey !== adminApiKey) {
      console.warn(`❌ Invalid admin API key attempt from ${req.ip || 'unknown'}`)
      res.status(403).json({ 
        success: false, 
        error: 'Invalid admin API key' 
      })
      return
    }

    // Log successful admin access
    console.log(`✅ Admin access granted from ${req.ip || 'unknown'} to ${req.method} ${req.path}`)
    
    // Continue to next middleware/route handler
    next()
  } catch (error) {
    console.error('Error in admin authentication middleware:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    })
  }
}

/**
 * Optional: Rate limiting for admin endpoints
 * Simple in-memory rate limiting (for production, use Redis or similar)
 */
const adminRequestCounts = new Map<string, { count: number; resetTime: number }>()

export const adminRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp = req.ip || 'unknown'
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const maxRequests = 100 // Max 100 requests per 15 minutes

  // Clean up old entries
  for (const [ip, data] of adminRequestCounts.entries()) {
    if (now > data.resetTime) {
      adminRequestCounts.delete(ip)
    }
  }

  // Get or create request count for this IP
  let requestData = adminRequestCounts.get(clientIp)
  if (!requestData || now > requestData.resetTime) {
    requestData = { count: 0, resetTime: now + windowMs }
    adminRequestCounts.set(clientIp, requestData)
  }

  // Check rate limit
  if (requestData.count >= maxRequests) {
    res.status(429).json({
      success: false,
      error: 'Too many admin requests. Please try again later.',
      retryAfter: Math.ceil((requestData.resetTime - now) / 1000)
    })
    return
  }

  // Increment request count
  requestData.count++

  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': (maxRequests - requestData.count).toString(),
    'X-RateLimit-Reset': new Date(requestData.resetTime).toISOString()
  })

  next()
}
