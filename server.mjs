import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { createTransport } from 'nodemailer';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
// readFile already imported
// Load .env file
try {
  const envContent = await readFile(new URL('.env', import.meta.url), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch (e) { /* .env not found, use process.env */ }

const scrypt=promisify(scryptCb),ROOT=resolve(fileURLToPath(new URL('.',import.meta.url))),PRIVATE_DIR=resolve(process.env.DATA_DIR||join(ROOT,'private-data')),KEY_PATH=join(PRIVATE_DIR,'master.key'),PORT=Number(process.env.PORT)||3000,DRIVER=(process.env.DB_DRIVER||'sqlite').toLowerCase();
if(!['sqlite','mariadb'].includes(DRIVER))throw Error('DB_DRIVER must be sqlite or mariadb');
await mkdir(PRIVATE_DIR,{recursive:true,mode:0o700});
let masterKey;try{masterKey=await readFile(KEY_PATH);if(masterKey.length!==32)throw Error('Invalid data encryption key');}catch{masterKey=randomBytes(32);await writeFile(KEY_PATH,masterKey,{mode:0o600,flag:'wx'}).catch(async e=>{if(e.code!=='EEXIST')throw e;masterKey=await readFile(KEY_PATH);});}
let sqlite=null,pool=null;
if(DRIVER==='sqlite'){sqlite=new DatabaseSync(join(PRIVATE_DIR,'freeai.sqlite'));sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');}
else{const mysql=await import('mysql2/promise');pool=mysql.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT)||3306,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,waitForConnections:true,connectionLimit:10,charset:'utf8mb4',ssl:process.env.DB_SSL==='true'?{}:undefined});await pool.query('SELECT 1');}
const schema=DRIVER==='sqlite'?[`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL,real_name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,email_verified INTEGER NOT NULL DEFAULT 0,password_hash BLOB NOT NULL,salt BLOB NOT NULL,theme TEXT NOT NULL DEFAULT 'dark',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,`CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL)`,`CREATE TABLE IF NOT EXISTS selections(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,model_id TEXT NOT NULL,PRIMARY KEY(user_id,model_id))`,`CREATE TABLE IF NOT EXISTS hero_slots(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,slot INTEGER NOT NULL,model_id TEXT NOT NULL,PRIMARY KEY(user_id,slot),UNIQUE(user_id,model_id))`,`CREATE TABLE IF NOT EXISTS provider_keys(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,provider TEXT NOT NULL,iv BLOB NOT NULL,tag BLOB NOT NULL,secret BLOB NOT NULL,PRIMARY KEY(user_id,provider))`,`CREATE TABLE IF NOT EXISTS profiles(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,phone TEXT NOT NULL DEFAULT '',company TEXT NOT NULL DEFAULT '',job_title TEXT NOT NULL DEFAULT '',country TEXT NOT NULL DEFAULT '',bio TEXT NOT NULL DEFAULT '')`,`CREATE TABLE IF NOT EXISTS email_verifications(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL)`]:[`CREATE TABLE IF NOT EXISTS users(id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,username VARCHAR(40) NOT NULL UNIQUE,real_name VARCHAR(160) NOT NULL,email VARCHAR(254) NOT NULL UNIQUE,email_verified TINYINT(1) NOT NULL DEFAULT 0,password_hash VARBINARY(64) NOT NULL,salt VARBINARY(16) NOT NULL,theme VARCHAR(12) NOT NULL DEFAULT 'dark',created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,`CREATE TABLE IF NOT EXISTS sessions(token_hash CHAR(64) NOT NULL PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,expires_at BIGINT NOT NULL,CONSTRAINT sessions_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,`CREATE TABLE IF NOT EXISTS selections(user_id BIGINT UNSIGNED NOT NULL,model_id VARCHAR(190) NOT NULL,PRIMARY KEY(user_id,model_id),CONSTRAINT selections_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,`CREATE TABLE IF NOT EXISTS hero_slots(user_id BIGINT UNSIGNED NOT NULL,slot TINYINT UNSIGNED NOT NULL,model_id VARCHAR(190) NOT NULL,PRIMARY KEY(user_id,slot),UNIQUE KEY hero_slots_unique_model(user_id,model_id),CONSTRAINT hero_slots_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,`CREATE TABLE IF NOT EXISTS provider_keys(user_id BIGINT UNSIGNED NOT NULL,provider VARCHAR(40) NOT NULL,iv VARBINARY(12) NOT NULL,tag VARBINARY(16) NOT NULL,secret BLOB NOT NULL,PRIMARY KEY(user_id,provider),CONSTRAINT provider_keys_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,`CREATE TABLE IF NOT EXISTS profiles(user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,phone VARCHAR(40) NOT NULL DEFAULT '',company VARCHAR(160) NOT NULL DEFAULT '',job_title VARCHAR(120) NOT NULL DEFAULT '',country VARCHAR(100) NOT NULL DEFAULT '',bio TEXT NOT NULL,CONSTRAINT profiles_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,`CREATE TABLE IF NOT EXISTS email_verifications(token_hash CHAR(64) NOT NULL PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,expires_at BIGINT NOT NULL,CONSTRAINT verifications_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`];
if(sqlite)for(const sql of schema)sqlite.exec(sql);else for(const sql of schema)await pool.query(sql);
async function all(sql,params=[]){if(sqlite)return sqlite.prepare(sql).all(...params);const [rows]=await pool.execute(sql,params);return rows;}
async function one(sql,params=[]){return (await all(sql,params))[0]||null;}
async function run(sql,params=[]){if(sqlite){const r=sqlite.prepare(sql).run(...params);return {insertId:Number(r.lastInsertRowid),affectedRows:Number(r.changes)};}const [r]=await pool.execute(sql,params);return {insertId:Number(r.insertId),affectedRows:r.affectedRows};}
const MODELS=[{id:'ollama:llama3.2',name:'Llama 3.2',provider:'Ollama',category:'local'},{id:'ollama:qwen2.5',name:'Qwen 2.5',provider:'Ollama',category:'local'},{id:'ollama:deepseek-r1',name:'DeepSeek R1',provider:'Ollama',category:'local'},{id:'ollama:gemma3',name:'Gemma 3',provider:'Ollama',category:'local'}];
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const json=(res,status,data,headers={})=>{const text=JSON.stringify(data);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(text),...headers});res.end(text);};
async function bodyJSON(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>65536)throw Error('Request too large');}return JSON.parse(text||'{}');}
const hash=value=>createHash('sha256').update(value).digest('hex'),usernameValue=value=>String(value||'').trim().toLowerCase();
function seal(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',masterKey,iv),secret=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return{iv,tag:cipher.getAuthTag(),secret};}
function tokenFrom(req){const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('freeai_session='));return cookie?cookie.slice(cookie.indexOf('=')+1):null;}
async function sessionUser(req){const token=tokenFrom(req);if(!token)return null;const tokenHash=hash(token),user=await one('SELECT users.id,users.username,users.real_name,users.email,users.theme,users.email_verified,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=?',[tokenHash]);if(!user||Number(user.expires_at)<Date.now()){if(user)await run('DELETE FROM sessions WHERE token_hash=?',[tokenHash]);return null;}return user;}
const secureRequest=req=>Boolean(req.socket.encrypted||req.headers['x-forwarded-proto']==='https');
function sessionCookie(token,days,secure){return`freeai_session=${token}; Path=/; HttpOnly; SameSite=Lax${secure?'; Secure':''}; Max-Age=${days*86400}`;}
function responseJSON(res,status,data,headers={}){json(res,status,data,headers);}
function emailTransport(){if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASSWORD||!process.env.SMTP_FROM||!process.env.APP_BASE_URL)throw Error('Email verification is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM and APP_BASE_URL before enabling registration.');return{transport:createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT)||587,secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}}),from:process.env.SMTP_FROM};}
async function sendVerification(email,realName,rawToken){const mail=emailTransport(),base=(process.env.APP_BASE_URL||'').replace(/\/$/,'');if(!base)throw Error('APP_BASE_URL must be configured for verification links.');const link=`${base}/api/auth/verify?token=${encodeURIComponent(rawToken)}`;await mail.transport.sendMail({from:mail.from,to:email,subject:'Verify your FreeAI account',text:`Hello ${realName},\n\nVerify your email to activate your account: ${link}\n\nThis link expires in 24 hours. If you did not register, ignore this email.`,html:`<p>Hello ${escapeHTML(realName)},</p><p>Verify your email to activate FreeAI.</p><p><a href="${link}">Verify email address</a></p><p>This link expires in 24 hours. If you did not register, ignore this message.</p>`});}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function installedModels(){const endpoint=new URL('/api/tags',process.env.OLLAMA_URL||'http://127.0.0.1:11434'),response=await fetch(endpoint,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error(`Ollama returned ${response.status}`);const data=await response.json();return(data.models||[]).map(x=>String(x.name));}
async function checkOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host;}catch{return false;}}
async function routeAPI(req,res,url){const p=url.pathname,secure=secureRequest(req);if(['POST','PUT','DELETE'].includes(req.method)&&!await checkOrigin(req))return json(res,403,{error:'Origin denied'});
// OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const APP_BASE_URL = (process.env.APP_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// OAuth: Google
if (p === '/auth/google' && req.method === 'GET') {
  if (!GOOGLE_CLIENT_ID) { res.writeHead(303, {location: '/?error=google_not_configured'}); return res.end(); }
  const redirectUri = `${APP_BASE_URL}/auth/google/callback`;
  const scope = 'openid email profile';
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline`;
  res.writeHead(302, {location: url});
  return res.end();
}
if (p === '/auth/google/callback' && req.method === 'GET') {
  const code = url.searchParams.get('code');
  if (!code) return json(res, 400, {error: 'Missing authorization code'});
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${APP_BASE_URL}/auth/google/callback`, grant_type: 'authorization_code'
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error(tokenData.error_description || 'Token exchange failed');
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {authorization: `Bearer ${tokenData.access_token}`}
    });
    const profile = await userRes.json();
    const email = (profile.email || '').toLowerCase();
    const name = profile.name || profile.email || 'Google User';
    let user = await one('SELECT id,username,real_name,email,email_verified,theme FROM users WHERE email=?', [email]);
    if (!user) {
      const username = 'g_' + (profile.id || Math.random().toString(36).slice(2,10));
      const salt = randomBytes(16);
      const passwordHash = await scrypt(randomBytes(32).toString('hex'), salt, 64);
      const userId = (await run('INSERT INTO users(username,real_name,email,email_verified,password_hash,salt) VALUES(?,?,?,?,?,?)', [username, name, email, 1, passwordHash, salt])).insertId;
      await run('INSERT INTO profiles(user_id) VALUES(?)', [userId]);
      user = await one('SELECT id,username,real_name,email,email_verified,theme FROM users WHERE id=?', [userId]);
    }
    const token = randomBytes(32).toString('base64url');
    const days = 30;
    await run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)', [hash(token), user.id, Date.now() + days * 86400000]);
    res.writeHead(303, {location: '/?auth=success&provider=google&name=' + encodeURIComponent(user.real_name), 'set-cookie': sessionCookie(token, days, secure)});
    return res.end();
  } catch (e) {
    console.error('Google OAuth error:', e);
    res.writeHead(303, {location: '/?error=google_auth_failed'});
    return res.end();
  }
}

// OAuth: GitHub
if (p === '/auth/github' && req.method === 'GET') {
  if (!GITHUB_CLIENT_ID) { res.writeHead(303, {location: '/?error=github_not_configured'}); return res.end(); }
  const redirectUri = `${APP_BASE_URL}/auth/github/callback`;
  const scope = 'user:email';
  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
  res.writeHead(302, {location: url});
  return res.end();
}
if (p === '/auth/github/callback' && req.method === 'GET') {
  const code = url.searchParams.get('code');
  if (!code) return json(res, 400, {error: 'Missing authorization code'});
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {'accept': 'application/json', 'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        code, client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET,
        redirect_uri: `${APP_BASE_URL}/auth/github/callback`
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error(tokenData.error_description || 'Token exchange failed');
    const userRes = await fetch('https://api.github.com/user', {
      headers: {authorization: `Bearer ${tokenData.access_token}`, 'user-agent': 'FreeAI'}
    });
    const profile = await userRes.json();
    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {authorization: `Bearer ${tokenData.access_token}`, 'user-agent': 'FreeAI'}
      });
      const emails = await emailsRes.json();
      email = (emails.find(e => e.primary) || emails[0])?.email;
    }
    email = (email || '').toLowerCase();
    const name = profile.name || profile.login || 'GitHub User';
    let user = await one('SELECT id,username,real_name,email,email_verified,theme FROM users WHERE email=?', [email]);
    if (!user) {
      const username = 'gh_' + (profile.id || Math.random().toString(36).slice(2,10));
      const salt = randomBytes(16);
      const passwordHash = await scrypt(randomBytes(32).toString('hex'), salt, 64);
      const userId = (await run('INSERT INTO users(username,real_name,email,email_verified,password_hash,salt) VALUES(?,?,?,?,?,?)', [username, name, email, 1, passwordHash, salt])).insertId;
      await run('INSERT INTO profiles(user_id) VALUES(?)', [userId]);
      user = await one('SELECT id,username,real_name,email,email_verified,theme FROM users WHERE id=?', [userId]);
    }
    const token = randomBytes(32).toString('base64url');
    const days = 30;
    await run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)', [hash(token), user.id, Date.now() + days * 86400000]);
    res.writeHead(303, {location: '/?auth=success&provider=github&name=' + encodeURIComponent(user.real_name), 'set-cookie': sessionCookie(token, days, secure)});
    return res.end();
  } catch (e) {
    console.error('GitHub OAuth error:', e);
    res.writeHead(303, {location: '/?error=github_auth_failed'});
    return res.end();
  }
}

 if(p==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,storage:DRIVER,emailConfigured:Boolean(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASSWORD&&process.env.SMTP_FROM&&process.env.APP_BASE_URL)});
 if(p==='/api/auth/register'&&req.method==='POST'){let b;try{b=await bodyJSON(req);}catch{return json(res,400,{error:'Invalid form'});}const username=usernameValue(b.username),realName=String(b.realName||'').trim(),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');if(!/^[a-z0-9_.-]{3,40}$/.test(username))return json(res,400,{error:'Username must be 3–40 letters, numbers, dots, dashes or underscores.'});if(realName.length<2||realName.length>160)return json(res,400,{error:'Enter your real name.'});if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return json(res,400,{error:'Enter a valid email address.'});if(password.length<10)return json(res,400,{error:'Password must be at least 10 characters.'});let mailer;try{mailer=emailTransport();if(!process.env.APP_BASE_URL)throw Error('APP_BASE_URL is missing.');}catch(e){return json(res,503,{error:e.message});}const salt=randomBytes(16),passwordHash=await scrypt(password,salt,64);let userId;try{userId=(await run('INSERT INTO users(username,real_name,email,email_verified,password_hash,salt) VALUES(?,?,?,?,?,?)',[username,realName,email,0,passwordHash,salt])).insertId;await run('INSERT INTO profiles(user_id) VALUES(?)',[userId]);}catch(e){return json(res,e.code==='SQLITE_CONSTRAINT_UNIQUE'||e.code==='ER_DUP_ENTRY'?409:500,{error:e.code==='SQLITE_CONSTRAINT_UNIQUE'||e.code==='ER_DUP_ENTRY'?'Username or email is already registered.':'Could not create account.'});}const raw=randomBytes(32).toString('base64url');await run('INSERT INTO email_verifications(token_hash,user_id,expires_at) VALUES(?,?,?)',[hash(raw),userId,Date.now()+86400000]);try{const base=process.env.APP_BASE_URL.replace(/\/$/,'');await mailer.transport.sendMail({from:mailer.from,to:email,subject:'Verify your FreeAI email',text:`Hello ${realName},\n\nVerify your email to activate FreeAI: ${base}/api/auth/verify?token=${encodeURIComponent(raw)}\n\nThis link expires in 24 hours.`,html:`<p>Hello ${escapeHTML(realName)},</p><p>Verify your email to activate FreeAI.</p><p><a href="${base}/api/auth/verify?token=${encodeURIComponent(raw)}">Verify my email</a></p><p>This link expires in 24 hours.</p>`});}catch(e){await run('DELETE FROM users WHERE id=?',[userId]);return json(res,503,{error:`Verification email could not be sent. Account was not activated. ${e.message}`});}return json(res,201,{verificationRequired:true,message:'Check your inbox and verify your email before signing in.'});}
 if(p==='/api/auth/verify'&&req.method==='GET'){const token=String(url.searchParams.get('token')||'');if(!token)return json(res,400,{error:'Verification link is missing.'});const row=await one('SELECT user_id,expires_at FROM email_verifications WHERE token_hash=?',[hash(token)]);if(!row||Number(row.expires_at)<Date.now())return json(res,400,{error:'Verification link is invalid or expired. Request a new link.'});await run('UPDATE users SET email_verified=1 WHERE id=?',[row.user_id]);await run('DELETE FROM email_verifications WHERE user_id=?',[row.user_id]);const raw=randomBytes(32).toString('base64url');await run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',[hash(raw),row.user_id,Date.now()+86400000]);res.writeHead(303,{location:'/?verified=1','set-cookie':sessionCookie(raw,1,secure),'cache-control':'no-store'});return res.end();}
 if(p==='/api/auth/login'&&req.method==='POST'){let b;try{b=await bodyJSON(req);}catch{return json(res,400,{error:'Invalid form'});}const username=usernameValue(b.username),row=await one('SELECT id,username,real_name,email,password_hash,salt,email_verified,theme FROM users WHERE username=?',[username]);if(!row)return json(res,401,{error:'Username or password is incorrect.'});const candidate=await scrypt(String(b.password||''),Buffer.from(row.salt),64),existing=Buffer.from(row.password_hash);if(candidate.length!==existing.length||!timingSafeEqual(candidate,existing))return json(res,401,{error:'Username or password is incorrect.'});if(!Number(row.email_verified))return json(res,403,{error:'Verify your email address before using FreeAI.'});const token=randomBytes(32).toString('base64url'),days=b.remember?30:1;await run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',[hash(token),row.id,Date.now()+days*86400000]);return json(res,200,{user:{username:row.username,realName:row.real_name,email:row.email},theme:row.theme},{'set-cookie':sessionCookie(token,days,secure)});}
 if(p==='/api/auth/resend'&&req.method==='POST'){let b;try{b=await bodyJSON(req);}catch{return json(res,400,{error:'Invalid form'});}const email=String(b.email||'').trim().toLowerCase(),row=await one('SELECT id,real_name,email_verified FROM users WHERE email=?',[email]);if(row&&!Number(row.email_verified)){try{const mailer=emailTransport(),raw=randomBytes(32).toString('base64url');await run('DELETE FROM email_verifications WHERE user_id=?',[row.id]);await run('INSERT INTO email_verifications(token_hash,user_id,expires_at) VALUES(?,?,?)',[hash(raw),row.id,Date.now()+86400000]);const base=process.env.APP_BASE_URL.replace(/\/$/,'');await mailer.transport.sendMail({from:mailer.from,to:email,subject:'Verify your FreeAI email',text:`Verify your FreeAI account: ${base}/api/auth/verify?token=${encodeURIComponent(raw)}`});}catch(e){return json(res,503,{error:`Could not send verification email: ${e.message}`});}}return json(res,200,{message:'If the address belongs to an unverified account, a verification link has been sent.'});}
 if(p==='/api/auth/logout'&&req.method==='POST'){const token=(req.headers.cookie||'').match(/(?:^|; )freeai_session=([^;]+)/)?.[1];if(token)await run('DELETE FROM sessions WHERE token_hash=?',[hash(token)]);return json(res,200,{ok:true},{'set-cookie':sessionCookie('',0,secure)});}
 const token=(req.headers.cookie||'').match(/(?:^|; )freeai_session=([^;]+)/)?.[1],user=token?await one('SELECT u.id,u.username,u.real_name,u.email,u.email_verified,u.theme,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?',[hash(token)]):null;
 if(p==='/api/auth/me'&&req.method==='GET'){if(!user)return json(res,200,{user:null});if(!Number(user.email_verified))return json(res,200,{user:null,verificationRequired:true,email:user.email});return json(res,200,{user:{username:user.username,realName:user.real_name,email:user.email},theme:user.theme});}
 if(!user)return json(res,401,{error:'Sign in to continue.'});if(Number(user.expires_at)<Date.now()){await run('DELETE FROM sessions WHERE token_hash=?',[hash(token)]);return json(res,401,{error:'Session expired. Sign in again.'});}if(!Number(user.email_verified))return json(res,403,{error:'Verify your email before accessing FreeAI.'});
 if(p==='/api/profile'&&req.method==='GET'){const profile=await one('SELECT phone,company,job_title,country,bio FROM profiles WHERE user_id=?',[user.id]);return json(res,200,{profile:{realName:user.real_name,email:user.email,...(profile||{})}});}
 if(p==='/api/profile'&&req.method==='PUT'){let b;try{b=await bodyJSON(req);}catch{return json(res,400,{error:'Invalid profile data.'});}const realName=String(b.realName||'').trim();if(realName.length<2||realName.length>160)return json(res,400,{error:'Enter a valid real name.'});await run('UPDATE users SET real_name=? WHERE id=?',[realName,user.id]);const fields=['phone','company','job_title','country','bio'],values=fields.map(k=>String(b[k]||'').trim().slice(0,k==='bio'?1000:160));await run('UPDATE profiles SET phone=?,company=?,job_title=?,country=?,bio=? WHERE user_id=?',[...values,user.id]);return json(res,200,{ok:true});}
 if(p==='/api/catalog'&&req.method==='GET'){const installed=await getInstalledModels();return json(res,200,{models:installed.map(name=>({id:`ollama:${name}`,name,provider:'Ollama',category:'local',description:'Installed locally · no API key · no usage fee'}))});}
 if(p==='/api/models/available'&&req.method==='GET'){try{const installed=await getInstalledModels();return json(res,200,{models:installed.map(name=>({id:`ollama:${name}`,name,provider:'Ollama',category:'local',description:'Installed locally · no API key · no usage fee'})),installed:installed.length});}catch(e){return json(res,503,{error:`No local models are available from the app server: ${e.message}`,models:[]});}}
 if(p==='/api/settings'&&req.method==='GET'){const topModels=Array(3).fill('');for(const x of await all('SELECT slot,model_id FROM hero_slots WHERE user_id=? ORDER BY slot',[user.id]))topModels[Number(x.slot)]=x.model_id;return json(res,200,{theme:user.theme,topModels});}
 if(p==='/api/settings'&&req.method==='PUT'){let b;try{b=await bodyJSON(req);}catch{return json(res,400,{error:'Invalid settings.'});}const theme=b.theme==='light'?'light':'dark';await run('UPDATE users SET theme=? WHERE id=?',[theme,user.id]);return json(res,200,{ok:true,theme});}
 if(p==='/api/models'&&req.method==='PUT'){let b;try{b=await bodyJSON(req);}catch{return json(res,400,{error:'Invalid model selection.'});}let installed;try{installed=await getInstalledModels();}catch{return json(res,503,{error:'The app server cannot verify installed local models.'});}let top=Array.isArray(b.topModels)?b.topModels.slice(0,3):[];while(top.length<3)top.push('');top=top.map(id=>id&&id.startsWith('ollama:')&&installed.includes(id.slice(7))?id:'');if(new Set(top.filter(Boolean)).size!==top.filter(Boolean).length)return json(res,400,{error:'Choose different models in each slot.'});await run('DELETE FROM hero_slots WHERE user_id=?',[user.id]);for(let i=0;i<3;i++)if(top[i])await run('INSERT INTO hero_slots(user_id,slot,model_id) VALUES(?,?,?)',[user.id,i,top[i]]);return json(res,200,{topModels:top});}
 if(p==='/api/chat'&&req.method==='POST'){let b;try{b=await bodyJSON(req);}catch{return json(res,400,{error:'Invalid message.'});}const modelId=String(b.modelId||''),prompt=String(b.prompt||'').trim();if(!modelId.startsWith('ollama:')||!prompt||prompt.length>8000)return json(res,400,{error:'Choose an installed model and enter a message under 8000 characters.'});const slot=await one('SELECT slot FROM hero_slots WHERE user_id=? AND model_id=?',[user.id,modelId]);if(!slot)return json(res,403,{error:'Choose this model in one of your three hero slots first.'});const modelName=modelId.slice(7);let installed;try{installed=await getInstalledModels();}catch(e){return json(res,503,{error:`Local model service is unavailable: ${e.message}`});}if(!installed.includes(modelName))return json(res,409,{error:'This model is no longer installed on the server.'});try{const endpoint=new URL('/api/chat',process.env.OLLAMA_URL||'http://127.0.0.1:11434'),response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:modelName,messages:[{role:'user',content:prompt}],stream:false}),signal:AbortSignal.timeout(60000)}),data=await response.json().catch(()=>({}));if(!response.ok)return json(res,502,{error:data.error||`Ollama returned ${response.status}.`});return json(res,200,{reply:data.message?.content||'',model:modelName,provider:'Ollama'});}catch(e){return json(res,502,{error:`Local chat failed: ${e.message}`});}}
 return json(res,404,{error:'API route not found'});
}
async function getInstalledModels(){const endpoint=new URL('/api/tags',process.env.OLLAMA_URL||'http://127.0.0.1:11434'),response=await fetch(endpoint,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error(`Ollama returned ${response.status}`);const data=await response.json();return(data.models||[]).map(item=>String(item.name));}
async function serve(req,res){const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/'))return routeAPI(req,res,url);const path=normalize(decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)),target=resolve(ROOT,'.'+path);if(target!==ROOT&&!target.startsWith(ROOT+sep))return json(res,403,{error:'Forbidden'});if(target===PRIVATE_DIR||target.startsWith(PRIVATE_DIR+sep))return json(res,404,{error:'Not found'});try{const info=await stat(target);if(!info.isFile())throw Error();res.writeHead(200,{'content-type':mime[extname(target)]||'application/octet-stream','content-length':info.size,'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','cache-control':extname(target)==='.html'?'no-cache':'public,max-age=300'});createReadStream(target).pipe(res);}catch{res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');}}
createServer((req,res)=>serve(req,res).catch(e=>{console.error(e);json(res,500,{error:'Internal server error'});})).listen(PORT,()=>console.log(`FreeAI listening on ${PORT}; ${DRIVER}`));
