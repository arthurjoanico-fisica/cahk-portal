// Cache apenas de dados públicos. Nunca usar para gestão ou denúncias.
(()=>{
  const prefix='cahk-public-v615:', memory=new Map(), pending=new Map();
  function read(key){
    if(memory.has(key))return memory.get(key);
    try{const item=JSON.parse(localStorage.getItem(prefix+key)||'null');if(item&&typeof item==='object'){memory.set(key,item);return item;}}catch{}
    return {};
  }
  function write(key,item){memory.set(key,item);try{localStorage.setItem(prefix+key,JSON.stringify(item));}catch{}}
  async function get(key,ttl,load){
    const item=read(key),now=Date.now();
    if(item.expires>now&&item.data!==undefined)return item.data;
    if(item.retryAt>now)throw Object.assign(new Error(item.error||'Serviço temporariamente indisponível.'),{status:item.status});
    if(pending.has(key))return pending.get(key);
    const task=Promise.resolve().then(load).then(data=>{
      write(key,{data,expires:Date.now()+ttl});return data;
    }).catch(error=>{
      write(key,{retryAt:Date.now()+(error.status===402?21600000:900000),status:error.status,error:String(error.message||error)});
      throw error;
    }).finally(()=>pending.delete(key));
    pending.set(key,task);return task;
  }
  const day=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  window.CAHKPublicCache={get,day};
})();
