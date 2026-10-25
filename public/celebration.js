'use strict';
window.ExplorerCelebration=(()=>{
 let last=0;
 function burst(target,kind='match'){
  if(document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const now=Date.now();if(now-last<180&&kind!=='level')return;last=now;
  const bounds=target?.getBoundingClientRect(),x=bounds?bounds.left+bounds.width/2:innerWidth/2,y=bounds?Math.max(40,Math.min(innerHeight-30,bounds.top+bounds.height/2)):innerHeight*.45;
  const layer=document.createElement('div');layer.className='confetti-layer';layer.setAttribute('aria-hidden','true');document.body.appendChild(layer);
  const colors=['#2875d1','#e4b751','#69a47a','#d68098','#8d69ba'],count=kind==='level'?65:22;
  for(let i=0;i<count;i++){const piece=document.createElement('i');piece.className='confetti-piece';piece.style.left=x+'px';piece.style.top=y+'px';piece.style.backgroundColor=colors[i%colors.length];piece.style.setProperty('--travel-x',((Math.random()-.5)*(kind==='level'?600:250))+'px');piece.style.setProperty('--rise',(-90-Math.random()*150)+'px');piece.style.setProperty('--fall',(120+Math.random()*180)+'px');piece.style.setProperty('--spin',(Math.random()*720-360)+'deg');piece.style.animationDelay=(Math.random()*100)+'ms';layer.appendChild(piece)}
  setTimeout(()=>layer.remove(),1600);
 }
 return {burst};
})();
