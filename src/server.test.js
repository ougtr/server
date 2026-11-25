const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');

const run = promisify(execFile);

for (const scenario of ['pending', 'rejected']) {
  test(`API responds while watermark migration is ${scenario}`, async () => {
    const script = `
      const assert = require('node:assert/strict');
      const http = require('node:http');
      const order = [];
      let reported = false;
      const stub = (name, exports) => {
        const id = require.resolve(name);
        require.cache[id] = { id, filename: id, loaded: true, exports };
      };
      console.error = () => { reported = true; };
      stub('./src/config', { PORT: 0 });
      stub('./src/db', { initializeDatabase: async () => { order.push('database'); } });
      stub('./src/services/photoWatermarkService', {
        migrateExistingPhotoWatermarks: () => {
          order.push('migration');
          return ${scenario === 'pending' ? 'new Promise(() => {})' : "Promise.reject(new Error('Migration failed'))"};
        }
      });
      stub('./src/app', {
        listen: (port, callback) => {
          const server = http.createServer((req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok' }));
          });
          server.listen(port, '127.0.0.1', () => {
            order.push('listen');
            callback();
            http.get('http://127.0.0.1:' + server.address().port + '/api/health', (res) => {
              let body = '';
              res.on('data', chunk => { body += chunk; });
              res.on('end', () => {
                assert.equal(res.statusCode, 200);
                assert.deepEqual(JSON.parse(body), { status: 'ok' });
                assert.deepEqual(order, ['database', 'listen', 'migration']);
                assert.equal(reported, ${scenario === 'rejected'});
                server.close(() => { console.log('API_AVAILABLE'); });
              });
            }).on('error', error => { throw error; });
          });
        }
      });
      require('./src/server');
    `;
    const { stdout } = await run(process.execPath, ['-e', script], {
      cwd: path.resolve(__dirname, '..'),
      timeout: 10000,
    });
    assert.ok(stdout.includes('API_AVAILABLE'));
  });
}
