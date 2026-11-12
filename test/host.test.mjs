import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const manifest=JSON.parse(fs.readFileSync('source-manifest.json','utf8'));
test('source provenance is pinned and byte-verifiable',()=>{assert.equal(manifest.commit,'3686fed59ecbc650157d096733db98954f418a06');for(const file of manifest.files){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file.path,'utf8').replaceAll('\r\n','\n')).digest('hex'),file.sha256,file.path);}});
test('local password login and production seeds are absent',()=>{for(const rel of ['src/app/api/auth/login/route.ts','src/app/api/auth/account/route.ts','src/app/api/auth/register/route.ts','prisma/seed.ts'])assert.equal(fs.existsSync(rel),false,rel);});
test('product has its own entry, health route, process and database',()=>{assert.ok(fs.existsSync('src/app/products/docs/page.tsx'));assert.match(fs.readFileSync('.env.example','utf8'),/file:\/var\/lib\/kemiaodoc\/prod.db/);const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));assert.match(pkg.scripts.start,/4211/);assert.ok(fs.existsSync('src/app/api/health/route.ts'));});
