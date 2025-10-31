# FEMOTTA Server - Enterprise Edition

## Overview

FEMOTTA is an enterprise-grade, multi-tenant SaaS platform for AI-powered marketing image editing. This server provides a robust backend with advanced features including:

- 🔐 **Enterprise Security**: Rate limiting, CORS, Helmet, input validation
- 📊 **Advanced Logging**: Structured logging with Pino for monitoring
- 🤖 **AI Integration**: GPT-4 for ML analysis and Wavespeed for image editing
- 🏢 **Multi-Tenancy**: Complete brand isolation and CRM features
- 📁 **PSD Generation**: Layered Photoshop files with original + edited images
- ✅ **Comprehensive Testing**: Automated tests with Jest
- 🔄 **Retry Logic**: Automatic retry with exponential backoff for API calls

## Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** (Neon Database recommended)
- **Google Cloud** account with Drive API enabled
- **Wavespeed API** key
- **OpenAI API** key

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
WAVESPEED_API_KEY=your_wavespeed_api_key
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_secure_random_jwt_secret
ADMIN_SECRET=your_secure_random_admin_secret
```

**⚠️ Security Note**: Never use the default values in production. Generate secure secrets:

```bash
# Generate JWT secret
openssl rand -base64 64

# Generate Admin secret
openssl rand -base64 64
```

### 3. Setup Database

Run database migrations:

```bash
npm run db:push
```

Seed initial data:

```bash
node scripts/seedCorsair.js
```

### 4. Configure Google Drive OAuth 2.0

**Important**: The current code uses Replit-specific authentication which won't work outside Replit. You need to:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add credentials to `.env`:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

4. Refactor `utils/googleDrive.js` to use these credentials

## Running the Server

### Development Mode

```bash
npm run dev
```

Server will run on `http://localhost:3000` with auto-reload.

### Production Mode

```bash
npm start
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## API Documentation

### Health Check

```
GET /api/health
```

Returns server status and uptime.

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload brief and images |
| `/api/process` | POST | Process images with AI |
| `/api/psd/:jobId/:imageIndex` | GET | Download PSD file |
| `/api/re-edit` | POST | Re-edit specific images |
| `/api/feedback` | POST | Submit feedback |
| `/api/ml/analyze/:subaccountId` | GET | Run ML analysis |

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Security Features

### Rate Limiting

- **Standard**: 100 requests per 15 minutes
- **Strict** (login/admin): 5 requests per 15 minutes
- **Upload**: 50 uploads per hour
- **API**: 60 requests per minute

### CORS

Configured to allow requests only from:
- `CLIENT_URL` environment variable
- `http://localhost:5000` (development)
- `http://localhost:5173` (Vite dev server)

### Input Validation

All endpoints use `express-validator` for input validation:
- Type checking
- Length limits
- Format validation
- Sanitization

### Security Headers

Helmet.js provides:
- Content Security Policy
- XSS Protection
- HSTS
- Frame Options

## Logging

The server uses Pino for structured logging:

```javascript
import logger from './utils/logger.js';

logger.info({ userId: 123 }, 'User logged in');
logger.error({ err: error }, 'Failed to process image');
```

**Log Levels**: trace, debug, info, warn, error, fatal

**Development**: Pretty-printed logs with colors
**Production**: JSON logs for log aggregation

## Error Handling

All errors are handled consistently:

```json
{
  "error": "Error type",
  "details": "User-friendly message",
  "technicalDetails": "Stack trace (development only)",
  "requestId": "unique-request-id"
}
```

## Testing

Tests are located in `tests/` directory:

```
tests/
  ├── psdController.test.js
  ├── processController.test.js
  └── validation.test.js
```

**Coverage Requirements**:
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## Monitoring

### Health Endpoints

```bash
# Basic health check
curl http://localhost:3000/api/health

# Detailed health check (includes memory usage)
curl http://localhost:3000/api/health/detailed
```

### Metrics

The server logs:
- Request duration
- API call duration
- Job processing time
- Error rates
- Memory usage

## Deployment

### Environment-Specific Configuration

**Development**:
```env
NODE_ENV=development
LOG_LEVEL=debug
LOG_PRETTY=true
ENABLE_ERROR_DETAILS=true
```

**Production**:
```env
NODE_ENV=production
LOG_LEVEL=info
LOG_PRETTY=false
ENABLE_ERROR_DETAILS=false
```

### Graceful Shutdown

The server handles SIGTERM and SIGINT signals gracefully:
1. Stops accepting new connections
2. Finishes processing existing requests
3. Closes database connections
4. Exits cleanly

Force shutdown after 10 seconds if needed.

## Troubleshooting

### Common Issues

**1. "Job not found" error**
- **Cause**: Server restarted and in-memory jobs lost
- **Solution**: Jobs are now persisted to database with automatic fallback

**2. "Google Drive not connected"**
- **Cause**: OAuth not configured
- **Solution**: Follow Google Drive OAuth 2.0 setup instructions

**3. "PSD download fails"**
- **Cause**: Invalid buffers or missing permissions
- **Solution**: Check logs for specific error, verify Google Drive permissions

**4. "ML analysis returns no data"**
- **Cause**: Insufficient feedback in database
- **Solution**: Collect at least 5 feedback entries per prompt

**5. "Rate limit exceeded"**
- **Cause**: Too many requests from same IP
- **Solution**: Wait for rate limit window to reset or adjust limits in `.env`

### Debug Mode

Enable detailed logging:

```env
LOG_LEVEL=debug
ENABLE_ERROR_DETAILS=true
```

## Performance Optimization

### Retry Logic

All external API calls use exponential backoff:
- Initial delay: 1 second
- Max delay: 10 seconds
- Max retries: 3

### Parallel Processing

Image processing uses batches of 15 images in parallel.

### Database Connection Pooling

PostgreSQL connection pool is configured for optimal performance.

## Contributing

### Code Style

- Use ESLint for linting
- Follow Airbnb JavaScript style guide
- Write tests for new features
- Document all functions with JSDoc

### Pull Request Process

1. Create feature branch
2. Write tests
3. Ensure all tests pass
4. Update documentation
5. Submit PR with description

## License

Proprietary - All rights reserved

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review error messages in response
- Contact: support@femotta.com

## Version History

### v2.0.0 (Enterprise Edition)
- ✅ Complete dependency management
- ✅ Enterprise security features
- ✅ Structured logging with Pino
- ✅ Comprehensive error handling
- ✅ Retry logic for API calls
- ✅ Input validation and sanitization
- ✅ Automated testing suite
- ✅ Improved PSD generation
- ✅ Enhanced ML analysis

### v1.0.0 (Initial Release)
- Basic functionality
- Replit-specific implementation
