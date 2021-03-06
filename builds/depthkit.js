
/**
 * depthkit.js
 * https://github.com/Quinten/depthkit.js
 */

var DepthKit = DepthKit || {rad: (Math.PI / 180), deg: (180 / Math.PI)}, DK = DepthKit;

DepthKit.Vertex = function ( x, y, z ) {
  this.x = x || 0;
  this.y = y || 0;
  this.z = z || 0;
  this.px = 0; // x in 2d
  this.py = 0; // y in 2d
  this.pz = 0; // z on axis of camera
  this.d = 0; // distance to the camera
  this.mx = x; // used by the renderer to create a global 'shadow' of the vertex
  this.my = y;
  this.mz = z;
}

DepthKit.Edge = function ( u, v ) {
  this.u = u || new DepthKit.Vertex();
  this.v = v || new DepthKit.Vertex();
  this.faces = [];
}

DepthKit.Edge.prototype.isBehindCamera = function () {
  return (this.u.pz < 0 || this.v.pz < 0);
}

DepthKit.Face = function ( a, b, c, color ) {
  this.a = a || new DepthKit.Vertex();
  this.b = b || new DepthKit.Vertex();
  this.c = c || new DepthKit.Vertex();
  this.color = color || "#cccccc";
  this.light = undefined;
  this.edges = [];
  this.dWeight = 0;
}

DepthKit.Face.prototype.isBackface = function () {
  var cax = this.c.px - this.a.px,
      cay = this.c.py - this.a.py,
      bcx = this.b.px - this.c.px,
      bcy = this.b.py - this.c.py;
  return (cax * bcy > cay * bcx);
}

DepthKit.Face.prototype.isBehindCamera = function () {
  return (this.a.pz < 0 || this.b.pz < 0 || this.c.pz < 0);
}

DepthKit.Face.prototype.getDepth = function () {
  return Math.min(this.a.d - this.dWeight, this.b.d - this.dWeight, this.c.d - this.dWeight);
}

DepthKit.faceSort = function ( a, b ) {
  return (b.getDepth() - a.getDepth());
}

DepthKit.Face.prototype.getAdjustedColor = function () {
  if (this.light === undefined) {
    return this.color;
  }
  var color = window.parseInt(this.color.slice(1), 16),
      red = color >> 16,
      green = color >> 8 & 0xff,
      blue = color & 0xff,
      lightFactor = this.getLightFactor();
  red *= lightFactor;
  green *= lightFactor;
  blue *= lightFactor;
  return ('#' + ('00000' + ((red << 16 | green << 8 | blue) | 0).toString(16)).substr(-6));
}

DepthKit.Face.prototype.getLightFactor = function () {
  var ab = {
    x: this.a.mx - this.b.mx,
    y: this.a.my - this.b.my,
    z: this.a.mz - this.b.mz
  };
  var bc = {
    x: this.b.mx - this.c.mx,
    y: this.b.my - this.c.my,
    z: this.b.mz - this.c.mz
  };
  var norm = {
    x:  (ab.y * bc.z) - (ab.z * bc.y),
    y:-((ab.x * bc.z) - (ab.z * bc.x)),
    z:  (ab.x * bc.y) - (ab.y * bc.x)
  };
  var dotProd = (norm.x * this.light.x) + (norm.y * this.light.y) + (norm.z * this.light.z),
      normMag = Math.sqrt((norm.x * norm.x) + (norm.y * norm.y) + (norm.z * norm.z)),
      lightMag = Math.sqrt((this.light.x * this.light.x) + (this.light.y * this.light.y) + (this.light.z * this.light.z));
  
  return (Math.acos(dotProd / (normMag * lightMag)) / Math.PI) * this.light.brightness;
}

DepthKit.SceneObject =  function ( x, y ,z ) {
  this.x = x || 0;
  this.y = y || 0;
  this.z = z || 0;
  this.rotationX = 0;
  this.rotationY = 0;
  this.rotationZ = 0;
  this.scaleX = 1;
  this.scaleY = 1;
  this.scaleZ = 1;
  this.parent = undefined;
  this.scene = undefined;
  this.step = undefined;
  this.mx = x;
  this.my = y;
  this.mz = z;
  this.rotationMX = 0;
  this.rotationMY = 0;
  this.rotationMZ = 0;
  this.scaleMX = 1;
  this.scaleMY = 1;
  this.scaleMZ = 1;
}

DepthKit.SceneObject.prototype.setScene = function ( scene ) {
  this.scene = scene;
}

DepthKit.SceneObject.prototype.getGlobalX = function () {
  if (this.parent) {
    return (this.parent.getGlobalX() + this.x);
  } else {
    return this.x;
  }
}

DepthKit.SceneObject.prototype.getGlobalY = function () {
  if (this.parent) {
    return (this.parent.getGlobalY() + this.y);
  } else {
    return this.y;
  }
}

DepthKit.SceneObject.prototype.getGlobalZ = function () {
  if (this.parent) {
    return (this.parent.getGlobalZ() + this.z);
  } else {
    return this.z;
  }
}

DepthKit.SceneObject.prototype.initM = function () { }
DepthKit.SceneObject.prototype.rotateM = function () { }
DepthKit.SceneObject.prototype.scaleM = function () { }
DepthKit.SceneObject.prototype.translateM = function () { }

DepthKit.Mesh = function ( x, y, z ) {
  DepthKit.SceneObject.call(this, x, y, z);
  this.d = 0;
  this.vertices = [];
  this.edges = [];
  this.faces = [];
  this.strokeColor = "#000000";
  this.strokeWidth = 1;
}

DepthKit.Mesh.prototype = new DepthKit.SceneObject();
DepthKit.Mesh.prototype.constructor = DepthKit.Mesh;

DepthKit.Mesh.prototype.addVertex = function ( x, y, z ) {
  this.vertices.push(new DepthKit.Vertex(x, y, z));
  return this;
}

DepthKit.Mesh.prototype.addEdge = function ( u, v ) {
  this.edges.push(new DepthKit.Edge((u || this.vertices[this.vertices.length - 2] || new DepthKit.Vertex()), (v || this.vertices[this.vertices.length - 1] || new DepthKit.Vertex())));
  return this;
}

DepthKit.Mesh.prototype.addFace = function ( a, b, c, color ) {
  this.faces.push(new DepthKit.Face((a || this.vertices[this.vertices.length - 3] || new DepthKit.Vertex()), (b || this.vertices[this.vertices.length - 2] || new DepthKit.Vertex()), (c || this.vertices[this.vertices.length - 1] || new DepthKit.Vertex()), color));
  return this;
}

DepthKit.Mesh.prototype.applyFillcolor = function ( color ) {
  for ( var f = 0; f < this.faces.length; f++ ) {
    this.faces[f].color = color;
  }
  return this;
}

DepthKit.Mesh.prototype.applyLight = function ( light ) {
  for ( var f = 0; f < this.faces.length; f++ ) {
    this.faces[f].light = light;
  }
  return this;
}

DepthKit.Mesh.prototype.mergeEdgesWithFaces = function () {
  for ( var f = 0; f < this.faces.length; f++ ) {
    for ( var e = 0; e < this.edges.length; e++ ) {
      if ( (this.edges[e].u === this.faces[f].a && (this.edges[e].v === this.faces[f].b || this.edges[e].v === this.faces[f].c)) 
        || (this.edges[e].u === this.faces[f].b && (this.edges[e].v === this.faces[f].a || this.edges[e].v === this.faces[f].c))
        || (this.edges[e].u === this.faces[f].c && (this.edges[e].v === this.faces[f].a || this.edges[e].v === this.faces[f].b)) ) {
            this.edges[e].faces.push(this.faces[f]);
            this.faces[f].edges.push(this.edges[e]);
      }
    }
  }
  return this;
}

DepthKit.Mesh.prototype.rotateX = function ( degrees ) {
  var cosA = Math.cos(degrees * DK.rad);
  var sinA = Math.sin(degrees * DK.rad);
  for ( var v = 0; v < this.vertices.length; v++ ) {
    var newY = this.vertices[v].y * cosA - this.vertices[v].z * sinA;
    var newZ = this.vertices[v].z * cosA + this.vertices[v].y * sinA;
    this.vertices[v].y = newY;
    this.vertices[v].z = newZ;
  }
  return this;
}

DepthKit.Mesh.prototype.rotateY = function ( degrees ) {
  var cosA = Math.cos(degrees * DK.rad);
  var sinA = Math.sin(degrees * DK.rad);
  for ( var v = 0; v < this.vertices.length; v++ ) {
    var newX = this.vertices[v].x * cosA - this.vertices[v].z * sinA;
    var newZ = this.vertices[v].z * cosA + this.vertices[v].x * sinA;
    this.vertices[v].x = newX;
    this.vertices[v].z = newZ;
  }
  return this;
}

DepthKit.Mesh.prototype.rotateZ = function ( degrees ) {
  var cosA = Math.cos(degrees * DK.rad);
  var sinA = Math.sin(degrees * DK.rad);
  for ( var v = 0; v < this.vertices.length; v++ ) {
    var newX = this.vertices[v].x * cosA - this.vertices[v].y * sinA;
    var newY = this.vertices[v].y * cosA + this.vertices[v].x * sinA;
    this.vertices[v].x = newX;
    this.vertices[v].y = newY;
  }
  return this;
}

DepthKit.Mesh.prototype.setScene = function ( scene ) {
  if ( this.scene === scene ) {
    return;
  }
  if ( this.scene !== undefined ) {
    for ( var m = 0; m < this.scene.meshes.length; m++ ) {
      if ( this.scene.meshes[m] === this ) {
        this.scene.meshes.splice(m, 1);
        break;
      }
    }
  }
  if ( scene !== undefined ) {
    scene.meshes.push(this);
  }
  this.scene = scene;
}

DepthKit.meshSort = function ( a, b ) {
  return (b.d - a.d);
}

DepthKit.Mesh.prototype.draw = function ( context ) {
  context.save();
  // draw faces
  this.faces.sort(DK.faceSort);
  for ( var f = 0; f < this.faces.length; f++ ) {
    if(!this.faces[f].isBackface() && !this.faces[f].isBehindCamera()){
      context.beginPath();
      context.moveTo(this.faces[f].a.px, this.faces[f].a.py);
      context.lineTo(this.faces[f].b.px, this.faces[f].b.py);
      context.lineTo(this.faces[f].c.px, this.faces[f].c.py);
      context.lineTo(this.faces[f].a.px, this.faces[f].a.py);
      context.closePath();
      context.fillStyle = context.strokeStyle = this.faces[f].getAdjustedColor();
      context.lineWidth = 1;
      context.fill();
      context.stroke();
      if ( this.faces[f].edges.length ) {
        context.strokeStyle = this.strokeColor;
        context.lineWidth = this.strokeWidth;
        context.beginPath();
        for ( var l = 0; l < this.faces[f].edges.length; l++ ) {
          context.moveTo(this.faces[f].edges[l].u.px, this.faces[f].edges[l].u.py);
          context.lineTo(this.faces[f].edges[l].v.px, this.faces[f].edges[l].v.py);
        }
        context.stroke();
      }
    }
  }
  // draw edges
  context.strokeStyle = this.strokeColor;
  context.lineWidth = this.strokeWidth;
  context.beginPath();
  for ( var e = 0; e < this.edges.length; e++ ) {
    if(this.edges[e].faces.length === 0 && !this.edges[e].isBehindCamera()){
      context.moveTo(this.edges[e].u.px, this.edges[e].u.py);
      context.lineTo(this.edges[e].v.px, this.edges[e].v.py);
    }
  }
  context.closePath();
  context.stroke();
  context.restore(); 
}

DepthKit.Mesh.prototype.initM = function () {
  this.mx = this.x;
  this.my = this.y;
  this.mz = this.z;
  for ( var v = 0; v < this.vertices.length; v++ ) {
    this.vertices[v].mx = this.vertices[v].x;
    this.vertices[v].my = this.vertices[v].y;
    this.vertices[v].mz = this.vertices[v].z;
  } 
}

DepthKit.Mesh.prototype.rotateM = function () {
  this.rotationMX = (this.rotationX * DK.rad) + this.parent.rotationMX;
  this.rotationMY = (this.rotationY * DK.rad) + this.parent.rotationMY;
  this.rotationMZ = (this.rotationZ * DK.rad) + this.parent.rotationMZ;
  var cosA, sinA, v, newX, newY, newZ;
  if ( this.rotationMX ) {
    cosA = Math.cos(this.rotationMX);
    sinA = Math.sin(this.rotationMX);
    for ( v = 0; v < this.vertices.length; v++ ) {
      newY = this.vertices[v].my * cosA - this.vertices[v].mz * sinA;
      newZ = this.vertices[v].mz * cosA + this.vertices[v].my * sinA;
      this.vertices[v].my = newY;
      this.vertices[v].mz = newZ;
    }  
  }
  if ( this.rotationMY ) {
    cosA = Math.cos(this.rotationMY);
    sinA = Math.sin(this.rotationMY);
    for ( v = 0; v < this.vertices.length; v++ ) {
      newX = this.vertices[v].mx * cosA - this.vertices[v].mz * sinA;
      newZ = this.vertices[v].mz * cosA + this.vertices[v].mx * sinA;
      this.vertices[v].mx = newX;
      this.vertices[v].mz = newZ;
    }    
  }
  if ( this.rotationMZ ) {
    cosA = Math.cos(this.rotationMZ);
    sinA = Math.sin(this.rotationMZ);
    for ( v = 0; v < this.vertices.length; v++ ) {
      newX = this.vertices[v].mx * cosA - this.vertices[v].my * sinA;
      newY = this.vertices[v].my * cosA + this.vertices[v].mx * sinA;
      this.vertices[v].mx = newX;
      this.vertices[v].my = newY;
    }    
  } 
}

DepthKit.Mesh.prototype.translateM = function () {
  this.mx += this.parent.mx;
  this.my += this.parent.my;
  this.mz += this.parent.mz;
  for ( var v = 0; v < this.vertices.length; v++ ) {
    this.vertices[v].mx += this.mx;
    this.vertices[v].my += this.my;
    this.vertices[v].mz += this.mz;
  }
}

DepthKit.Container =  function ( x, y ,z ) {
  DepthKit.SceneObject.call(this, x, y, z);
  this.children = [];
}

DepthKit.Container.prototype = new DepthKit.SceneObject();
DepthKit.Container.prototype.constructor = DepthKit.Container;

DepthKit.Container.prototype.rotateX = function ( degrees ) {
  var cosA = Math.cos(degrees * DK.rad);
  var sinA = Math.sin(degrees * DK.rad);
  for ( var c = 0; c < this.children.length; c++ ) {
    var newY = this.children[c].y * cosA - this.children[c].z * sinA;
    var newZ = this.children[c].z * cosA + this.children[c].y * sinA;
    this.children[c].y = newY;
    this.children[c].z = newZ;
    this.children[c].rotateX(degrees);
  }
  return this;
}

DepthKit.Container.prototype.rotateY = function ( degrees ) {
  var cosA = Math.cos(degrees * DK.rad);
  var sinA = Math.sin(degrees * DK.rad);
  for ( var c = 0; c < this.children.length; c++ ) {
    var newX = this.children[c].x * cosA - this.children[c].z * sinA;
    var newZ = this.children[c].z * cosA + this.children[c].x * sinA;
    this.children[c].x = newX;
    this.children[c].z = newZ;
    this.children[c].rotateY(degrees);
  }
  return this;
}

DepthKit.Container.prototype.rotateZ = function ( degrees ) {
  var cosA = Math.cos(degrees * DK.rad);
  var sinA = Math.sin(degrees * DK.rad);
  for ( var c = 0; c < this.children.length; c++ ) {
    var newX = this.children[c].x * cosA - this.children[c].y * sinA;
    var newY = this.children[c].y * cosA + this.children[c].x * sinA;
    this.children[c].x = newX;
    this.children[c].y = newY;
    this.children[c].rotateZ(degrees);
  }
  return this;
}

DepthKit.Container.prototype.spinX = function ( degrees ) {
  var cosA = Math.cos(degrees * DK.rad);
  var sinA = Math.sin(degrees * DK.rad);
  for ( var c = 0; c < this.children.length; c++ ) {
    var newY = this.children[c].y * cosA - this.children[c].z * sinA;
    var newZ = this.children[c].z * cosA + this.children[c].y * sinA;
    this.children[c].y = newY;
    this.children[c].z = newZ;
  }
  return this;
}

DepthKit.Container.prototype.spinY = function ( degrees ) {
  var cosA = Math.cos(degrees * DK.rad);
  var sinA = Math.sin(degrees * DK.rad);
  for ( var c = 0; c < this.children.length; c++ ) {
    var newX = this.children[c].x * cosA - this.children[c].z * sinA;
    var newZ = this.children[c].z * cosA + this.children[c].x * sinA;
    this.children[c].x = newX;
    this.children[c].z = newZ;
  }
  return this;
}

DepthKit.Container.prototype.spinZ = function ( degrees ) {
  var cosA = Math.cos(degrees * DK.rad);
  var sinA = Math.sin(degrees * DK.rad);
  for ( var c = 0; c < this.children.length; c++ ) {
    var newX = this.children[c].x * cosA - this.children[c].y * sinA;
    var newY = this.children[c].y * cosA + this.children[c].x * sinA;
    this.children[c].x = newX;
    this.children[c].y = newY;
  }
  return this;
}

DepthKit.Container.prototype.addChild = function ( child ) {
  if ( child.parent === this ) {
    return child;
  }
  if ( child.parent !== undefined ) {
    child.parent.removeChild(child);
  }
  this.children.push(child);
  child.parent = this;
  child.setScene(this.scene);
  return child;
}

DepthKit.Container.prototype.removeChildAt = function ( index ) {
  if ( index >= this.children.length ) {
    return;
  }
  // splice would be nice, but you'll loose the type of the child
  var child = this.children[index];
  while ( index < (this.children.length - 1) ) {
    this.children[index] = this.children[++index];
  }
  this.children.pop();
  child.parent = undefined;
  child.setScene(undefined);
  return child;
}

DepthKit.Container.prototype.removeChild = function ( child ) {
  for ( var c = 0; c < this.children.length; c++ ) {
    if ( this.children[c] === child ) {
      return this.removeChildAt(c);
    }
  }
}

DepthKit.Container.prototype.setScene = function ( scene ) {
  this.scene = scene;
  for ( var c = 0; c < this.children.length; c++ ) {
    this.children[c].setScene(scene);
  }
}

DepthKit.Container.prototype.initM = function () {
  this.mx = this.x;
  this.my = this.y;
  this.mz = this.z;
  for ( var c = 0; c < this.children.length; c++ ) {
    this.children[c].initM();
  } 
}

DepthKit.Container.prototype.rotateM = function () {
  this.rotationMX = (this.rotationX * DK.rad) + this.parent.rotationMX;
  this.rotationMY = (this.rotationY * DK.rad) + this.parent.rotationMY;
  this.rotationMZ = (this.rotationZ * DK.rad) + this.parent.rotationMZ;
  var cosA, sinA, c, newX, newY, newZ;
  if ( this.rotationMX ) {
    cosA = Math.cos(this.rotationMX);
    sinA = Math.sin(this.rotationMX);
    for ( c = 0; c < this.children.length; c++ ) {
      newY = this.children[c].my * cosA - this.children[c].mz * sinA;
      newZ = this.children[c].mz * cosA + this.children[c].my * sinA;
      this.children[c].my = newY;
      this.children[c].mz = newZ;
    }  
  }
  if ( this.rotationMY ) {
    cosA = Math.cos(this.rotationMY);
    sinA = Math.sin(this.rotationMY);
    for ( c = 0; c < this.children.length; c++ ) {
      newX = this.children[c].mx * cosA - this.children[c].mz * sinA;
      newZ = this.children[c].mz * cosA + this.children[c].mx * sinA;
      this.children[c].mx = newX;
      this.children[c].mz = newZ;
    }    
  }
  if ( this.rotationMZ ) {
    cosA = Math.cos(this.rotationMZ);
    sinA = Math.sin(this.rotationMZ);
    for ( c = 0; c < this.children.length; c++ ) {
      newX = this.children[c].mx * cosA - this.children[c].my * sinA;
      newY = this.children[c].my * cosA + this.children[c].mx * sinA;
      this.children[c].mx = newX;
      this.children[c].my = newY;
    }    
  }
  for ( c = 0; c < this.children.length; c++ ) {
    this.children[c].rotateM();
  }  
}

DepthKit.Container.prototype.scaleM = function () {
  
}

DepthKit.Container.prototype.translateM = function () {
  this.mx += this.parent.mx;
  this.my += this.parent.my;
  this.mz += this.parent.mz;
  for ( var c = 0; c < this.children.length; c++ ) {
    this.children[c].translateM();
  }
}

DepthKit.Scene = function () {
  DepthKit.Container.call(this, 0, 0, 0);
  this.meshes = [];
  this.scene = this;
}

DepthKit.Scene.prototype = new DepthKit.Container();
DepthKit.Scene.prototype.constructor = DepthKit.Scene;

DepthKit.Scene.prototype.setScene = function ( scene ) { }

DepthKit.Scene.prototype.initM = function () {
  this.mx = 0;
  this.my = 0;
  this.mz = 0;
  for ( var c = 0; c < this.children.length; c++ ) {
    this.children[c].initM();
  } 
}

DepthKit.Scene.prototype.rotateM = function () {
  this.rotationMX = 0;
  this.rotationMY = 0;
  this.rotationMZ = 0;
  for ( var c = 0; c < this.children.length; c++ ) {
    this.children[c].rotateM();
  }  
}

DepthKit.Scene.prototype.scaleM = function () {
  
}

DepthKit.Scene.prototype.translateM = function () {
  for ( var c = 0; c < this.children.length; c++ ) {
    this.children[c].translateM();
  }
}

DepthKit.Camera = function () {
  // position of the camera
  this.x = 0;
  this.y = 0;
  this.z = -650;
  // rotation of the camera
  this.rotationX = 0;
  this.rotationY = 0;
  this.rotationZ = 0;
  // focal point in 3d coords (viewers position relative to the display surface)
  this.ex = 0;
  this.ey = 0;
  this.ez = 650;
  this.step = undefined;
}

DepthKit.Light = function ( x, y, z, brightness ) {
  this.x = ( x === undefined ) ? -100 : x;
  this.y = ( y === undefined ) ? -100 : y;
  this.z = ( z === undefined ) ? -100 : z;
  this.brightness = ( brightness === undefined ) ? 1 : Math.min(Math.max(brightness, 0), 1);
  this.step = undefined;
}

DepthKit.Light.prototype.setBrightness = function ( b ) {
  this.brightness = Math.min(Math.max(b, 0), 1);
}

DepthKit.Viewport = function () {
  this.canvas = document.createElement('canvas');
  this.context = this.canvas.getContext('2d');
  this.canvas.width = 480;
  this.canvas.height = 320;
  this.vpX = 240;
  this.vpY = 160;
}

DepthKit.Viewport.prototype.fillPage = function ( zIndex ) {
  this.canvas.width = window.innerWidth;
  this.canvas.height = window.innerHeight;
  this.vpX = this.canvas.width / 2;
  this.vpY = this.canvas.height / 2;
  this.canvas.style.position = "absolute";
  this.canvas.style.zIndex = zIndex || "auto";
  document.body.appendChild(this.canvas);
}

DepthKit.Viewport.prototype.fillElement = function ( id, zIndex ) {
  var element = document.getElementById(id);
  this.canvas.width = Number((String(element.style.width)).replace('px', ''));
  this.canvas.height = Number((String(element.style.height)).replace('px', ''));;
  this.vpX = this.canvas.width / 2;
  this.vpY = this.canvas.height / 2;
  this.canvas.style.position = "relative";
  this.canvas.style.zIndex = zIndex || "auto";
  element.appendChild(this.canvas);
}

DepthKit.Viewport.prototype.setBackgroundcolor = function ( color ) {
  this.canvas.style.background = color;
}

DepthKit.Fog = function ( color, depth ) {
  this.depth = depth || 3000;
  this.color = color || "#ffffff"; 
  var nColor = window.parseInt(this.color.slice(1), 16),
      red = nColor >> 16,
      green = nColor >> 8 & 0xff,
      blue = nColor & 0xff;
  this.aColor = "rgba(" + red + ", " + green + ", " + blue + ", 0.20)";
  this.lastZ = this.depth;
}

DepthKit.Fog.prototype.init = function ( viewport ) {
  viewport.context.save();
  viewport.context.fillStyle = this.color;
  viewport.context.fillRect(0,0,viewport.canvas.width, viewport.canvas.height);
  viewport.context.restore();
}

DepthKit.Fog.prototype.update = function ( z, viewport ) {
  viewport.context.save();
  viewport.context.fillStyle = this.aColor;
  for ( this.lastZ = this.lastZ; (this.lastZ > z && this.lastZ > 0); this.lastZ -= this.depth/20 ) {
    viewport.context.fillRect(0,0,viewport.canvas.width, viewport.canvas.height);
  }
  viewport.context.restore();
}

DepthKit.Fog.prototype.finish = function ( viewport ) {
  this.update(0, viewport);
  this.lastZ = this.depth;
}

DepthKit.Renderer = function ( viewport, scene, camera ) {
  this.scene = scene || new DeptKit.Scene();
  this.camera = camera || new DepthKit.Camera();
  this.viewport = viewport || new DepthKit.Viewport();
  this.fog = undefined;
}

DepthKit.Renderer.prototype.render = function () {
  // create global 'shadow'-vertices
  this.scene.initM();
  this.scene.rotateM();
  //this.scene.scaleM();
  this.scene.translateM();
  // projection
  // http://en.wikipedia.org/wiki/3D_projection
  var cosX = Math.cos(this.camera.rotationX * DK.rad);
  var sinX = Math.sin(this.camera.rotationX * DK.rad);
  var cosY = Math.cos(this.camera.rotationY * DK.rad);
  var sinY = Math.sin(this.camera.rotationY * DK.rad);
  var cosZ = Math.cos(this.camera.rotationZ * DK.rad);
  var sinZ = Math.sin(this.camera.rotationZ * DK.rad);
  for ( var m = 0; m < this.scene.meshes.length; m++ ) {
    this.scene.meshes[m].d = 0xffffff;
    for ( var v = 0; v < this.scene.meshes[m].vertices.length; v++ ) {
      var oldX = this.scene.meshes[m].vertices[v].mx - this.camera.x;
      var oldY = this.scene.meshes[m].vertices[v].my - this.camera.y;
      var oldZ = this.scene.meshes[m].vertices[v].mz - this.camera.z;
      var partA = sinZ * oldY + cosZ * oldX;
      var partB = cosY * oldZ + sinY * partA;
      var partC = cosZ * oldY - sinZ * oldX;
      var newX = cosY * partA - sinY * oldZ;
      var newY = sinX * partB + cosX * partC;
      var newZ = cosX * partB - sinX * partC;
      this.scene.meshes[m].vertices[v].px = this.viewport.vpX + (newX - this.camera.ex) * (this.camera.ez / newZ);
      this.scene.meshes[m].vertices[v].py = this.viewport.vpY + (newY - this.camera.ey) * (this.camera.ez / newZ);
      this.scene.meshes[m].vertices[v].pz = newZ;
      // Euler distance for sorting
      this.scene.meshes[m].vertices[v].d = Math.sqrt(oldX * oldX + oldY * oldY + oldZ * oldZ);
      this.scene.meshes[m].d = Math.min(this.scene.meshes[m].d, this.scene.meshes[m].vertices[v].d);
    }
  }
  this.scene.meshes.sort(DK.meshSort);
  if ( this.fog !== undefined ) {
    // fog
    this.fog.init(this.viewport);
    for ( m = 0; m < this.scene.meshes.length; m++ ) {
      if (this.scene.meshes[m].d < this.fog.depth) {
        this.fog.update(this.scene.meshes[m].d, this.viewport);
        this.scene.meshes[m].draw(this.viewport.context);
      }
    }
    this.fog.finish(this.viewport);
  } else {
    // no fog
    for ( m = 0; m < this.scene.meshes.length; m++ ) {
      this.scene.meshes[m].draw(this.viewport.context);
    }    
  }
}
 
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (window.webkitRequestAnimationFrame ||
                                  window.mozRequestAnimationFrame ||
                                  window.msRequestAnimationFrame ||
                                  window.oRequestAnimationFrame ||
                                  function (callback) {
                                    return window.setTimeout(callback, 17);
                                  });
}

if (!window.cancelRequestAnimationFrame) {
  window.cancelRequestAnimationFrame = (window.cancelAnimationFrame ||
                                        window.webkitCancelRequestAnimationFrame ||
                                        window.mozCancelRequestAnimationFrame ||
                                        window.msCancelRequestAnimationFrame ||
                                        window.oCancelRequestAnimationFrame ||
                                        window.clearTimeout);
}

DepthKit.startTime = new Date().getTime();
DepthKit.getTimer = function () {
  return (new Date().getTime() - DepthKit.startTime);
}

DepthKit.key = {};

DepthKit.key.startCapturing = function () {
  // captures arrow-keys, x, c and spacebar
  // down is down untill up, pressed is like 'just pressed' and is intended to last only till the end of a frame 
  DepthKit.key.down = {UP: false, DOWN: false, LEFT: false, RIGHT: false, X: false, C: false, SPACE: false};
  DepthKit.key.pressed = {UP: false, DOWN: false, LEFT: false, RIGHT: false, X: false, C: false, SPACE: false};
  // create a function to quickly unset the pressed
  // needs to be called at the end of a frame of Engine.js
  DepthKit.key.unsetPressed = function () {
    DepthKit.key.pressed.UP = false;
    DepthKit.key.pressed.DOWN = false;
    DepthKit.key.pressed.LEFT = false;
    DepthKit.key.pressed.RIGHT = false;
    DepthKit.key.pressed.X = false;
    DepthKit.key.pressed.C = false;
    DepthKit.key.pressed.SPACE = false;
  }
  // create two references to functions that handle key up and down
  DepthKit.key.onKD = function (e) {
    switch (e.keyCode) {           
      case 38:
        if(!DepthKit.key.down.UP){
          DepthKit.key.pressed.UP = true;
          DepthKit.key.down.UP = true;
        }
        break;
      case 40:
        if(!DepthKit.key.down.DOWN){
          DepthKit.key.pressed.DOWN = true;
          DepthKit.key.down.DOWN = true;
        }
        break;
      case 37:
        if(!DepthKit.key.down.LEFT){
          DepthKit.key.pressed.LEFT = true;
          DepthKit.key.down.LEFT = true;
        }
        break;
      case 39:
        if(!DepthKit.key.down.RIGHT){
          DepthKit.key.pressed.RIGHT = true;
          DepthKit.key.down.RIGHT = true;
        }
        break;
      case 88:
        DepthKit.key.down.X = true;
        if(!DepthKit.key.down.X){
          DepthKit.key.pressed.X = true;
          DepthKit.key.down.X = true;
        }
        break;
      case 67:
        if(!DepthKit.key.down.C){
          DepthKit.key.pressed.C = true;
          DepthKit.key.down.C = true;
        }
        break;
      case 32:
        if(!DepthKit.key.down.SPACE){
          DepthKit.key.pressed.SPACE = true;
          DepthKit.key.down.SPACE = true;
        }
        break;
    }
  }
  DepthKit.key.onKU = function (e) {
    switch (e.keyCode) {           
      case 38:
        DepthKit.key.down.UP = false;
        break;
      case 40:
        DepthKit.key.down.DOWN = false;
        break;
      case 37:
        DepthKit.key.down.LEFT = false;
        break;
      case 39:
        DepthKit.key.down.RIGHT = false;
        break;
      case 88:
        DepthKit.key.down.X = false;
        break;
      case 67:
        DepthKit.key.down.C = false;
        break;
      case 32:
        DepthKit.key.down.SPACE = false;
        break;
    }
  } 
  // add those as listeners to the window
  window.addEventListener('keydown', DepthKit.key.onKD, false);
  window.addEventListener('keyup', DepthKit.key.onKU, false);
  // add a function to stop capturing
  DepthKit.key.stopCapturing = function () { 
    window.removeEventListener('keydown', DepthKit.key.onKD, false);
    window.removeEventListener('keyup', DepthKit.key.onKU, false);
    delete DepthKit.key.down;
    delete DepthKit.key.pressed;
    delete DepthKit.key.unsetPressed;
    delete DepthKit.key.onKD;
    delete DepthKit.key.onKU;
  }
}

DepthKit.mouse = {};

DepthKit.mouse.attachTo = function (viewport) {
  var mouse = {x: 0, y: 0, event: null};
  viewport.mousemove = function (e) {
    var x, y;
    if (e.pageX || e.pageY) {
      x = e.pageX;
      y = e.pageY;
    } else {
      x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
      y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }
    x -= viewport.canvas.offsetLeft;
    y -= viewport.canvas.offsetTop;
    mouse.x = x;
    mouse.y = y;
    mouse.event = e;
  };
  viewport.canvas.addEventListener('mousemove', viewport.mousemove, false);
  viewport.touchmove = function (e) {
    e.preventDefault();
    var x, y;
    if (e.touches[0].pageX || e.touches[0].pageY) {
      x = e.touches[0].pageX;
      y = e.touches[0].pageY;
    } else {
      x = e.touches[0].clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
      y = e.touches[0].clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }
    x -= viewport.canvas.offsetLeft;
    y -= viewport.canvas.offsetTop;
    mouse.x = x;
    mouse.y = y;
    mouse.event = e;
  };
  viewport.canvas.addEventListener('touchmove', viewport.touchmove, false);
  viewport.mouse = mouse;
}

DepthKit.mouse.detachFrom = function (viewport) {
  viewport.canvas.removeEventListener('mousemove', viewport.mousemove, false);
  viewport.canvas.removeEventListener('touchmove', viewport.touchmove, false);
  delete viewport.mouse;
  delete viewport.mousemove;
  delete viewport.touchmove;
}

DepthKit.Engine = function () {
  this.scene = new DepthKit.Scene();
  this.camera = new DepthKit.Camera();
  this.light = new DepthKit.Light();
  this.viewport = new DepthKit.Viewport();
  this.renderer = new DepthKit.Renderer(this.viewport, this.scene, this.camera);
  var frameID = 0;
  this.time = DepthKit.getTimer();
  this.elapsed = DepthKit.getTimer() - this.time;
  this.paintMode = false;
}

DepthKit.Engine.prototype.step = function ( sceneObject ) {
  if ( sceneObject.children !== undefined ) {
    for ( var c = 0; c < sceneObject.children.length; c++ ) {
      this.step(sceneObject.children[c]);
    }
  }
  if ( sceneObject.step !== undefined && typeof sceneObject.step === 'function') {
    sceneObject.step();
  }
}

DepthKit.Engine.prototype.start = function () {
  this.time = DepthKit.getTimer();
  this.elapsed = DepthKit.getTimer() - this.time;
  var self = this;
  (function onF () {
    // update timers
    frameID = window.requestAnimationFrame(onF, self.viewport.canvas);
    self.elapsed = DepthKit.getTimer() - self.time;
    self.time = DepthKit.getTimer();
    // clear canvas or not
    if (!self.paintMode) {
      self.viewport.context.clearRect(0, 0, self.viewport.canvas.width, self.viewport.canvas.height);
    }
    // animate things
    self.step(self.scene);
    self.step(self.light);
    self.step(self.camera);
    // translate everything and draw it
    self.renderer.render();
    // unset pressed keys
    if ( DepthKit.key.pressed !== undefined ) {
      DepthKit.key.unsetPressed();
    }    
  }());
}

DepthKit.Engine.prototype.stop = function () {
  window.cancelRequestAnimationFrame(frameID);
}

DepthKit.Cube = function () {
  DepthKit.Mesh.call(this, 0, 0, 0);
  var sizeX, sizeY, sizeZ;
  switch (arguments.length) {
    case 1:
      sizeX = sizeY = sizeZ = arguments[0] / 2;
      break;
    case 2:
      sizeX = sizeZ = arguments[0] / 2;
      sizeY = arguments[1] / 2;
      break;
    case 3:
      sizeX = arguments[0] / 2;
      sizeY = arguments[1] / 2;
      sizeZ = arguments[2] / 2;
      break;
    default:
      sizeX = sizeY = sizeZ = 50;
  }
  this.addVertex(-sizeX,  sizeY, -sizeZ); //0 // front left bottom
  this.addVertex( sizeX,  sizeY, -sizeZ); //1 // front right bottom
  this.addVertex( sizeX, -sizeY, -sizeZ); //2 // front right top
  this.addVertex(-sizeX, -sizeY, -sizeZ); //3 // front left top
  this.addVertex(-sizeX,  sizeY,  sizeZ); //4 // back left bottom
  this.addVertex( sizeX,  sizeY,  sizeZ); //5 // back right bottom
  this.addVertex( sizeX, -sizeY,  sizeZ); //6 // back right top
  this.addVertex(-sizeX, -sizeY,  sizeZ); //7 // back left top
  this.addFace(this.vertices[1], this.vertices[5], this.vertices[4], "#ff0000"); // bottom
  this.addFace(this.vertices[0], this.vertices[1], this.vertices[4], "#ff0000");
  this.addFace(this.vertices[6], this.vertices[2], this.vertices[3], "#00ff00"); // top
  this.addFace(this.vertices[7], this.vertices[6], this.vertices[3], "#00ff00");
  this.addFace(this.vertices[3], this.vertices[0], this.vertices[4], "#0000ff"); // left
  this.addFace(this.vertices[7], this.vertices[3], this.vertices[4], "#0000ff");
  this.addFace(this.vertices[2], this.vertices[5], this.vertices[1], "#ffff00"); // right
  this.addFace(this.vertices[6], this.vertices[5], this.vertices[2], "#ffff00");
  this.addFace(this.vertices[6], this.vertices[4], this.vertices[5], "#00ffff"); // back
  this.addFace(this.vertices[6], this.vertices[7], this.vertices[4], "#00ffff");
  this.addFace(this.vertices[2], this.vertices[1], this.vertices[0], "#ff00ff"); // front
  this.addFace(this.vertices[3], this.vertices[2], this.vertices[0], "#ff00ff");
}

DepthKit.Cube.prototype = new DepthKit.Mesh();
DepthKit.Cube.prototype.constructor = DepthKit.Cube;

DepthKit.ObjModel = function ( ) {
  DepthKit.Mesh.call(this, 0, 0, 0);
  this.scale = 1;
}

DepthKit.ObjModel.prototype = new DepthKit.Mesh();
DepthKit.ObjModel.prototype.constructor = DepthKit.ObjModel;

DepthKit.ObjModel.prototype.parseFile = function ( file, scale ) {
  if ( file !== undefined ) {
    this.scale = scale || 100;
    var self = this;
    var objFile = new XMLHttpRequest();
    objFile.open("GET", file, true);
    objFile.onreadystatechange = function () {
      if (objFile.readyState === 4 && objFile.status === 200) {
        var content = objFile.responseText;
        var lines = content.split("\n");
        for ( var i = 0; i < lines.length; i++) {
          var symbols = lines[i].split(" ");
          if (symbols[0] === "v") {
            self.addVertex(symbols[1] * self.scale, symbols[2] * self.scale, symbols[3] * self.scale);
          } else if (symbols[0] === "f") {
            self.addFace(self.vertices[(symbols[3].split("/")[0] - 1)], self.vertices[(symbols[2].split("/")[0] - 1)], self.vertices[(symbols[1].split("/")[0] - 1)]);
          }
        }
        self.onParsed();
      }
    }
    objFile.send(null);
  } 
}

DepthKit.ObjModel.prototype.onParsed = function () { }

