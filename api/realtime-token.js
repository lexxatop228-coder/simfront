const {createHmac,randomBytes}=require('node:crypto');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('CDN-Cache-Control','no-store');
 res.setHeader('Vercel-CDN-Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Метод не підтримується.'});}
 if(req.headers.origin&&req.headers.origin!=='https://simfront1.vercel.app')return res.status(403).json({error:'Відкрийте офіційний сайт.'});
 const key=process.env.ABLY_API_KEY?.trim(),separator=key?.indexOf(':');
 if(!key||separator<1||separator===key.length-1)return res.status(503).json({error:'Потрібно налаштувати ABLY_API_KEY на Vercel.'});
 const keyName=key.slice(0,separator),secret=key.slice(separator+1);
 const ttl=3600000,capability=JSON.stringify({'simfront:control':['subscribe']}),timestamp=Date.now(),nonce=randomBytes(16).toString('hex');
 const text=[keyName,ttl,capability,'',timestamp,nonce].join('\n')+'\n';
 const mac=createHmac('sha256',secret).update(text).digest('base64');
 return res.status(200).json({keyName,ttl,capability,timestamp,nonce,mac});
};
