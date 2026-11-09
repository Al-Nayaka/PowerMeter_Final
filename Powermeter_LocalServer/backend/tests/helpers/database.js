import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';

export async function testDatabase() {
    const db = new PGlite();
    const folder = new URL('../../migrations/', import.meta.url);
    for (const name of (await readdir(folder)).filter((f) => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, folder), 'utf8'));
    let queue = Promise.resolve();
    const connect = async () => {
        let release;
        const previous = queue;
        queue = new Promise((r) => { release = r; });
        await previous;
        return { query: (...args) => db.query(...args), release };
    };
    const pool = {
        connect,
        async query(...args) { const client = await connect(); try { return await client.query(...args); } finally { client.release(); } },
        end: () => db.close(),
    };
    return { db, pool };
}
