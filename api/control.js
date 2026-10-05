const {createHash,timingSafeEqual,randomUUID}=require('node:crypto');
const KEY='simfront:control:v1';
const ORIGIN='https://simfront1.vercel.app';
const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());

module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('CDN-Cache-Control','no-store');
 res.setHeader('Vercel-CDN-Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 const send=(status,data)=>res.status(status).json(data);
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return send(405,{error:'Метод не підтримується.'});}
 let action;
 if(req.method==='POST'){
  const password=process.env.SIMFRONT_ADMIN_PASSWORD;
  if(!password)return send(503,{error:'На сервері не налаштовано пароль адміністратора.'});
  const auth=req.headers.authorization||'';
  if(typeof auth!=='string'||auth.length>1024||!auth.startsWith('Bearer ')||!equal(auth.slice(7),password))return send(401,{error:'Неправильний пароль.'});
  if(req.headers.origin&&req.headers.origin!==ORIGIN)return send(403,{error:'Відкрийте керування на офіційному сайті.'});
  if(Number(req.headers['content-length']||0)>1024)return send(413,{error:'Запит завеликий.'});
  let body=req.body;
  if(typeof body==='string'){try{body=JSON.parse(body);}catch{return send(400,{error:'Некоректний запит.'});}}
  action=body?.action;
  if(!['restart-telegram','cancel'].includes(action))return send(400,{error:'Невідома команда.'});
 }
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
 const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 if(!url||!token)return send(503,{error:'Потрібно підключити Redis і додати змінні середовища на Vercel.'});
 const redis=async command=>{
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('Storage unavailable');
  const data=await response.json();if(data.error)throw Error('Storage failed');return data.result;
 };
 try{
  if(req.method==='GET'){
   const raw=await redis(['GET',KEY]);let command=null;
   if(raw){try{const c=typeof raw==='string'?JSON.parse(raw):raw;if(c&&c.action==='restart-telegram'&&typeof c.id==='string'&&Number.isFinite(c.expiresAt)&&c.expiresAt>Date.now())command=c;}catch{}}
   return send(200,{command,serverTime:Date.now()});
  }
  if(action==='cancel'){await redis(['DEL',KEY]);return send(200,{ok:true,command:null});}
  const command={id:randomUUID(),action,issuedAt:Date.now(),expiresAt:Date.now()+60000};
  await redis(['SET',KEY,JSON.stringify(command),'EX',60]);
  return send(200,{ok:true,command});
 }catch{return send(503,{error:'Не вдалося зберегти або прочитати команду. Перевірте підключення Redis.'});}
};
