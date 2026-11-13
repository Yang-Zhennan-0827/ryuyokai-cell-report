/* One dot per saved cell. Display geometry is not a biological embedding. */
fetch('/ab_data/cells.json').then(r=>{if(!r.ok)throw Error('data');return r.json()}).then(data=>{
 const root=document.querySelector('#plots');root.replaceChildren();
 const settings=[['CCL2','CCL2 · 呼び寄せの合図',[46,92,138]],['TNFAIP6','TSG-6 · 炎症を調整する因子',[134,31,53]]];
 for(const [gene,title,color] of settings){
  const section=document.createElement('div');section.className='cell-plot';
  const h=document.createElement('h3');h.textContent=title;section.append(h);
  const max=Math.max(...Object.values(data.genes[gene]).map(a=>Math.max(...a)));
  const legend=document.createElement('div');legend.className='plot-legend';legend.append('0');const scale=document.createElement('span');scale.className='scale';scale.style.background=`linear-gradient(to right,#f1eeea,rgb(${color}))`;legend.append(scale,`${max.toFixed(1)} log1p(CP10k) · 全条件で共通の濃淡`);section.append(legend);
  const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',gene+' 全7条件、1点1細胞の発現量。数値は上の表にも掲載。');section.append(canvas);root.append(section);
  function draw(){
   const width=Math.max(280,Math.round(section.clientWidth-30)),mobile=width<600,band=mobile?145:125,height=band*data.samples.length,dpr=Math.min(window.devicePixelRatio||1,3);
   canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.height=height+'px';const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
   data.samples.forEach((s,j)=>{const a=data.genes[gene][s.id],base=j*band;ctx.fillStyle='#292622';ctx.font='15px sans-serif';ctx.fillText(s.labels[0],0,base+18);ctx.fillStyle='#6c665f';ctx.font='12px sans-serif';ctx.fillText(`n=${s.n_cells.toLocaleString()} cells`,0,base+35);
    const cols=Math.max(100,Math.floor(width/2.5)),rows=Math.ceil(a.length/cols),stepX=width/cols,stepY=(band-58)/rows;
    for(let i=0;i<a.length;i++){const t=max?a[i]/max:0;ctx.fillStyle=`rgb(${color.map((c,k)=>Math.round([241,238,234][k]*(1-t)+c*t)).join(',')})`;ctx.fillRect((i%cols)*stepX,base+48+Math.floor(i/cols)*stepY,Math.max(.7,stepX-.3),Math.max(.7,stepY-.25));}
   });
  }
  new ResizeObserver(draw).observe(section);draw();
 }
}).catch(()=>{document.querySelector('#plots').textContent='細胞プロットを読み込めませんでした。上のグラフ・表とCSVで数値をご確認ください。'});
