import express from 'express';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin - this uses the actual puppeteer stealth plugin!
chromium.use(StealthPlugin());

interface TestResult {
    name?: string;
    result?: string;
    status: 'passed' | 'warn' | 'failed' | 'unknown';
}

interface BotTestResponse {
    success: boolean;
    timestamp: string;
    title?: string;
    results?: TestResult[];
    summary?: {
        passed: number;
        warned: number;
        failed: number;
    };
    error?: string;
}

interface CustomTestPayload {
    url: string;
    test: string;
    options?: {
        timeout?: number;
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
        userAgent?: string;
        viewport?: {
            width: number;
            height: number;
        };
    };
}

interface CustomTestResponse {
    success: boolean;
    timestamp: string;
    url: string;
    title?: string;
    result?: any;
    error?: string;
    executionTime?: number;
}

async function testBotDetection(): Promise<BotTestResponse> {
    console.log('🚀 Starting Playwright Stealth Test...\n');

    try {
        // Launch browser with stealth
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 768 }
        });

        const page = await context.newPage();

        try {
            // Test with bot detection site
            console.log('📍 Testing: https://bot.sannysoft.com/');
            await page.goto('https://bot.sannysoft.com/', { waitUntil: 'load' });

            // Get page title
            const title = await page.title();
            console.log(`📄 Page title: ${title}`);

            // Log key page elements that indicate detection status
            console.log('\n🧪 Detection Test Results:');
            let results: TestResult[] = [];
            
            try {
                results = await page.$$eval('table tr', rows => {
                    return rows
                        .map(row => {
                            const cells = row.querySelectorAll('td');
                            if (cells.length !== 2 && cells.length !== 3) return null;

                            const name = cells[0]?.innerText?.trim();
                            const result = cells[1]?.innerText?.trim();
                            const className = cells[1]?.className;

                            return {
                                name,
                                result,
                                status: className?.includes('passed') ? 'passed' as const
                                    : className?.includes('warn') ? 'warn' as const
                                        : className?.includes('failed') ? 'failed' as const
                                            : 'unknown' as const
                            };
                        })
                        .filter(Boolean) as TestResult[];
                });

                // Analyze and report
                const failed = results.filter(r => r?.status === 'failed');
                const warned = results.filter(r => r?.status === 'warn');
                const passed = results.filter(r => r?.status === 'passed');

                console.log(`\n✅ Passed: ${passed.length}`);
                console.log(`⚠️  Warnings: ${warned.length}`);
                console.log(`❌ Failed: ${failed.length}`);

                if (failed.length > 0 || warned.length > 0) {
                    console.log('\n🧪 Problematic tests:\n');
                    [...failed, ...warned].forEach(r => {
                        console.log(`  [${r?.status.toUpperCase()}] ${r?.name} → ${r?.result}`);
                    });
                } else {
                    console.log('\n🎉 All tests passed with no issues!');
                }

                console.log('\n✅ Test completed successfully!');

                return {
                    success: true,
                    timestamp: new Date().toISOString(),
                    title,
                    results,
                    summary: {
                        passed: passed.length,
                        warned: warned.length,
                        failed: failed.length
                    }
                };
            } catch (error) {
                console.log('ℹ️  Could not extract detailed test results');
                return {
                    success: true,
                    timestamp: new Date().toISOString(),
                    title,
                    error: 'Could not extract detailed test results'
                };
            }
        } finally {
            await browser.close();
        }
    } catch (error) {
        console.error('❌ Test failed:', error);
        return {
            success: false,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

async function executeCustomTest(payload: CustomTestPayload): Promise<CustomTestResponse> {
    console.log(`🚀 Starting custom Playwright test for: ${payload.url}\n`);
    
    const startTime = Date.now();
    
    try {
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const context = await browser.newContext({
            userAgent: payload.options?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: payload.options?.viewport || { width: 1366, height: 768 }
        });

        const page = await context.newPage();

        try {
            console.log(`📍 Navigating to: ${payload.url}`);
            await page.goto(payload.url, { 
                waitUntil: payload.options?.waitUntil || 'load',
                timeout: payload.options?.timeout || 30000
            });

            const title = await page.title();
            console.log(`📄 Page title: ${title}`);

            console.log(`🧪 Executing custom test code...`);
            
            const testFunction = new Function('page', 'console', `return (async () => { ${payload.test} })();`);
            const result = await testFunction(page, console);

            const executionTime = Date.now() - startTime;
            
            console.log(`✅ Custom test completed successfully in ${executionTime}ms!`);

            return {
                success: true,
                timestamp: new Date().toISOString(),
                url: payload.url,
                title,
                result,
                executionTime
            };
        } finally {
            await browser.close();
        }
    } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error('❌ Custom test failed:', error);
        return {
            success: false,
            timestamp: new Date().toISOString(),
            url: payload.url,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            executionTime
        };
    }
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook endpoint to trigger bot detection test
app.post('/webhook/test-bot-detection', async (_req, res) => {
    console.log(`\n📨 Webhook received at ${new Date().toISOString()}`);
    
    try {
        const result = await testBotDetection();
        res.json(result);
    } catch (error) {
        console.error('Error in webhook handler:', error);
        res.status(500).json({
            success: false,
            timestamp: new Date().toISOString(),
            error: 'Internal server error'
        });
    }
});

// GET endpoint for easy testing
app.get('/test-bot-detection', async (_req, res) => {
    console.log(`\n📨 GET request received at ${new Date().toISOString()}`);
    
    try {
        const result = await testBotDetection();
        res.json(result);
    } catch (error) {
        console.error('Error in GET handler:', error);
        res.status(500).json({
            success: false,
            timestamp: new Date().toISOString(),
            error: 'Internal server error'
        });
    }
});

// Custom test execution endpoint
app.post('/webhook/execute-test', async (req, res) => {
    console.log(`\n📨 Custom test webhook received at ${new Date().toISOString()}`);
    
    try {
        const payload = req.body as CustomTestPayload;
        
        if (!payload.url || !payload.test) {
            return res.status(400).json({
                success: false,
                timestamp: new Date().toISOString(),
                error: 'Missing required fields: url and test are required'
            });
        }

        if (typeof payload.url !== 'string' || typeof payload.test !== 'string') {
            return res.status(400).json({
                success: false,
                timestamp: new Date().toISOString(),
                error: 'Invalid field types: url and test must be strings'
            });
        }

        try {
            new URL(payload.url);
        } catch {
            return res.status(400).json({
                success: false,
                timestamp: new Date().toISOString(),
                error: 'Invalid URL format'
            });
        }

        if (payload.options?.timeout && (payload.options.timeout < 1000 || payload.options.timeout > 120000)) {
            return res.status(400).json({
                success: false,
                timestamp: new Date().toISOString(),
                error: 'Timeout must be between 1000ms and 120000ms'
            });
        }

        const result = await executeCustomTest(payload);
        res.json(result);
    } catch (error) {
        console.error('Error in custom test webhook handler:', error);
        res.status(500).json({
            success: false,
            timestamp: new Date().toISOString(),
            error: 'Internal server error'
        });
    }
});

// Start server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Webhook server running on port ${PORT}`);
        console.log(`📍 Endpoints:`);
        console.log(`   GET  /health - Health check`);
        console.log(`   POST /webhook/test-bot-detection - Trigger bot test via webhook`);
        console.log(`   GET  /test-bot-detection - Trigger bot test via GET request`);
        console.log(`   POST /webhook/execute-test - Execute custom Playwright test`);
        console.log(`\n💡 Test bot detection: curl http://localhost:${PORT}/test-bot-detection`);
        console.log(`💡 Test custom URL: curl -X POST http://localhost:${PORT}/webhook/execute-test -H "Content-Type: application/json" -d '{"url":"https://example.com","test":"return await page.title();"}'`);
    });
}

// Export for testing or when required as module
export { testBotDetection, app };