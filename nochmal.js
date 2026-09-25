const NOCHMAL_KEY = "spielzaehler-nochmal-v1";
const NM_ONLINE_KEY = "spielzaehler-nochmal-online-v1";
const NM_ONLINE_ARCHIVE = "spielzaehler-nochmal-online-archive-v1";
const NM_LOCAL_ARCHIVE = "spielzaehler-nochmal-local-archive-v1";
function nmLocalArchive(){try{const a=JSON.parse(localStorage.getItem(NM_LOCAL_ARCHIVE));return Array.isArray(a)?a:[]}catch{return []}}
function nmArchiveLocal(state){if(!state)return;const copy=JSON.parse(JSON.stringify(state));copy.archiveId=copy.archiveId||makeId();const a=nmLocalArchive().filter(x=>x.archiveId!==copy.archiveId);a.unshift(copy);localStorage.setItem(NM_LOCAL_ARCHIVE,JSON.stringify(a.slice(0,20)));return copy.archiveId}
function nmRemoveLocalArchive(id){localStorage.setItem(NM_LOCAL_ARCHIVE,JSON.stringify(nmLocalArchive().filter(x=>x.archiveId!==id)))}
function nmOnlineArchive(){try{const a=JSON.parse(localStorage.getItem(NM_ONLINE_ARCHIVE));return Array.isArray(a)?a:[]}catch{return []}}
function nmArchiveRoom(code,state){if(!code)return;const a=nmOnlineArchive().filter(x=>x.code!==code);a.unshift({code,state,updatedAt:Date.now()});localStorage.setItem(NM_ONLINE_ARCHIVE,JSON.stringify(a.slice(0,20)))}
function nmRemoveArchivedRoom(code){localStorage.setItem(NM_ONLINE_ARCHIVE,JSON.stringify(nmOnlineArchive().filter(x=>x.code!==code)))}
const NM_SUPABASE_URL = "https://cgoicitfdwwvdfjkklwr.supabase.co";
const NM_SUPABASE_KEY = "sb_publishable_diJ9QjpAcePv9NdytRlzTw_KLlQ2cbm";
let nmOnlineChannel=null, nmApplyingRemote=false;
let nmPendingDiceChoice={color:null,number:null};
function nmOnlineInfo(){try{return JSON.parse(localStorage.getItem(NM_ONLINE_KEY))}catch{return null}}
function nmSetOnlineInfo(x){x?localStorage.setItem(NM_ONLINE_KEY,JSON.stringify(x)):localStorage.removeItem(NM_ONLINE_KEY)}
function nmClient(){return window.supabase?.createClient(NM_SUPABASE_URL,NM_SUPABASE_KEY)}
function nmRoomCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";return Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join("")}
async function nmPushOnline(s){const o=nmOnlineInfo(),db=nmClient();if(!o||!db||nmApplyingRemote)return;await db.from("nm_rooms").update({state:s,updated_at:new Date().toISOString()}).eq("code",o.code)}
async function nmSubscribe(code){const db=nmClient();if(!db)return;if(nmOnlineChannel)await db.removeChannel(nmOnlineChannel);nmOnlineChannel=db.channel("nm-"+code).on("postgres_changes",{event:"UPDATE",schema:"public",table:"nm_rooms",filter:"code=eq."+code},payload=>{if(!payload.new?.state)return;const incoming=payload.new.state,current=nmLoad();if(current&&JSON.stringify(current)===JSON.stringify(incoming))return;const sx=window.scrollX,sy=window.scrollY,board=document.querySelector(".nm-board-wrap"),bx=board?.scrollLeft||0;nmApplyingRemote=true;nmSave(incoming,false);nmApplyingRemote=false;if(view.name==="nochmal"){renderNochMal();requestAnimationFrame(()=>{window.scrollTo(sx,sy);const b=document.querySelector(".nm-board-wrap");if(b)b.scrollLeft=bx})}}).subscribe()}
async function nmCreateOnline(names){const db=nmClient();if(!db)throw new Error("Online-Dienst nicht geladen");for(let tries=0;tries<8;tries++){const code=nmRoomCode(),s={players:names.map(nmNewPlayer),active:null,firstCols:{},firstColors:{},dice:{colors:[null,null,null],numbers:[null,null,null]},createdAt:Date.now(),online:true,roomCode:code};s.active=s.players[0].id;s.turn={number:1,activePlayerId:s.players[0].id,rolled:false,reserved:null,done:[]};s.claimedPlayerIds=[s.players[0].id];const {error}=await db.from("nm_rooms").insert({code,state:s});if(!error){nmSetOnlineInfo({code,playerId:s.players[0].id});nmSave(s,false);await nmSubscribe(code);return code}}throw new Error("Raum konnte nicht erstellt werden")}
async function nmJoinOnline(code){const db=nmClient();if(!db)throw new Error("Online-Dienst nicht geladen");code=code.trim().toUpperCase();const {data,error}=await db.from("nm_rooms").select("state").eq("code",code).maybeSingle();if(error||!data)throw new Error("Raum nicht gefunden");const st=data.state;nmEnsureOnlineTurn(st);st.claimedPlayerIds=Array.isArray(st.claimedPlayerIds)?st.claimedPlayerIds:[];let playerId=nmOnlineInfo()?.code===code?nmOnlineInfo()?.playerId:null;if(!playerId||!st.players.some(p=>p.id===playerId)){const free=st.players.find(p=>!st.claimedPlayerIds.includes(p.id));if(!free)throw new Error("Alle Spielerplätze sind bereits belegt");playerId=free.id;st.claimedPlayerIds.push(playerId);await db.from("nm_rooms").update({state:st,updated_at:new Date().toISOString()}).eq("code",code)}nmSetOnlineInfo({code,playerId});st.active=playerId;nmSave(st,false);await nmSubscribe(code);return st}
function nmLeaveOnline(){const o=nmOnlineInfo(),s=nmLoad();if(o?.code)nmArchiveRoom(o.code,s);const db=nmClient();if(db&&nmOnlineChannel)db.removeChannel(nmOnlineChannel);nmOnlineChannel=null;nmSetOnlineInfo(null);localStorage.removeItem(NOCHMAL_KEY)}
const NM_COLS = "ABCDEFGHIJKLMNO".split("");
const NM_HIGH = [5,3,3,3,2,2,2,1,2,2,2,3,3,3,5];
const NM_LOW  = [3,2,2,2,1,1,1,0,1,1,1,2,2,2,3];
const NM_COLORS = [
  ["g","g","g","y","y","y","y","g","b","b","b","o","y","y","y"],
  ["o","g","y","g","y","y","o","o","p","b","b","o","o","g","g"],
  ["b","g","p","g","g","g","g","p","p","p","y","y","o","g","g"],
  ["b","p","p","g","o","o","b","b","g","g","y","y","o","p","b"],
  ["p","o","o","o","o","p","b","b","o","o","o","p","p","p","p"],
  ["p","b","b","p","p","p","p","b","y","o","p","b","b","b","o"],
  ["y","y","b","b","b","b","p","y","y","y","g","g","g","o","o"]
];
const NM_STARS = new Set(["0-7","0-11","1-2","1-4","1-9","2-0","3-5","3-13","5-1","5-3","5-8","5-10","5-14","6-12"]);
const NM_COLOR_NAMES={g:"Grün",y:"Gelb",b:"Blau",o:"Orange",p:"Pink"};
const NM_DIE_COLORS=["g","y","b","o","p","joker"];
const NM_DIE_NUMBERS=[1,2,3,4,5,"joker"];
function nmRollDie(faces){return faces[Math.floor(Math.random()*faces.length)]}
function nmEnsureOnlineTurn(s){if(!s.online)return;s.turn=s.turn||{number:1,activePlayerId:s.players[0]?.id,rolled:false,reserved:null,done:[]};s.turn.done=Array.isArray(s.turn.done)?s.turn.done:[]}
function nmMyPlayer(s){const id=nmOnlineInfo()?.playerId;return s.players.find(p=>p.id===id)||s.players[0]}
function nmIsFirstThree(s){return (s.turn?.number||1)<=3}
function nmAvailableDie(s,type,i){if(!s.online||nmIsFirstThree(s)||!s.turn?.reserved)return true;return s.turn.reserved[type]!==i}
function nmResolvedChoice(s,pid){return s.turn?.choice?.[pid]||null}
function nmChoiceValues(s,ch){
  if(!ch)return null;
  const color=s.dice?.colors?.[ch.color],number=s.dice?.numbers?.[ch.number];
  return {color,number};
}
function nmCellAllowedForChoice(key,values,p){
  if(!values)return false;
  const [r,c]=key.split("-").map(Number),cellColor=NM_COLORS[r]?.[c];
  const colorOk=values.color==="joker"||cellColor===values.color;
  return colorOk;
}
function nmValidateNewMarks(s,p,beforeCells){
  const ch=nmResolvedChoice(s,p.id),v=nmChoiceValues(s,ch);if(!ch||!v)return {ok:false,msg:"Bitte zuerst deine Würfel auswählen und bestätigen."};
  const before=new Set(beforeCells),after=new Set(p.cells),added=[...after].filter(x=>!before.has(x));
  if(!added.length)return {ok:false,msg:"Markiere die Felder deiner gewählten Würfel."};
  if(added.some(k=>!nmCellAllowedForChoice(k,v,p)))return {ok:false,msg:"Du darfst nur Felder der gewählten Farbe markieren."};
  const need=v.number==="joker"?null:Number(v.number);
  if(need!=null&&added.length!==need)return {ok:false,msg:"Du musst genau "+need+" Feld"+(need===1?"":"er")+" markieren."};
  const addedSet=new Set(added);
  const coords=added.map(k=>k.split("-").map(Number));
  const linked=coords.every(([r,c])=>coords.length===1||coords.some(([rr,cc])=>!(rr===r&&cc===c)&&Math.abs(rr-r)+Math.abs(cc-c)===1)||[...before].some(k=>{const [rr,cc]=k.split("-").map(Number);return Math.abs(rr-r)+Math.abs(cc-c)===1}));
  if(!linked)return {ok:false,msg:"Die neu markierten Felder müssen zusammenhängen bzw. an bereits markierte Felder anschließen."};
  return {ok:true};
}
function nmFinishTurnIfReady(s){if(!s.online)return;const ids=s.players.map(p=>p.id);if(!ids.every(id=>s.turn.done.includes(id)))return;const ai=ids.indexOf(s.turn.activePlayerId);s.turn={number:s.turn.number+1,activePlayerId:ids[(ai+1)%ids.length],rolled:false,reserved:null,done:[]};s.dice={colors:[null,null,null],numbers:[null,null,null]}}

function nmDiceHtml(s){
  const d=s.dice||{}, colors=Array.isArray(d.colors)?d.colors:[null,null,null], nums=Array.isArray(d.numbers)?d.numbers:[null,null,null];
  const dieColor=x=>x==="joker"?"nm-black":x?"nm-"+x:"", colorFace=x=>x==="joker"?"✕":x?"":"–", numFace=x=>x==="joker"?"?":(x??"–");
  if(!s.online)return '<div class="nm-dice-panel"><div class="nm-dice-row">'+colors.map(x=>'<span class="nm-die nm-color-die '+dieColor(x)+'">'+colorFace(x)+'</span>').join("")+'</div><div class="nm-dice-row">'+nums.map(x=>'<span class="nm-die nm-number-die">'+numFace(x)+'</span>').join("")+'</div><button type="button" class="nm-roll-all" id="nm-roll-all">Alle 6 würfeln</button></div>';
  nmEnsureOnlineTurn(s);const me=nmMyPlayer(s),active=s.turn.activePlayerId===me.id,done=s.turn.done.includes(me.id),first3=nmIsFirstThree(s),r=s.turn.reserved,confirmed=s.turn.choice?.[me.id],pending=confirmed||nmPendingDiceChoice;
  const colorDice=colors.map((x,i)=>'<button type="button" '+(!s.turn.rolled||done||confirmed||(!active&&!first3)||!nmAvailableDie(s,"color",i)?'disabled':'')+' class="nm-die nm-color-die '+dieColor(x)+' '+(pending.color===i?'nm-selected':'')+'" data-nm-die-color="'+i+'">'+colorFace(x)+'</button>').join("");
  const numDice=nums.map((x,i)=>'<button type="button" '+(!s.turn.rolled||done||confirmed||(!active&&!first3)||!nmAvailableDie(s,"number",i)?'disabled':'')+' class="nm-die nm-number-die '+(pending.number===i?'nm-selected':'')+'" data-nm-die-number="'+i+'">'+numFace(x)+'</button>').join("");
  let action='';
  if(!s.turn.rolled) action=active?'<button type="button" class="nm-roll-all" id="nm-roll-all">Alle 6 würfeln</button>':'<button class="nm-roll-all" disabled>Warte auf '+escapeHtml(s.players.find(p=>p.id===s.turn.activePlayerId)?.name||"Mitspieler")+'</button>';
  else if(done) action='<button class="nm-roll-all" disabled>Auswahl bestätigt</button>';
  else if(s.turn.choice?.[me.id]) action='<button type="button" class="nm-roll-all" id="nm-confirm-fields">Felder bestätigen</button>';
  else { action='<button type="button" class="nm-roll-all" id="nm-confirm-dice">Würfel bestätigen</button>'; if(active) action+='<button type="button" class="secondary-button small" id="nm-pass">Passen</button>'; }
  return '<div class="nm-dice-panel"><small>Zug '+s.turn.number+' · '+(active?'Du bist aktiv':escapeHtml(s.players.find(p=>p.id===s.turn.activePlayerId)?.name||"")+' ist aktiv')+(first3?' · freie Wahl':'')+'</small><div class="nm-dice-row">'+colorDice+'</div><div class="nm-dice-row">'+numDice+'</div>'+action+'</div>';
}

function nmLoad(){try{return JSON.parse(localStorage.getItem(NOCHMAL_KEY))||null}catch{return null}}
function nmSave(s,push=false){localStorage.setItem(NOCHMAL_KEY,JSON.stringify(s));if(push&&s?.online)nmPushOnline(s)}
function nmNewPlayer(name){return {id:makeId(),name,cells:[],jokers:8}}
function nmScore(s,p){
  const set=new Set(p.cells), cols=[], colors={g:0,y:0,b:0,o:0,p:0};
  NM_COLS.forEach((_,c)=>{if(NM_COLORS.every((r,ri)=>set.has(ri+"-"+c))) cols.push(c)});
  Object.keys(colors).forEach(color=>{const all=[];NM_COLORS.forEach((r,ri)=>r.forEach((x,c)=>{if(x===color)all.push(ri+"-"+c)}));if(all.every(x=>set.has(x)))colors[color]=1});
  let colPts=cols.reduce((n,c)=>n+(s.firstCols[c]===p.id?NM_HIGH[c]:NM_LOW[c]),0);
  let colorPts=Object.keys(colors).reduce((n,c)=>n+(colors[c]?(s.firstColors[c]===p.id?5:3):0),0);
  let openStars=[...NM_STARS].filter(x=>!set.has(x)).length;
  return {total:colPts+colorPts+p.jokers-openStars*2,colPts,colorPts,openStars,colors,cols};
}
function nmRecalcClaims(s){
  s.firstCols={};s.firstColors={};
  for(const p of s.players){const sc=nmScore({...s,firstCols:{},firstColors:{}},p);sc.cols.forEach(c=>{if(s.firstCols[c]==null)s.firstCols[c]=p.id});Object.keys(sc.colors).forEach(c=>{if(sc.colors[c]&&s.firstColors[c]==null)s.firstColors[c]=p.id})}
}
function renderNochMal(){
  title.textContent="Noch mal!"; app.replaceChildren();
  let s=nmLoad();
  if(!s||!s.players?.length){renderNmSetup();return}
  if(!s.active||!s.players.some(p=>p.id===s.active))s.active=s.players[0].id;
  nmRecalcClaims(s);nmSave(s);
  if(s.online){nmEnsureOnlineTurn(s);s.active=nmMyPlayer(s).id} const p=s.players.find(x=>x.id===s.active), score=nmScore(s,p);
  const wrap=document.createElement("section");wrap.className="stack nm-view";
  wrap.innerHTML=(s.online?'<div class="nm-online-players">'+s.players.map(x=>'<span class="'+(x.id===s.turn.activePlayerId?'active':'')+'">'+escapeHtml(x.name)+' <b>'+nmScore(s,x).total+'</b></span>').join("")+'</div>':'<div class="nm-tabs">'+s.players.map(x=>'<button type="button" class="nm-tab '+(x.id===p.id?'active':'')+'" data-nm-player="'+x.id+'">'+escapeHtml(x.name)+'<strong>'+nmScore(s,x).total+'</strong></button>').join("")+'</div>')+
  '<section class="card nm-head"><div><p class="eyebrow">Digitaler Spielblock'+(s.online?' · Online <b class="nm-room-code">'+escapeHtml(s.roomCode||nmOnlineInfo()?.code||'')+'</b>':'')+'</p><h2>'+escapeHtml(p.name)+'</h2></div><div class="nm-total"><small>Punkte</small><strong>'+score.total+'</strong></div></section><div class="nm-floating-dice">'+nmDiceHtml(s)+'</div>'+
  '<div class="nm-board-wrap"><div class="nm-board" id="nm-board"></div></div>'+
  '<section class="card nm-summary"><div><span>Spalten</span><strong>'+score.colPts+'</strong></div><div><span>Farben</span><strong>'+score.colorPts+'</strong></div><div><span>Joker</span><strong>'+p.jokers+'</strong></div><div><span>Offene ★</span><strong>−'+(score.openStars*2)+'</strong></div></section>'+
  '<section class="card nm-jokers"><div><strong>Verbleibende Joker</strong><small>Am Spielende je +1 Punkt</small></div><div class="nm-joker-actions"><button type="button" data-nm-joker="-1">−</button><b>'+p.jokers+'</b><button type="button" data-nm-joker="1">+</button></div></section>'+
  '<button class="danger-button" type="button" id="nm-reset">'+(s.online?'Online-Partie verlassen':'Partie beenden / zurücksetzen')+'</button>';
  app.append(wrap); renderNmBoard(s,p);
}
function renderNmSetup(){
  const el=document.createElement("form");el.id="nm-setup";el.className="stack";
  el.innerHTML='<section class="hero card"><div><span class="hero-icon">✕</span><h2>Noch mal!</h2><p>Digitaler Spielblock. Lokal wie bisher oder gemeinsam auf mehreren Handys.</p></div></section><section class="card stack compact"><p class="eyebrow">Spielmodus</p><div class="nm-mode-grid"><button class="secondary-button" type="button" id="nm-local-mode">Lokal spielen</button><button class="primary-button" type="button" id="nm-online-mode">Online spielen</button></div></section><section class="card stack compact" id="nm-local-setup"><p class="eyebrow">1–6 Personen</p><h2>Mitspieler</h2><div id="nm-names" class="player-fields"><input class="text-input" placeholder="Name" required><input class="text-input" placeholder="Name"></div><button class="secondary-button" type="button" id="nm-add">+ Person</button><button class="primary-button" type="submit">Lokale Partie starten</button></section><section class="card stack compact hidden" id="nm-online-setup"><p class="eyebrow">Mehrere Handys</p><h2>Online-Partie</h2><p class="sk-help">Erstelle einen Raum und teile den 4-stelligen Code – oder tritt einem bestehenden Raum bei.</p><button class="primary-button" type="button" id="nm-online-create">Raum erstellen</button><div class="nm-join-row"><input class="text-input" id="nm-room-input" placeholder="Raumcode" maxlength="4" autocomplete="off"><button class="secondary-button" type="button" id="nm-online-join">Beitreten</button></div></section>';
  const localArchive=nmLocalArchive();
  if(localArchive.length){
    const box=document.createElement("section");box.className="card stack compact nm-local-archive";
    box.innerHTML='<div><p class="eyebrow">Lokal</p><h2>Lokales Archiv</h2></div><div class="nm-archive-list">'+localArchive.map(x=>{const names=(x.players||[]).map(p=>escapeHtml(p.name)).join(", ");return '<div class="nm-archive-item"><div><strong>'+(names||"Noch mal!")+'</strong><small>'+new Date(x.createdAt||Date.now()).toLocaleDateString("de-DE")+'</small></div><div class="nm-archive-actions"><button class="secondary-button small" type="button" data-nm-local-rejoin="'+escapeHtml(x.archiveId)+'">Weiter</button><button class="text-button" type="button" data-nm-local-delete="'+escapeHtml(x.archiveId)+'">Löschen</button></div></div>'}).join("")+'</div>';
    el.append(box);
  }
  const archive=nmOnlineArchive();
  if(archive.length){
    const box=document.createElement("section");box.className="card stack compact nm-online-archive";
    box.innerHTML='<div><p class="eyebrow">Online</p><h2>Letzte Online-Partien</h2></div><div class="nm-archive-list">'+archive.map(x=>{const names=(x.state?.players||[]).map(p=>escapeHtml(p.name)).join(", ");return '<div class="nm-archive-item"><div><strong>'+escapeHtml(x.code)+'</strong><small>'+(names||"Noch mal!")+'</small></div><div class="nm-archive-actions"><button class="secondary-button small" type="button" data-nm-rejoin="'+escapeHtml(x.code)+'">Weiter</button><button class="text-button" type="button" data-nm-archive-delete="'+escapeHtml(x.code)+'">Löschen</button></div></div>'}).join("")+'</div>';
    el.append(box);
  }
  app.append(el);
}
function renderNmBoard(s,p){
  const b=document.querySelector("#nm-board"),set=new Set(p.cells);
  b.innerHTML='<span></span>'+NM_COLS.map(x=>'<b class="nm-col-label">'+x+'</b>').join("");
  NM_COLORS.forEach((row,r)=>{b.insertAdjacentHTML("beforeend",'<b class="nm-row-label">'+(r+1)+'</b>');row.forEach((color,c)=>{const key=r+"-"+c;b.insertAdjacentHTML("beforeend",'<button type="button" class="nm-cell nm-'+color+' '+(set.has(key)?'checked':'')+'" data-nm-cell="'+key+'" aria-label="'+NM_COLOR_NAMES[color]+' '+NM_COLS[c]+(r+1)+'">'+(NM_STARS.has(key)?'<span>★</span>':'')+'</button>')})});
  b.insertAdjacentHTML("beforeend",'<span></span>'+NM_COLS.map((x,c)=>'<div class="nm-col-score"><b>'+NM_HIGH[c]+'</b><small>'+NM_LOW[c]+'</small></div>').join(""));
}
app.addEventListener("click",async e=>{
  if(view.name!=="nochmal")return;
  let s=nmLoad();
  const localRejoin=e.target.closest("[data-nm-local-rejoin]");if(localRejoin){const saved=nmLocalArchive().find(x=>x.archiveId===localRejoin.dataset.nmLocalRejoin);if(saved){nmSave(JSON.parse(JSON.stringify(saved)),false);renderNochMal()}return}
  const localDelete=e.target.closest("[data-nm-local-delete]");if(localDelete){if(confirm("Lokale Partie aus dem Archiv entfernen?")){nmRemoveLocalArchive(localDelete.dataset.nmLocalDelete);renderNochMal()}return}
  const rejoin=e.target.closest("[data-nm-rejoin]");if(rejoin){try{await nmJoinOnline(rejoin.dataset.nmRejoin);renderNochMal()}catch(err){alert("Partie nicht mehr verfügbar: "+err.message)}return}
  const delArchive=e.target.closest("[data-nm-archive-delete]");if(delArchive){if(confirm("Partie aus dem Archiv entfernen?")){nmRemoveArchivedRoom(delArchive.dataset.nmArchiveDelete);renderNochMal()}return}
  if(e.target.id==="nm-local-mode"){document.querySelector("#nm-local-setup")?.classList.remove("hidden");document.querySelector("#nm-online-setup")?.classList.add("hidden");return}
  if(e.target.id==="nm-online-mode"){document.querySelector("#nm-local-setup")?.classList.add("hidden");document.querySelector("#nm-online-setup")?.classList.remove("hidden");return}
  if(e.target.id==="nm-online-create"){try{const names=[...document.querySelectorAll("#nm-names input")].map(x=>x.value.trim()).filter(Boolean);if(!names.length)names.push("Spieler 1");const code=await nmCreateOnline(names);renderNochMal();alert("Raumcode: "+code+"\nTeile diesen Code mit deinen Mitspielern.")}catch(err){alert(err.message)}return}
  if(e.target.id==="nm-online-join"){try{const code=document.querySelector("#nm-room-input")?.value||"";if(code.trim().length!==4)return alert("Bitte 4-stelligen Raumcode eingeben.");await nmJoinOnline(code);renderNochMal()}catch(err){alert(err.message)}return}
  if(e.target.id==="nm-add"){const box=document.querySelector("#nm-names");if(box.children.length<6)box.insertAdjacentHTML("beforeend",'<input class="text-input" placeholder="Name">');return}
  if(e.target.id==="nm-roll-all"){if(s.online){nmEnsureOnlineTurn(s);const me=nmMyPlayer(s);if(s.turn.activePlayerId!==me.id||s.turn.rolled)return;s.turn.rolled=true;s.turn.reserved=null;nmPendingDiceChoice={color:null,number:null}}s.dice={colors:Array.from({length:3},()=>nmRollDie(NM_DIE_COLORS)),numbers:Array.from({length:3},()=>nmRollDie(NM_DIE_NUMBERS))};nmSave(s,true);const panel=document.querySelector(".nm-dice-panel");if(panel){const temp=document.createElement("div");temp.innerHTML=nmDiceHtml(s);panel.replaceWith(temp.firstElementChild)}return}
  const dc=e.target.closest("[data-nm-die-color]");if(dc&&s?.online){nmEnsureOnlineTurn(s);const me=nmMyPlayer(s),i=Number(dc.dataset.nmDieColor);if(s.turn.done.includes(me.id)||s.turn.choice?.[me.id]||!nmAvailableDie(s,"color",i))return;nmPendingDiceChoice.color=i;document.querySelectorAll("[data-nm-die-color]").forEach(x=>x.classList.toggle("nm-selected",Number(x.dataset.nmDieColor)===i));return}
  const dn=e.target.closest("[data-nm-die-number]");if(dn&&s?.online){nmEnsureOnlineTurn(s);const me=nmMyPlayer(s),i=Number(dn.dataset.nmDieNumber);if(s.turn.done.includes(me.id)||s.turn.choice?.[me.id]||!nmAvailableDie(s,"number",i))return;nmPendingDiceChoice.number=i;document.querySelectorAll("[data-nm-die-number]").forEach(x=>x.classList.toggle("nm-selected",Number(x.dataset.nmDieNumber)===i));return}
  if(e.target.id==="nm-pass"&&s?.online){nmEnsureOnlineTurn(s);const me=nmMyPlayer(s);if(s.turn.activePlayerId!==me.id)return;s.turn.reserved=null;nmPendingDiceChoice={color:null,number:null};s.turn.done.push(me.id);nmFinishTurnIfReady(s);nmSave(s,true);renderNochMal();return}
  if(e.target.id==="nm-confirm-dice"&&s?.online){nmEnsureOnlineTurn(s);const me=nmMyPlayer(s),ch={...nmPendingDiceChoice};if(ch.color==null||ch.number==null)return alert("Bitte einen Farb- und einen Zahlenwürfel auswählen.");if(!nmAvailableDie(s,"color",ch.color)||!nmAvailableDie(s,"number",ch.number))return alert("Diese Würfel hat der aktive Spieler bereits genommen.");s.turn.choice=s.turn.choice||{};s.turn.choice[me.id]=ch;s.turn.beforeCells=s.turn.beforeCells||{};s.turn.beforeCells[me.id]=[...me.cells];if(s.turn.activePlayerId===me.id&&!nmIsFirstThree(s))s.turn.reserved={color:ch.color,number:ch.number};nmPendingDiceChoice={color:null,number:null};nmSave(s,true);renderNochMal();return}
  const tab=e.target.closest("[data-nm-player]");if(tab){if(s.online)return;s.active=tab.dataset.nmPlayer;nmSave(s);renderNochMal();return}
  const cell=e.target.closest("[data-nm-cell]");if(cell){const p=s.players.find(x=>x.id===s.active),k=cell.dataset.nmCell;if(s.online){const me=nmMyPlayer(s),ch=nmResolvedChoice(s,me.id);if(!ch)return alert("Bitte zuerst Würfel auswählen und bestätigen.");const vals=nmChoiceValues(s,ch);if(!nmCellAllowedForChoice(k,vals,me))return alert("Dieses Feld passt nicht zu deinem gewählten Farbwürfel.");}const i=p.cells.indexOf(k);if(i>=0)p.cells.splice(i,1);else p.cells.push(k);nmRecalcClaims(s);nmSave(s,true);cell.classList.toggle("checked",i<0);const score=nmScore(s,p);const total=document.querySelector(".nm-total strong");if(total)total.textContent=score.total;const activeTab=document.querySelector(".nm-tab.active strong");if(activeTab)activeTab.textContent=score.total;const vals=document.querySelectorAll(".nm-summary strong");if(vals.length>=4){vals[0].textContent=score.colPts;vals[1].textContent=score.colorPts;vals[2].textContent=p.jokers;vals[3].textContent="−"+(score.openStars*2)}return}
  if(e.target.id==="nm-confirm-fields"&&s?.online){nmEnsureOnlineTurn(s);const me=nmMyPlayer(s),before=s.turn.beforeCells?.[me.id]||[];const check=nmValidateNewMarks(s,me,before);if(!check.ok)return alert(check.msg);if(!s.turn.done.includes(me.id))s.turn.done.push(me.id);nmFinishTurnIfReady(s);nmSave(s,true);renderNochMal();return}
  const j=e.target.closest("[data-nm-joker]");if(j){const p=s.players.find(x=>x.id===s.active);p.jokers=Math.max(0,Math.min(8,p.jokers+Number(j.dataset.nmJoker)));nmSave(s,true);const score=nmScore(s,p);const jokerValue=document.querySelector(".nm-joker-actions b");if(jokerValue)jokerValue.textContent=p.jokers;const vals=document.querySelectorAll(".nm-summary strong");if(vals.length>=3)vals[2].textContent=p.jokers;const total=document.querySelector(".nm-total strong");if(total)total.textContent=score.total;const activeTab=document.querySelector(".nm-tab.active strong");if(activeTab)activeTab.textContent=score.total;return}
  if(e.target.id==="nm-reset"){if(s?.online){if(confirm("Online-Partie verlassen?")){nmLeaveOnline();renderNochMal()}}else if(confirm("Lokale Partie beenden und im Archiv speichern?")){nmArchiveLocal(s);localStorage.removeItem(NOCHMAL_KEY);renderNochMal()}return}
});
app.addEventListener("submit",e=>{
  if(e.target.id!=="nm-setup")return;e.preventDefault();
  const names=[...e.target.querySelectorAll("input")].map(x=>x.value.trim()).filter(Boolean);
  if(!names.length)return alert("Bitte mindestens einen Namen eingeben.");
  const s={players:names.map(nmNewPlayer),active:null,firstCols:{},firstColors:{},dice:{colors:[null,null,null],numbers:[null,null,null]},createdAt:Date.now()};s.active=s.players[0].id;nmSave(s);renderNochMal();
});

window.addEventListener("load",()=>{const o=nmOnlineInfo(),s=nmLoad();if(o&&s?.online)nmSubscribe(o.code)});
