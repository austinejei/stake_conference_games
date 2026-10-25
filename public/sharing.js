'use strict';
window.ExplorerSharing=(()=>{
 const $=id=>document.getElementById(id),dialog=$('shareDialog');let data=null,blob=null,previewUrl='',generation=0,source='points';
 function status(value){$('shareStatus').textContent=value}
 function clear(){generation++;data=null;blob=null;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';$('sharePreview').replaceChildren();if(dialog.open)dialog.close()}
 function message(){return `${data.title} ✦ Gospel Explorers\n${data.points} points · ${data.completed} of ${data.total} levels explored${source==='leaderboard'&&data.groupRank?` · #${data.groupRank} in my group`:''}\nLearning, listening, and growing together!`}
 function publicUrl(){return location.protocol==='https:'&&!['localhost','127.0.0.1','[::1]'].includes(location.hostname)?location.origin:undefined}
 function drawBadge(d){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');
  const rounded=(x,y,w,h,r,fill)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill()};
  const label=(value,x,y,size,color='#29374f',weight=800)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px "Explorer Nunito", sans-serif`;ctx.textAlign='center';ctx.fillText(String(value),x,y)};
  const star=(x,y,r,fill)=>{ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr)}ctx.closePath();ctx.fillStyle=fill;ctx.fill()};
  const bg=ctx.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,'#e6e5ff');bg.addColorStop(.5,'#faf3df');bg.addColorStop(1,'#dff0e7');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
  for(let i=0;i<32;i++){ctx.save();ctx.translate(25+(i*157)%1030,25+(i*211)%1300);ctx.rotate(i*.73);rounded(-5,-12,10,24,3,['#a6b8dc','#e5bb67','#a5c6ac','#c4b2dc'][i%4]);ctx.restore()}
  rounded(62,65,956,1215,55,'#ffffff');rounded(88,89,904,380,42,'#345b73');
  label('GOSPEL EXPLORERS',540,169,46,'#fff',1000);label('LEARN · LISTEN · PLAY · GROW',540,219,20,'#dbe9f4',800);
  ctx.beginPath();ctx.arc(540,390,140,0,Math.PI*2);ctx.fillStyle='#274961';ctx.fill();ctx.beginPath();ctx.arc(540,375,126,0,Math.PI*2);ctx.fillStyle='#ffe3a0';ctx.fill();ctx.beginPath();ctx.arc(540,375,105,0,Math.PI*2);ctx.strokeStyle='#e8bc63';ctx.lineWidth=7;ctx.stroke();star(540,372,66,'#b98028');star(533,362,59,'#fff7d2');
  label(d.title,540,588,57,'#344e76',1000);label(d.alias,540,646,28,'#6e7790',750);
  rounded(153,704,774,158,32,'#fff2cb');label(d.points,540,791,80,'#8c6426',1000);label('POINTS OF DISCOVERY',540,835,22,'#957038',850);
  label(`${d.completed} of ${d.total} levels explored`,540,925,34,'#445b6e',900);rounded(170,961,740,24,12,'#e9eee4');if(d.completed>0)rounded(170,961,Math.max(24,740*d.completed/d.total),24,12,'#86b198');
  if(source==='leaderboard'&&d.groupRank){rounded(260,1023,560,65,28,'#e9effb');label(`#${d.groupRank} IN MY GROUP`,540,1067,28,'#4d6c9f',900)}else label(d.completed?'One discovery at a time.':'My adventure starts here.',540,1067,30,'#7681a0',800);
  label('Accra Ghana Christiansborg Stake',540,1171,25,'#69758c',750);label('A shared adventure. A little more growth.',540,1215,23,'#8993a5',650);
  return canvas;
 }
 function filename(){return `gospel-explorers-${source==='leaderboard'?'leaderboard':'progress'}-badge.png`}
 async function open(kind){clear();source=kind;dialog.showModal();const request=++generation;status('Creating your badge…');for(const id of ['sendBadge','saveBadge','copyBadgeText'])$(id).disabled=true;
  try{const r=await fetch('/api/share-badge'),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load your progress');await document.fonts.ready;if(request!==generation)return;data=d;const canvas=drawBadge(d);const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(request!==generation)return;if(!output)throw Error('This browser could not create the badge image.');blob=output;previewUrl=URL.createObjectURL(blob);const img=document.createElement('img');img.src=previewUrl;img.alt=`${d.title}. ${d.alias}: ${d.points} points and ${d.completed} of ${d.total} levels explored${source==='leaderboard'&&d.groupRank?`, rank ${d.groupRank} in your group`:''}.`;if(img.decode)await img.decode();if(request!==generation)return;$('sharePreview').appendChild(img);for(const id of ['sendBadge','saveBadge','copyBadgeText'])$(id).disabled=false;status('Your badge is ready. Preview it, then choose how to share.')}
  catch(error){if(request===generation)status(error.message)}
 }
 $('sharePoints').onclick=()=>open('points');$('shareLeaderboard').onclick=()=>open('leaderboard');$('closeShare').onclick=clear;dialog.addEventListener('cancel',clear);dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)clear()}});
 $('sendBadge').onclick=async()=>{if(!blob||!data)return;const file=new File([blob],filename(),{type:'image/png'}),url=publicUrl();
  try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'Gospel Explorers · '+data.title,text:message(),...(url?{url}:{})});status('Badge handed to your device’s share sheet.')}else if(navigator.share){await navigator.share({title:'Gospel Explorers · '+data.title,text:message(),...(url?{url}:{})});status('Message handed to your share sheet. Save the image separately to attach your badge.')}else status('This browser has no share sheet. Use Save image and Copy message, then share them in your favorite app.')}
  catch(error){status(error.name==='AbortError'?'Sharing cancelled. Your badge is still ready.':'Sharing was unavailable. You can save the image or copy the message instead.')}
 };
 $('saveBadge').onclick=()=>{if(!blob)return;const a=document.createElement('a');a.href=previewUrl;a.download=filename();a.click();status('Your browser should offer the badge image for saving. You can attach it in your favorite app.')};
 $('copyBadgeText').onclick=async()=>{if(!data)return;try{await navigator.clipboard.writeText(message()+(publicUrl()?'\n'+publicUrl():''));status('Message copied. Paste it into your favorite app.')}catch{status('Copy was unavailable. You can still save and share the badge image.')}};
 return {clear};
})();
