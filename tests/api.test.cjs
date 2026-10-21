const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = require('node:path').resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
const axios = require(root + '/node_modules/axios/dist/node/axios.cjs');
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(code, filename);
};
let requests = [];
let mode = 'success';
const originalCreate = axios.create;
axios.create = (config) => {
  const client = originalCreate(config);
  client.defaults.adapter = async (request) => {
    requests.push(request);
    if (mode === 'network') throw new axios.AxiosError('Network Error', 'ERR_NETWORK', request);
    if (mode === 'timeout') throw new axios.AxiosError('timeout', 'ECONNABORTED', request);
    if (mode === 'rate') throw new axios.AxiosError('rate', 'ERR_BAD_REQUEST', request, null, {
      status: 429, data: { error: { code: 'RATE_LIMITED', message: 'Wait' } }, headers: { 'retry-after': '2.3' }, config: request,
    });
    return { status: request.method === 'post' ? 200 : 200, data: { amount: '0.00000001' }, headers: {}, config: request };
  };
  return client;
};
const { createCashMineApi, ApiError } = require(root + '/src/api/index.ts');
require('node:test').test('API contracts, safe error normalization and rate limiting', async () => {
  assert.throws(() => createCashMineApi(' '), ApiError);
  const api = createCashMineApi(' test-token ');
  await api.getBalances();
  await api.getActivity({ cursor: 'a/b+c', limit: 10 });
  await api.getClaimOptions('ETH');
  const body = { asset: 'ETH', amount: '0.00000001', destinationId: 'wallet' };
  const result = await api.createClaim(body, 'persisted-key');
  await api.getClaim('id/with spaces');
  assert.deepEqual(requests.map(r => r.url), ['/v1/balances', '/v1/activity', '/v1/claim-options', '/v1/claims', '/v1/claims/id%2Fwith%20spaces']);
  assert.equal(requests[0].headers.get('Authorization'), 'Bearer test-token');
  assert.equal(requests[1].params.cursor, 'a/b+c');
  assert.equal(requests[3].headers.get('Idempotency-Key'), 'persisted-key');
  assert.equal(JSON.parse(requests[3].data).amount, body.amount);
  assert.equal(result.replayed, true);
  const count = requests.length;
  await assert.rejects(api.getActivity({ limit: 21 }), e => e.code === 'VALIDATION');
  await assert.rejects(api.createClaim(body, ''), e => e.code === 'VALIDATION');
  assert.equal(requests.length, count);
  for (mode of ['network', 'timeout']) {
    await assert.rejects(api.createClaim(body, 'persisted-key'), e => e instanceof ApiError && e.outcomeUnknown && !('config' in e));
  }
  mode = 'rate';
  await assert.rejects(api.getBalances(), e => e.code === 'RATE_LIMITED' && e.retryAfterMs === 2300);
  mode = 'network';
  await assert.rejects(api.getBalances(), e => e.code === 'RATE_LIMITED');
  const otherApi = createCashMineApi('other-test-token');
  await assert.rejects(otherApi.getBalances(), e => e.code === 'NETWORK' && !e.outcomeUnknown);
  assert.equal(requests.length, count + 4); // No hidden retries.
  console.log('API checks passed: endpoints, auth, decimal strings, pagination, idempotency, errors, no retries.');
});
