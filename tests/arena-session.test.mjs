import test from 'node:test';
import assert from 'node:assert/strict';
const session=await import('../public/arena/session.mjs').catch(()=>({}));
test('recovery selects newest valid checkpoint rather than overwriting newer server state',()=>{assert.equal(typeof session.newestCheckpoint,'function');const a={version:1,savedAt:20,game:{version:1,scores:[3,4],phase:'serve'}},b={...a,savedAt:30,game:{version:1,scores:[5,4],phase:'serve'}};assert.deepEqual(session.newestCheckpoint(a,b),b);assert.deepEqual(session.newestCheckpoint(b,a),b);assert.deepEqual(session.newestCheckpoint(a,{savedAt:999999,game:null}),a);});
test('a silent connection expires even if its socket stays OPEN',()=>{assert.equal(typeof session.LinkWatch,'function');const link=new session.LinkWatch(0);assert.equal(link.expired(1000),false);link.heard(2000);assert.equal(link.expired(4999),false);assert.equal(link.expired(5001),true);});
