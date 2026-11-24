// No network: record requests emitted by the installed locked Supabase client.
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const req = require('node:module').createRequire(path.resolve(__dirname,'../../../pantry-flow/package.json'));
const { createClient } = req('@supabase/supabase-js');
const requests=[];
const client=createClient('http://127.0.0.1:1','synthetic-review-key',{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:async (url,init)=>{
    requests.push({url:String(url),method:init.method,prefer:new Headers(init.headers).get('prefer'),body:init.body});
    return new Response(null,{status:204});
  }},
});
(async()=>{
  for(const table of ['pantry_items','pantry_shopping_items','profiles']) {
    const result=await client.from(table).update({name:'Review fixture'});
    assert.equal(result.error,null);
    if(table!=='profiles') assert.equal((await client.from(table).delete()).error,null);
  }
  for(const request of requests) {
    assert.equal(new URL(request.url).search,'');
    assert.ok(!request.prefer?.includes('return=representation'));
    console.log(JSON.stringify(request));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
