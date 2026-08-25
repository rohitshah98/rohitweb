(function () {
  const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
  const ease = (n) => { n = clamp(n); return n * n * (3 - 2 * n); };

  class BuildingAnimation {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.progress = 0;
      this.target = 0;
      this.running = false;
      this.resize = this.resize.bind(this);
      this.tick = this.tick.bind(this);
      new ResizeObserver(this.resize).observe(canvas.parentElement);
      this.resize();
    }

    resize() {
      const box = this.canvas.parentElement.getBoundingClientRect();
      this.dpr = Math.min(devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(box.width * this.dpr));
      this.canvas.height = Math.max(1, Math.round(box.height * this.dpr));
      this.canvas.style.width = box.width + 'px';
      this.canvas.style.height = box.height + 'px';
      this.w = box.width;
      this.h = box.height;
      this.scale = Math.min(this.w / 9.2, this.h / 8.4);
      this.draw();
    }

    setProgress(value) {
      this.target = clamp(value);
      if (!this.running) {
        this.running = true;
        requestAnimationFrame(this.tick);
      }
    }

    tick() {
      const delta = this.target - this.progress;
      this.progress += delta * 0.105;
      if (Math.abs(delta) < 0.00035) this.progress = this.target;
      this.draw();
      if (this.progress !== this.target) requestAnimationFrame(this.tick);
      else this.running = false;
    }

    project(x, y, z) {
      const s = this.scale;
      return {
        x: this.w * 0.5 + (x - y) * s * 0.64,
        y: this.h * 0.82 + (x + y) * s * 0.25 - z * s * 0.78,
      };
    }

    polygon(points, fill, stroke = null, alpha = 1, width = 1) {
      if (alpha <= 0) return;
      const c = this.ctx;
      c.save(); c.globalAlpha = clamp(alpha); c.beginPath();
      points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
      c.closePath(); c.fillStyle = fill; c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
      c.restore();
    }

    line(a, b, color, width = 1, alpha = 1) {
      const c = this.ctx; c.save(); c.globalAlpha = alpha; c.beginPath();
      c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.strokeStyle = color;
      c.lineWidth = width; c.lineCap = 'round'; c.stroke(); c.restore();
    }

    cuboid(x, y, z, w, d, h, colors, alpha = 1) {
      if (h <= 0 || alpha <= 0) return;
      const p = (dx, dy, dz) => this.project(x + dx, y + dy, z + dz);
      const a=p(0,0,0), b=p(w,0,0), c=p(w,d,0), d0=p(0,d,0);
      const e=p(0,0,h), f=p(w,0,h), g=p(w,d,h), h0=p(0,d,h);
      this.polygon([b,c,g,f], colors.side || colors.front, colors.edge, alpha);
      this.polygon([a,b,f,e], colors.front, colors.edge, alpha);
      this.polygon([e,f,g,h0], colors.top || colors.front, colors.edge, alpha);
    }

    windowBand(x, y, z, w, h, alpha, divisions = 8) {
      const a=this.project(x,y,z), b=this.project(x+w,y,z), c=this.project(x+w,y,z+h), d=this.project(x,y,z+h);
      this.polygon([a,b,c,d], 'rgba(56,105,122,.86)', '#142a33', alpha);
      for(let i=1;i<divisions;i++){
        const t=i/divisions;
        this.line(this.project(x+w*t,y,z),this.project(x+w*t,y,z+h),'#111b20',1,alpha*.82);
      }
      this.line(this.project(x,y,z+h*.52),this.project(x+w,y,z+h*.52),'#c7e4ec',.7,alpha*.35);
    }

    draw() {
      const c = this.ctx, p = this.progress, dpr = this.dpr;
      c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,this.w,this.h);

      // Transparent cast shadow: the canvas itself never receives a background fill.
      c.save(); c.globalAlpha=.18*ease(p/.15); c.filter='blur(16px)'; c.fillStyle='#000';
      c.beginPath(); c.ellipse(this.w*.52,this.h*.86,this.w*.32,this.h*.075,-.08,0,Math.PI*2); c.fill(); c.restore();

      const foundation = ease(p/.12);
      const concrete={front:'#697175',side:'#3c4346',top:'#9ba1a2',edge:'#b7bec0'};
      const steel={front:'#3f474b',side:'#242a2d',top:'#6e777b',edge:'#11181b'};
      this.cuboid(-3.5,-1.55,0,7,3.45,.28*foundation,concrete,foundation);

      // Footings and starter bars.
      const footingP=ease((p-.025)/.09);
      [[-3.05,-1.1],[-1.35,-1.1],[.35,-1.1],[2.55,-1.1],[-3.05,1.1],[-1.35,1.1],[.35,1.1],[2.55,1.1]].forEach(([x,y])=>{
        this.cuboid(x,y,.26,.42,.42,.16,concrete,footingP);
        const a=this.project(x+.2,y+.2,.42),b=this.project(x+.2,y+.2,.42+.48*footingP);
        this.line(a,b,'#bb733c',1.4,footingP);
      });

      const floors=5, floorH=1.15;
      for(let i=0;i<floors;i++){
        const local=ease((p-(.08+i*.105))/.15), z=.43+i*floorH;
        const colH=floorH*clamp(local/.78);
        [-3.05,-1.35,.35,2.55].forEach(x=>[-1.08,1.08].forEach(y=>this.cuboid(x,y,z,.18,.18,colH,steel,local)));
        // Interior lines make the frame read as a real structural grid.
        [-.25,.55].forEach(y=>[-3.05,-1.35,.35,2.55].forEach(x=>this.cuboid(x,y,z,.13,.13,colH,steel,local*.82)));
        const beamP=ease((local-.42)/.35);
        [-1.08,-.25,.55,1.08].forEach(y=>this.cuboid(-3.05,y,z+floorH-.12,5.78,.16,.2,steel,beamP));
        [-3.05,-1.35,.35,2.55].forEach(x=>this.cuboid(x,-1.08,z+floorH-.12,.16,2.32,.2,steel,beamP));
        const slabP=ease((local-.7)/.3);
        this.cuboid(-3.25,-1.3,z+floorH+.06,6.2,2.75,.13,concrete,slabP);
      }

      // The taller glazed corner and roof structure complete slightly after the main frame.
      const topP=ease((p-.55)/.17), topZ=.43+floors*floorH;
      [.35,2.55].forEach(x=>[-1.08,1.08].forEach(y=>this.cuboid(x,y,topZ,.18,.18,.9*topP,steel,topP)));
      this.cuboid(.25,-1.27,topZ+.82,2.62,2.65,.13,concrete,ease((p-.63)/.12));

      const envelope=ease((p-.63)/.25);
      // Left wing window ribbons and white spandrels.
      for(let i=0;i<4;i++){
        const z=.72+i*floorH;
        this.windowBand(-3.14,-1.315,z,3.55,.62,envelope,7);
        this.cuboid(-3.18,-1.34,z+.64,3.66,.08,.32,{front:'#d7d8d5',side:'#a5a8a7',top:'#f2f1ec',edge:'#51585b'},envelope);
      }
      // Ground shutters.
      for(let i=0;i<5;i++) this.cuboid(-3.1+i*.72,-1.34,.52,.58,.07,.72,{front:i%2?'#9ea3a1':'#c2c5c2',side:'#626866',top:'#d6d8d5',edge:'#333a3d'},envelope);

      // Glazed corner tower with strong horizontal fins.
      for(let i=0;i<5;i++){
        const z=.72+i*floorH;
        this.windowBand(.47,-1.34,z,2.3,.82,envelope,5);
        this.cuboid(.4,-1.39,z+.83,2.48,.09,.08,{front:'#1b2225',side:'#0d1113',top:'#596165',edge:'#090c0d'},envelope);
      }
      // White right blade and upper volume.
      this.cuboid(2.75,-1.3,.5,.18,2.6,5.65*envelope,{front:'#e6e7e3',side:'#aeb2b1',top:'#f6f5f0',edge:'#242b2e'},envelope);
      this.cuboid(.35,-1.27,5.05,2.6,2.62,.58*envelope,{front:'#e1e2df',side:'#9ea3a2',top:'#f3f2ee',edge:'#2b3235'},envelope);

      // Signature blue vertical element from the reference building.
      const blue=ease((p-.74)/.17);
      this.cuboid(.12,-1.48,.35,.32,.16,6.35*blue,{front:'#4d91d1',side:'#285e8d',top:'#91c8ef',edge:'#132b3e'},blue);
      const crown=ease((p-.87)/.1);
      this.cuboid(.05,-1.5,6.62,.5,.2,.12,{front:'#1e262a',side:'#111619',top:'#7f898d',edge:'#090d0f'},crown);

      // Small gold sign echoes the reference without relying on an image layer.
      if(crown>.02){
        const pos=this.project(.47,-1.56,5.75), c2=this.ctx;
        c2.save(); c2.globalAlpha=crown; c2.translate(pos.x,pos.y); c2.rotate(.17);
        c2.fillStyle='#e5bd54'; c2.strokeStyle='#15191a'; c2.lineWidth=2; c2.fillRect(-24,-11,48,22); c2.strokeRect(-24,-11,48,22);
        c2.fillStyle='#171b1d'; c2.font='700 8px DM Mono, monospace'; c2.textAlign='center'; c2.fillText('HAMA',0,3); c2.restore();
      }
    }
  }

  window.BuildingAnimation = BuildingAnimation;
})();
