(function(){
  'use strict';
  const KEY='steel_bend_session';
  function readSession(){
    try{
      const s=JSON.parse(sessionStorage.getItem(KEY)||'null');
      if(!s||!s.sessionToken||!s.email) return null;
      if(s.expiresAt&&Date.parse(s.expiresAt)<=Date.now()){clearSession();return null;}
      return s;
    }catch(_){clearSession();return null;}
  }
  function saveSession(data){
    const s={sessionToken:String(data.sessionToken||''),email:String(data.email||'').toLowerCase().trim(),role:String(data.role||'user').toLowerCase(),expiresAt:data.expiresAt||''};
    if(!s.sessionToken||!s.email) throw new Error('invalid_session');
    sessionStorage.setItem(KEY,JSON.stringify(s));
    localStorage.removeItem('steel_user');
    return s;
  }
  function clearSession(){sessionStorage.removeItem(KEY);localStorage.removeItem('steel_user');}
  function requireSession(options){
    const s=readSession(),roles=options&&options.roles;
    if(!s||(roles&&!roles.includes(s.role))){clearSession();location.replace('index.html');return null;}
    return s;
  }
  async function secureFetch(url,options){
    const s=readSession();
    if(!s){clearSession();location.replace('index.html');throw new Error('session_expired');}
    const c=Object.assign({},options||{}); c.method=c.method||'POST';
    c.headers=Object.assign({'Content-Type':'application/json'},c.headers||{});
    let body={}; if(c.body){try{body=JSON.parse(c.body);}catch(_){}}
    body.sessionToken=s.sessionToken; body.email=s.email; c.body=JSON.stringify(body);
    const res=await fetch(url,c);
    if(res.status===401||res.status===403){clearSession();location.replace('index.html');throw new Error('session_expired');}
    return res;
  }
  window.SteelSecurity={readSession,saveSession,clearSession,requireSession,secureFetch};
})();
