# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Playwright stealth automation tool that uses `playwright-extra` with `puppeteer-extra-plugin-stealth` to bypass basic bot detection. The project is designed for educational purposes, testing, and development - not for bypassing advanced anti-bot systems.

## Development Commands

```bash
# Build the TypeScript project
npm run build

# Run the webhook server (production mode)
npm start

# Run the webhook server (development mode with ts-node)
npm run dev
# or
npm run webhook

# Test the bot detection via HTTP request (server must be running)
npm test
```

## Architecture

The project has a simple single-file architecture:

- `main.ts` - Express.js webhook server with bot detection functionality
- `dist/` - Compiled JavaScript output directory
- Uses Playwright v1.50.0 for Docker compatibility with Microsoft's official images

## Key Components

- **Express.js Server**: HTTP server that handles webhook requests on port 3000 (configurable via PORT env var)
- **Webhook Endpoints**:
  - `POST /webhook/test-bot-detection` - Trigger bot test via webhook
  - `GET /test-bot-detection` - Trigger bot test via GET request
  - `POST /webhook/execute-test` - Execute custom Playwright test with custom URL and test code
  - `GET /health` - Health check endpoint
- **Stealth Configuration**: Uses `puppeteer-extra-plugin-stealth` plugin with `playwright-extra`
- **Browser Setup**: Launches headless Chrome with specific anti-detection arguments
- **Bot Detection Test**: Tests against SannySoft's bot detection site to verify stealth effectiveness
- **Result Analysis**: Returns structured JSON response with test results and summary

## API Response Format

### Bot Detection Endpoints
The bot detection endpoints return a JSON response with the following structure:

```json
{
  "success": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "title": "Page Title",
  "results": [
    {
      "name": "Test Name",
      "result": "Test Result",
      "status": "passed|warn|failed|unknown"
    }
  ],
  "summary": {
    "passed": 10,
    "warned": 2,
    "failed": 1
  }
}
```

### Custom Test Endpoint
The custom test endpoint (`POST /webhook/execute-test`) accepts a JSON payload and returns a custom test result:

**Request Payload:**
```json
{
  "url": "https://example.com",
  "test": "return await page.title();",
  "options": {
    "timeout": 30000,
    "waitUntil": "load",
    "userAgent": "Mozilla/5.0...",
    "viewport": {
      "width": 1366,
      "height": 768
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "url": "https://example.com",
  "title": "Page Title",
  "result": "Any value returned by the test code",
  "executionTime": 1500
}
```

**Payload Validation:**
- `url` (required): Must be a valid URL string
- `test` (required): JavaScript code string to execute with access to `page` and `console` objects
- `options.timeout` (optional): Between 1000ms and 120000ms
- `options.waitUntil` (optional): 'load', 'domcontentloaded', or 'networkidle'
- `options.userAgent` (optional): Custom user agent string
- `options.viewport` (optional): Custom viewport dimensions

## Important Notes

- The stealth capabilities are basic and will be detected by advanced anti-bot systems
- Playwright version is locked to v1.50.0 for Docker image compatibility
- Project prioritizes compatibility and ease of use over perfect stealth
- Uses TypeScript with strict mode enabled
