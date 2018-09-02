function setup() {
  offscreenCanvas = document.createElement("canvas");
  generate();
}

function generate() {
  const entryCount = document.getElementById("entry_count");
  
  const entries = Number(entryCount.value === "" ? 4 : entryCount.value);
  const sqrtEntries = Math.sqrt(entries);
  const w = sqrtEntries * 12.5;
  const h = sqrtEntries * 12.5;
  size = new Vector(w, h);
  graph = [];
  const sparseZones = [];
  for (let i = 0; i < entries * 6; i++) {
    const zone = new SparseZone(new Vector(random(w), random(h)), random(8, 2), random(1, 0.25));
    sparseZones.push(zone);
  }
  console.log(sparseZones);
  const start = performance.now();
  while (graph.length < entries * 300) {
    const node = new GraphNode(random(w), random(h));
    const cancelChance = sparseZones.reduce((total, zone) => {
      const str = zone.localStrength(node, size);
      if (str > 0 && total < 1) {
        return total + (1 - total) * str;
      }
      return total;
    }, 0);
    if (roll(cancelChance)) {
      continue;
    }
    graph.push(node);
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        const v = node.plus(new Vector(x * w, y * h));
      }
    }
  }
  let connections = 0;
  let neighbors = 0;
  const neighborCounts = new Array(graph.length).fill(0);
  for (let i = 0; i < graph.length; i++) {
    const n1 = graph[i];
    for (let j = i + 1; j < graph.length; j++) {
      const n2 = graph[j];
      const d = wrapDistance(n1, n2, size);
      if (d < 1) {
        neighbors += 2;
        neighborCounts[i]++;
        neighborCounts[j]++;
        
        if (roll(Math.pow(d, 2) * (4 / (4 + n1.connected.length + n2.connected.length)))) {
          connections++;
          n1.connect(n2);
        }
      }
    }
  }
  console.log("Took", performance.now() - start, "ms");
  console.log("Connections formed: ", connections);
  console.log("Most connections: ", Math.max(...graph.map(n => n.connected.length)));
  console.log("Average neighbors: ", neighbors / graph.length);
  const sortedNeighborCounts = neighborCounts.slice().sort((a, b) => a - b);
  console.log("Median neighbors: ", sortedNeighborCounts[graph.length / 2]);
  console.log("Most neighbors: ", sortedNeighborCounts[graph.length - 1]);
  const groups = [];
  for (let i = 0; i < graph.length; i++) {
    const group = [];
    const fillStack = [graph[i]];
    while (fillStack.length) {
      const f = fillStack.pop();
      if (f.assignedGroup === undefined) {
        group.push(f);
        f.assignedGroup = groups.length;
        for (let j = 0; j < f.connected.length; j++) {
          fillStack.push(f.connected[j]);
        }
      }
    }
    if (group.length) {
      groups.push(group);
    }
  }
  console.log("Groups: ", groups.sort((a, b) => b.length - a.length));
  console.log(graph);
  draw();
}

function draw() {
  const canvas = document.getElementById("canvas");
  const redrawButton = document.getElementById("redraw_button");
  const entryCount = document.getElementById("entry_count");
  const renderType = document.getElementById("render_type");
  const zoomExponent = document.getElementById("zoom_exponent");
  
  const scale = Math.pow(2, Number(zoomExponent.value));
  
  offscreenCanvas.width = size.x * scale;
  offscreenCanvas.height = size.y * scale;
  const ctx = offscreenCanvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.scale(scale, scale);
  const invS = 1 / scale;
  ctx.lineWidth = invS;
  
  ctx.beginPath();
  for (let i = 0; i < graph.length; i++) {
    const v1 = graph[i];
    ctx.fillRect(v1.x, v1.y, invS, invS);
    for (let j = 0; j < v1.connected.length; j++) { // FIXME: Draws a two-way line when not on the edges
      const v2 = wrapClosest(v1, v1.connected[j], size);
      ctx.moveTo(v1.x, v1.y);
      ctx.lineTo(v2.x, v2.y);
    }
  }
  ctx.stroke();
  
  if (renderType.value === "tiled") {
    canvas.width = offscreenCanvas.width * 3;
    canvas.height = offscreenCanvas.height * 3;
  } else {
    canvas.width = offscreenCanvas.width;
    canvas.height = offscreenCanvas.height;
  }
  const vctx = canvas.getContext("2d");
  const pattern = vctx.createPattern(offscreenCanvas, "repeat");
  vctx.fillStyle = pattern;
  vctx.fillRect(0, 0, canvas.width, canvas.height);
  redrawButton.style.cssText = `width: ${canvas.width + 2}px`;
  entryCount.style.cssText = `width: ${canvas.width - 2}px`;
  renderType.style.cssText = `width: ${canvas.width + 2}px`;
  zoomExponent.style.cssText = `width: ${canvas.width}px`;
}

class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  
  plus(v) {
    return new Vector(this.x + v.x, this.y + v.y);
  }
  minus(v) {
    return new Vector(this.x - v.x, this.y - v.y);
  }
  
  lengthSquared() {
    return this.x * this.x + this.y * this.y
  }
  length() {
    return Math.sqrt(this.lengthSquared());
  }
}

class GraphNode extends Vector {
  constructor(x, y) {
    super(x, y);
    this.connected = [];
  }
  
  connect(node) {
    this.connected.push(node);
    node.connected.push(this);
  }
}

class SparseZone {
  constructor(center, radius, strength) {
    this.center = center;
    this.radius = radius;
    this.strength = strength;
  }
  
  localStrength(position, size) {
    return this.strength - (wrapDistance(position, this.center, size) * (this.strength / this.radius));
  }
}

function distanceSquared(a, b) {
  return b.minus(a).lengthSquared();
}
function distance(a, b) {
  return Math.sqrt(distanceSquared(a, b));
}
function wrapClosest(origin, target, size) {
  let dist = Infinity;
  let best;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      const v = target.plus(new Vector(x * size.x, y * size.y));
      const d = distanceSquared(v, origin);
      if (d < dist) {
        dist = d;
        best = v;
      }
    }
  }
  return best;
}
function wrapDistanceSquared(a, b, size) { // TODO: Optimize  
  let dist = Infinity;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      const v = a.plus(new Vector(x * size.x, y * size.y));
      dist = Math.min(distanceSquared(v, b), dist);
    }
  }
  return dist;
}
function wrapDistance(a, b, size) {
  return Math.sqrt(wrapDistanceSquared(a, b, size));
}

function roll(chance) {
  return Math.random() < chance;
}
function random(max = 1, min = 0) {
  return Math.random() * (max - min) + min;
}
function randomInt(max, min = 0) {
  return Math.floor(random(max, min));
}