/* Offline companion regression against the companion JS/CSS EMBEDDED into the canonical Role Credits HTML.
 * Runs in the existing CI browser suite; deliberately uses a small independent DOM fixture
 * so permission/privacy/health invariants are easy to verify without a network connection.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const { chromium }=require('playwright');
const source=fs.readFileSync(path.resolve('index.html'),'utf8');
const css=source.match(/<style id="rc-companion-style">([\s\S]*?)<\/style>/)?.[1];
const js=source.match(/<script id="rc-companion-hotfix">([\s\S]*?)<\/script>/)?.[1];
assert.ok(css && js, 'Offline Companion scripts and styles must be embedded in canonical HTML');
assert.ok(source.includes('setHybridParent(name,parent)'), 'Hybrid fix must coexist with companion patch');
const template=`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:16px sans-serif;margin:10px}*{box-sizing:border-box}button,input,select{font:inherit;max-width:100%}label{display:block}</style><style>${css}</style></head><body>
<div id="studioHome"></div><div id="studioModeLanding" hidden></div><div id="tokenPoolSheet"></div>
<div id="growthWorkspace"><section class="growth-card"><h3>Character Growth</h3><label><input onchange="state.advancement.firstMissionResolved=this.checked">Mission</label><p class="inline-note">Rules</p></section></div>
<div id="scene"><div class="scene-tools"></div><div id="initiative"></div><div id="inspect"></div></div>
<script>
let selected=null, multiplayer={status:'offline'}, serial=0;const calls=[];
const state={scene:{tokens:[],initiative:['',''],round:1,name:'Test Session'},director:{initiativePhase:'setup',initiativeCursor:-1},advancement:{firstMissionResolved:false},growth:{log:[]},library:{threats:[{id:'t1',name:'Monster <One>',rating:2,shape:'Solo',role:'Assault',health:{Body:9,Mind:8,Spirit:7},stats:{Body:2,Mind:1,Spirit:0},dice:{Physical:8,Mental:6,Spiritual:6},techniques:[{name:'Bite',rank:1,uses:1}],position:'Close, Wedge 1'}]}};
function mpIsHost(){return multiplayer.status==='connected'&&multiplayer.role==='host'}
function mpIsPlayer(){return multiplayer.status==='connected'&&multiplayer.role==='player'}
function mpIsSpectator(){return false}
function mpAuthorityAlert(x){calls.push(x)}
function save(){window.persisted=structuredClone(state)}
function renderScene(){}function renderDirector(){}function bind(){}function renderCharacter(){}function renderGrowth(){}function studioRenderHome(){}function studioRenderModeLanding(){}
function studioOpenMode(a,b){calls.push([a,b]);}
function campaignActive(){return null;}
function sceneMapConfig(){return {rings:['Center','Close','Far','Edge'],wedges:6}}
function makeId(){return 'id'+(++serial)}
function defaultZonePoint(){return {x:20,y:30}}
function findOpenTokenPosition(){return {x:20,y:30}}
function syncTokenVectorToZone(){}
function growthLog(t){state.growth.log.push(t)}
function mpFlowCurrent(){let a=state.scene.initiative.filter(Boolean);if(state.director.initiativePhase==='declare')a.reverse();return a[state.director.initiativeCursor]||''}
function renameSelected(name){state.scene.tokens.find(t=>t.id===selected).name=name;save()}
function removeSelected(){state.scene.tokens=state.scene.tokens.filter(t=>t.id!==selected);selected=null;renderScene()}
function mpPublicScene(){return {tokens:structuredClone(state.scene.tokens)}}
function rcPatchHTML(el,markup){el.innerHTML=markup}
function mpSetFlow(){}function mpAdvanceFlow(){}function mpAdvanceRound(){}
</script><script>${js}</script></body></html>`;
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [width,height] of [[393,851],[1440,900]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.setContent(template);
   await page.locator('#rcCompanionThreatChoice').selectOption('t1');
   await page.locator('#rcCompanionThreatCount').fill('2');
   await page.getByRole('button',{name:'Add Threat(s)'}).click();
   assert.equal(await page.evaluate(()=>state.scene.tokens.length),2);
   assert.equal(await page.evaluate(()=>state.scene.initiative.length),2);
   await page.locator('#rcCompanionInspector [data-rc-companion="hp"][data-track="Body"][data-delta="-1"]').click();
   assert.deepEqual(await page.evaluate(()=>state.scene.tokens.map(t=>t.rcCompanion.health.Body)),[9,8], 'Threat HP isolated per placed token');
   await page.getByRole('button',{name:'Open floating sheet'}).click();
   await page.locator('.rc-comp-float [data-rc-companion="use"][data-delta="-1"]').click();
   assert.deepEqual(await page.evaluate(()=>state.scene.tokens.map(t=>t.rcCompanion.techniques[0].uses)),[1,0]);
   await page.locator('.rc-comp-float textarea[data-field="notes"]').fill('private notes');
   assert.equal(await page.evaluate(()=>state.scene.tokens[1].rcCompanion.notes),'private notes');
   assert.equal(await page.evaluate(()=>mpPublicScene().tokens.every(t=>!t.rcCompanion)),true,'Threat private fields excluded from public scene snapshot');
   await page.getByRole('button',{name:'Collapse'}).click();
   assert.equal(await page.locator('.rc-comp-float-body').isHidden(),true);
   await page.getByRole('button',{name:'Expand'}).click();
   assert.equal(await page.locator('.rc-comp-float-body').isVisible(),true);
   await page.locator('.rc-comp-float-head [data-rc-companion="close"]').click();
   await page.getByRole('button',{name:'Declare',exact:true}).click();
   assert.equal(await page.evaluate(()=>state.director.initiativePhase),'declare');
   await page.getByRole('button',{name:'Next',exact:true}).click();
   await page.getByRole('button',{name:'Next',exact:true}).click();
   assert.equal(await page.evaluate(()=>state.director.initiativePhase),'resolve');
   await page.getByRole('button',{name:'Next round',exact:true}).click();
   assert.equal(await page.evaluate(()=>state.scene.round),2);
   page.on('dialog',async d=>{await d.accept(d.type()==='prompt'?'First mission':undefined)});
   await page.getByRole('button',{name:'Record first Mission completed'}).first().click();
   assert.equal(await page.evaluate(()=>state.advancement.firstMissionResolved),true);
   assert.equal(await page.evaluate(()=>state.growth.log.length),1);
   await page.evaluate(()=>{multiplayer.status='connected';multiplayer.role='player';renderScene()});
   assert.equal(await page.locator('#rcCompanionThreatPicker').isHidden(),true);
   assert.deepEqual(errors,[],'No browser errors');
   console.log(`Offline companion ${width}x${height}: PASS`);
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
