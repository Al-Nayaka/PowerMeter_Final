import 'dotenv/config';
import { readEnvironment } from './config/environment.js';
import { createPool } from './config/database.js';
import { createRuntime } from './runtime.js';

let pool;
let runtime;
try {
    const config = readEnvironment();
    pool = createPool(config);
    runtime = await createRuntime({ config, pool });
    await runtime.start();
} catch (error) {
    console.error({ event: 'startup_failed', reason: error.code || (/configuration|ADMIN_API_KEY/.test(error.message) ? error.message : 'Check database connectivity and approved migrations') });
    if (runtime) await runtime.close(); else if (pool) await pool.end();
    process.exitCode = 1;
}
if (runtime) {
    let stopping = false;
    const shutdown = async () => {
        if (stopping) return;
        stopping = true;
        const deadline = setTimeout(() => process.exit(1), 15000);
        deadline.unref();
        try { await runtime.close(); } catch { console.error({ event: 'shutdown_failed' }); process.exitCode = 1; }
        finally { clearTimeout(deadline); }
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}
