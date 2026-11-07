/* Optional WebGL2 light pass. No animation loop: the existing narration renderer owns the clock.
   It draws a bounded transparent surface and is copied immediately into the existing 2D canvas. */
const VERTEX = '#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}\n';
const PREFIX = '#version 300 es\nprecision highp float;precision highp int;uniform vec3 iResolution;uniform float iTime;uniform sampler2D iChannel0;uniform sampler2D iChannel1;out vec4 outColor;\n';
const SUFFIX = '\nvoid main(){mainImage(outColor,gl_FragCoord.xy);}\n';

function shieldSDF() {
  // Same four cubic curves as the existing glass shield. Generate once, never per frame.
  const controls = [
    [[0,-.52],[-.12,-.40],[-.29,-.34],[-.39,-.37]],
    [[-.39,-.37],[-.40,.06],[-.29,.34],[0,.55]],
    [[0,.55],[.29,.34],[.40,.06],[.39,-.37]],
    [[.39,-.37],[.29,-.34],[.12,-.40],[0,-.52]]
  ];
  const points = [];
  for (const curve of controls) for (let i=0;i<18;i++) {
    const t=i/18,u=1-t;
    points.push([0,1].map(k=>u*u*u*curve[0][k]+3*u*u*t*curve[1][k]+3*u*t*t*curve[2][k]+t*t*t*curve[3][k]));
  }
  const width=192,height=224,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const px=(x+.5)/width-.5,py=((y+.5)/height)*1.2-.6;
    let distance=Infinity,inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++) {
      const a=points[j],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];
      const along=Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/Math.max(1e-12,dx*dx+dy*dy)));
      distance=Math.min(distance,(px-a[0]-dx*along)**2+(py-a[1]-dy*along)**2);
      if((a[1]>py)!==(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    const value=Math.round(Math.max(0,Math.min(1,.5+(inside?-1:1)*Math.sqrt(distance)/.28))*255),index=(y*width+x)*4;
    data[index]=data[index+1]=data[index+2]=value;data[index+3]=255;
  }
  return {width,height,data};
}

export async function createPolish() {
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'low-power',depth:false,stencil:false});
  if(!gl)return null;
  let failed=false;
  const die=()=>{failed=true;canvas.width=canvas.height=1;};
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();die();});
  let program,maskTexture,stateTexture,vertexArray;
  try {
    const response=await fetch('/sanctuary-visions/shimmer.bundled.glsl');
    if(!response.ok)throw new Error('Optional light pass unavailable');
    const body=await response.text();
    function compile(type,text) {
      const shader=gl.createShader(type);gl.shaderSource(shader,text);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const reason=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(reason);}
      return shader;
    }
    const vert=compile(gl.VERTEX_SHADER,VERTEX),frag=compile(gl.FRAGMENT_SHADER,PREFIX+body+SUFFIX);
    program=gl.createProgram();gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
    gl.deleteShader(vert);gl.deleteShader(frag);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);vertexArray=gl.createVertexArray();gl.bindVertexArray(vertexArray);
    const sdf=shieldSDF();maskTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,maskTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,sdf.width,sdf.height,0,gl.RGBA,gl.UNSIGNED_BYTE,sdf.data);
    for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);
    for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
    stateTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,stateTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,8,1,0,gl.RGBA,gl.FLOAT,new Float32Array(32));
    for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.NEAREST);
    for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program,'iChannel0'),0);gl.uniform1i(gl.getUniformLocation(program,'iChannel1'),1);
    const resolution=gl.getUniformLocation(program,'iResolution'),clock=gl.getUniformLocation(program,'iTime');
    const values=new Float32Array(32);
    return {
      render(g,s,viewport) {
        if(failed)return null;
        const margin=g.h*.30;
        const x=Math.max(0,Math.floor(Math.min(g.x-g.h*.86,g.a.x-margin,g.b.x-margin)));
        const y=Math.max(0,Math.floor(Math.min(g.y-g.h*1.35,g.a.y-margin,g.b.y-margin)));
        const right=Math.min(viewport.width,Math.ceil(Math.max(g.x+g.h*.91,g.a.x+margin,g.b.x+margin)));
        const bottom=Math.min(viewport.height,Math.ceil(g.y+g.h*.20));
        const width=right-x,height=bottom-y;
        if(width<1||height<1)return null;
        const scale=Math.min(viewport.width<650?.75:1,700/Math.max(width,height));
        const pw=Math.max(1,Math.round(width*scale)),ph=Math.max(1,Math.round(height*scale));
        if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
        gl.useProgram(program);gl.bindVertexArray(vertexArray);gl.viewport(0,0,pw,ph);
        values.set([g.x,g.y,g.h,s.presence],0);values.set([x,y,scale,height],4);
        values.set([s.threads,s.warmth,s.water,s.ring],8);values.set([s.word,s.can,s.pendant,s.silver],12);
        values.set([g.a.x,g.a.y,g.b.x,g.b.y],16);values.set([g.heart.x,g.heart.y,s.gather,s.snap],20);
        const t=Math.max(0,Math.min(1,(s.t-141.34)/(143.4-141.34))),formed=t*t*(3-2*t);
        values.set([s.petals,formed,0,s.presence],24);values.set([0,0,0,0],28);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,maskTexture);
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,stateTexture);
        gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,8,1,gl.RGBA,gl.FLOAT,values);
        gl.uniform3f(resolution,pw,ph,1);gl.uniform1f(clock,s.t);
        gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES,0,3);
        return {canvas,x,y,width,height};
      },
      dispose(){if(failed)return;gl.deleteTexture(maskTexture);gl.deleteTexture(stateTexture);gl.deleteVertexArray(vertexArray);gl.deleteProgram(program);die();}
    };
  } catch(error) {
    console.warn('Sanctuary shimmer keeps the original vision:',error.message);
    if(program)gl.deleteProgram(program);die();return null;
  }
}
