let faceLandmarker;
let tasksVision;

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const pct=(v)=>Math.round(clamp(v,0,1)*100);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const angle=(a,b,c)=>{
  const ab={x:a.x-b.x,y:a.y-b.y}, cb={x:c.x-b.x,y:c.y-b.y};
  const dot=ab.x*cb.x+ab.y*cb.y;
  const den=Math.hypot(ab.x,ab.y)*Math.hypot(cb.x,cb.y)||1;
  return Math.acos(clamp(dot/den,-1,1))*180/Math.PI;
};

async function ensureModel(){
  if(faceLandmarker) return faceLandmarker;
  tasksVision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm');
  const vision = await tasksVision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
  faceLandmarker = await tasksVision.FaceLandmarker.createFromOptions(vision,{
    baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',delegate:'GPU'},
    runningMode:'IMAGE',numFaces:1,outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false
  });
  return faceLandmarker;
}

function canvasStats(image, lm){
  const c=document.createElement('canvas');
  const max=640, scale=Math.min(1,max/image.naturalWidth);
  c.width=Math.max(1,Math.round(image.naturalWidth*scale)); c.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=c.getContext('2d',{willReadFrequently:true}); ctx.drawImage(image,0,0,c.width,c.height);
  const W=c.width,H=c.height;
  const pts=[lm[10],lm[234],lm[454],lm[152]].map(p=>({x:p.x*W,y:p.y*H}));
  const minX=clamp(Math.min(...pts.map(p=>p.x)),0,W-1),maxX=clamp(Math.max(...pts.map(p=>p.x)),1,W);
  const minY=clamp(Math.min(...pts.map(p=>p.y)),0,H-1),maxY=clamp(Math.max(...pts.map(p=>p.y)),1,H);
  const data=ctx.getImageData(minX,minY,Math.max(1,maxX-minX),Math.max(1,maxY-minY)).data;
  let n=0,mean=0,m2=0,r=0,g=0,b=0, sat=0;
  for(let i=0;i<data.length;i+=16){
    const R=data[i],G=data[i+1],B=data[i+2]; const mx=Math.max(R,G,B), mn=Math.min(R,G,B);
    const lum=.2126*R+.7152*G+.0722*B; n++; const d=lum-mean; mean+=d/n; m2+=d*(lum-mean); r+=R;g+=G;b+=B;sat+=(mx-mn)/(mx||1);
  }
  const sd=Math.sqrt(m2/Math.max(1,n-1));
  const avg={r:r/n,g:g/n,b:b/n};
  const evenness=clamp(1-sd/68,.15,.98);
  const clarity=clamp(1-sd/82,.2,.97);
  const undertone=avg.r-avg.b>18?'warm':avg.b-avg.r>10?'cool':'neutral';
  return {evenness,clarity,undertone,avg,texture:clamp(1-sd/55,.12,.96)};
}

function scorePairSymmetry(lm, midX, a,b){
  const da=Math.abs(lm[a].x-midX), db=Math.abs(lm[b].x-midX);
  return clamp(1-Math.abs(da-db)/.12,.2,1);
}

function describeFaceShape(width,height,jawRatio){
  const ratio=height/width;
  if(ratio>1.45 && jawRatio<.83) return 'oval';
  if(ratio<1.30 && jawRatio>.86) return 'round';
  if(jawRatio>.92) return 'square';
  if(jawRatio<.76) return 'heart';
  return 'oval';
}

export async function analyzePortrait(image){
  const model=await ensureModel();
  const result=model.detect(image);
  if(!result.faceLandmarks?.length) throw new Error('NO_FACE');
  const lm=result.faceLandmarks[0];
  const top=lm[10],chin=lm[152],left=lm[234],right=lm[454],nose=lm[1];
  const width=dist(left,right),height=dist(top,chin),midX=nose.x;
  const symPairs=[[33,263],[133,362],[61,291],[234,454],[172,397]];
  const symmetry=symPairs.reduce((s,[a,b])=>s+scorePairSymmetry(lm,midX,a,b),0)/symPairs.length;
  const browLineY=(lm[105].y+lm[334].y)/2, noseBaseY=lm[2].y;
  const thirds=[browLineY-top.y,noseBaseY-browLineY,chin.y-noseBaseY];
  const thirdsAvg=thirds.reduce((a,b)=>a+b,0)/3;
  const thirdsBalance=clamp(1-(Math.max(...thirds)-Math.min(...thirds))/(thirdsAvg*1.8),.2,1);
  const wh=height/width; const golden=clamp(1-Math.abs(wh-1.618)/.7,.2,1);
  const jawWidth=dist(lm[172],lm[397]), cheekWidth=width, jawRatio=jawWidth/cheekWidth;
  const jawAngle=angle(lm[172],lm[152],lm[397]);
  const jawDefinition=clamp((1-jawRatio)*2.7 + Math.abs(jawAngle-92)/220 + .42,.25,.95);
  const cheekProminence=clamp((cheekWidth/(jawWidth||.01)-1)*2.3+.45,.25,.95);
  const eyeWidth=(dist(lm[33],lm[133])+dist(lm[263],lm[362]))/2;
  const eyeGap=dist(lm[133],lm[362]);
  const eyeSpacing=clamp(1-Math.abs(eyeGap/eyeWidth-1)/1.4,.25,1);
  const noseWidth=dist(lm[129],lm[358]); const lipWidth=dist(lm[61],lm[291]);
  const noseProp=clamp(1-Math.abs(noseWidth/width-.24)/.23,.25,1);
  const lipProp=clamp(1-Math.abs(lipWidth/width-.38)/.32,.25,1);
  const featureHarmony=(eyeSpacing+noseProp+lipProp+symmetry)/4;
  const pixels=canvasStats(image,lm);
  const skin=(pixels.evenness+pixels.clarity+pixels.texture)/3;
  const proportion=(thirdsBalance+golden)/2;
  const bone=(jawDefinition+cheekProminence)/2;
  const overall=clamp(symmetry*.22+proportion*.18+bone*.18+skin*.20+featureHarmony*.22,.35,.96);
  const faceShape=describeFaceShape(width,height,jawRatio);
  return {
    landmarks:lm,
    dimensions:{width:image.naturalWidth,height:image.naturalHeight},
    scores:{symmetry:pct(symmetry),proportions:pct(proportion),bone:pct(bone),skin:pct(skin),harmony:pct(featureHarmony),overall:Math.round(overall*100)/10,golden:pct(golden)},
    meta:{faceShape,undertone:pixels.undertone,jawAngle:Math.round(jawAngle),whRatio:Math.round(wh*100)/100,eyeSpacing:pct(eyeSpacing),skinEvenness:pct(pixels.evenness),clarity:pct(pixels.clarity)}
  };
}

export async function analyzeFinishedMakeup(image){
  const base=await analyzePortrait(image);
  const balance=Math.round((base.scores.symmetry+base.scores.harmony)/2);
  const evenness=base.meta.skinEvenness;
  const finish=Math.round(balance*.45+evenness*.35+base.meta.clarity*.20);
  return {finish,balance,evenness,base};
}
