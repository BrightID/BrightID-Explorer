function drawGraph() {
  const cooldownTime = $("#cooldownTime").val() * 1000;
  const levelIndex = $("#levelsRange").val();
  updateGraphData(levelIndex);
  const predefinedPosition = $("#predefinedPosition").is(":checked");
  if ($("#3dBtn").is(":checked")) {
    setPosition(predefinedPosition ? '3d' : 'noPositions');
    drawGraph3d({ nodes: Object.values(graphNodes), links: graphLinks }, cooldownTime, false);
  } else {
    const positions = predefinedPosition ? '2d' : 'noPositions'
    setPosition(positions);
    drawGraph2d({ nodes: Object.values(graphNodes), links: graphLinks }, cooldownTime, false);
  }
}

function drawSubgraph(subgraphNodes, subgraphLinks) {
  const cooldownTime = 10000;
  setPosition('noPositions');
  if ($("#3dBtn").is(":checked")) {
    drawGraph3d({ nodes: subgraphNodes, links: subgraphLinks }, cooldownTime, true);
  } else {
    drawGraph2d({ nodes: subgraphNodes, links: subgraphLinks }, cooldownTime, true);
  }
}

function setPosition(type) {
  if (type == "noPositions") {
    if (positions['status'] != 'noPosition') {
      for (let n of Object.values(graphNodes)) {
        delete n.x;
        delete n.y;
        delete n.z;
        delete n.fx;
        delete n.fy;
        delete n.fz;
      }
      positions['status'] = 'noPosition';
    }
  } else if (type == '2d') {
    if (positions['status'] != '2d') {
      for (let n of Object.values(graphNodes)) {
        if (n.id in positions['2d']) {
          n.fx = positions['2d'][n.id].x;
          n.fy = positions['2d'][n.id].y;
        }
      }
      positions['status'] = '2d';
    }
  } else if (type == '3d') {
    if (positions['status'] != '3d') {
      for (let n of Object.values(graphNodes)) {
        if (n.id in positions['3d']) {
          n.fx = positions['3d'][n.id].x;
          n.fy = positions['3d'][n.id].y;
          n.fz = positions['3d'][n.id].z;
        }
      }
      positions['status'] = '3d';
    }
  }
}

function updateGraphData(index) {
  graphNodes = {};
  graphLinks = [];
  const connectionLevels = ["suspicious", "just met", "filtered", "already known", "recovery"];
  selectedLevels = connectionLevels.slice(index, 5);

  Object.values(allLinks).forEach(l => {
    if (!(selectedLevels.includes(l.level))) {
      return;
    }

    const s = l.source?.id || l.source;
    const t = l.target?.id || l.target
    const otherSideLevel = allLinks[`${t}${s}`]?.level;
    if (!selectedLevels.includes("just met")) {
      if (!(selectedLevels.includes(otherSideLevel))) {
        return;
      }
    }

    graphLinks.push(l);
    if (!(s in graphNodes)) {
      graphNodes[s] = allNodes[s];
    }
    if (!(t in graphNodes)) {
      graphNodes[t] = allNodes[t];
    }
  });
  updateStatistics();
}

function drawGraph2d(data, cooldownTime, subgraph) {
  // to fix an issue
  for (let l of data.links) {
    if (!l.__indexColor) {
      l.__indexColor = resetLinksColor(l);
    }
  }

  $("#graphDiv").empty();
  const elem = document.getElementById("graphDiv");
  Graph = ForceGraph()(elem)
    .cooldownTime(cooldownTime)
    .enableNodeDrag(false)
    .linkColor(resetLinksColor)
    .nodeColor(resetNodesColor)
    .graphData(data)
    .nodeId("id")
    .nodeVal("size")
    .nodeLabel("id")
    .linkWidth(linkWidth)
    .linkSource("source")
    .linkTarget("target")
    .onNodeClick((node) => {
      if (!node.selected) {
        selectNode(node, true, false);
      }
    })
    .linkVisibility((link) => subgraph ? true : false)
    .onBackgroundClick((evt) => {
      if (evt.ctrlKey) {
        const p = Graph.screen2GraphCoords(evt.layerX, evt.layerY);
        var rect = document.getElementById('graphDiv').getBoundingClientRect();
        drawCoordinates(p.x, p.y, 5 / (Graph.zoom() ** .5));
        areaPoints.push([p.x, p.y]);
        return;
      }

      for (const id in graphNodes) {
        graphNodes[id].selected = false;
      }
      selectedNode = undefined;
      Graph.linkWidth(linkWidth)
        .nodeColor(resetNodesColor)
        .linkColor(resetLinksColor)
        .linkDirectionalArrowLength(6);
    })
    .nodeCanvasObjectMode(() => "after")
    .linkDirectionalArrowLength(arrowLength)
    .nodeCanvasObject((n, ctx) => {
      const size = 30;
      if (n.img) {
        ctx.lineWidth = 5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, size / 2, 0, Math.PI * 2, true);
        ctx.clip();
        ctx.strokeStyle = resetNodesColor(n);
        try {
          ctx.drawImage(n.img, n.x - size / 2, n.y - size / 2, size, size);
        } catch (err) {
          console.log("Error in drawImage: ", err)
        }
        ctx.stroke();
        ctx.restore();
      }
    })
    .onEngineStop(async () => {
      if ((await localforage.getItem("explorer_backup_data")) && !autoLoginDone) {
        loadInfo();
      }
    });
}

function drawGraph3d(data, cooldownTime, subgraph) {
  $("#graphDiv").empty();
  const elem = document.getElementById("graphDiv");
  Graph = ForceGraph3D()(elem)
    .cooldownTime(cooldownTime)
    .enableNodeDrag(false)
    .linkColor(resetLinksColor)
    .nodeColor(resetNodesColor)
    .graphData(data)
    .nodeOpacity(1)
    .nodeLabel(n => n.id)
    .nodeId("id")
    .nodeVal("size")
    .linkWidth(linkWidth)
    .linkSource("source")
    .linkTarget("target")
    .onNodeClick((node) => {
      if (!node.selected) {
        selectNode(node, true, false);
      }
    })
    .linkVisibility((link) => subgraph ? true : false)
    .onBackgroundClick(() => {
      for (const id in graphNodes) {
        graphNodes[id].selected = false;
      }
      selectedNode = undefined;
      Graph.linkWidth(linkWidth)
        .nodeColor(resetNodesColor)
        .linkColor(resetLinksColor)
        .linkDirectionalArrowLength(6);
    })
    .linkDirectionalArrowLength(arrowLength)
}

async function logPositions2d(type) {
  if (type == 'a') {
    updateGraphData(3);
    setPosition('noPositions');
  } else if (type == 'j') {
    updateGraphData(1);
    setPosition('2d');
  } else {
    console.log('type should be a (already Known) or j (just met)');
    return;
  }
  for (let i = 0; i <= 6; i++) {
    draw(i);
  }
  function draw(i) {
    setTimeout(function () {
      if (i == 6) {
        const pos = {};
        Object.values(graphNodes).forEach(node => {
          if (!('x' in node) || !('y' in node)) {
            return;
          }
          if (Date.now() - 10 * 24 * 60 * 60 * 1000 > node.createdAt) {
            pos[node.id] = { x: node.x, y: node.y };
          }
        });
        console.log(`nodes: ${Object.keys(pos).length}`);
        console.log(pos);
      } else {
        console.log(`setPositions2d ${i}`);
        drawGraph2d({ nodes: Object.values(graphNodes), links: graphLinks }, 100000, false);
      }
    }, 110000 * i);
  }
}

function logPositions3d() {
  const pos = {};
  Object.values(graphNodes).forEach(node => {
    if (!('x' in node) || !('y' in node) || !('z' in node)) {
      return;
    }
    if (Date.now() - 10 * 24 * 60 * 60 * 1000 > node.createdAt) {
      pos[node.id] = { x: node.x, y: node.y, z: node.z };
    }
  });
  console.log(`nodes: ${Object.keys(pos).length}`);
  console.log(pos);
}

function rotate(degree) {
  let maxX = 0;
  let minX = 0;
  let maxY = 0;
  let minY = 0;
  Object.values(graphNodes).forEach(node => {
    if (maxX < node.x) maxX = node.x;
    if (minX > node.x) minX = node.x;
    if (maxY < node.y) maxY = node.y;
    if (minY < node.y) minY = node.y;
  });
  const cX = (maxX - minX) / 2;
  const cY = (maxY - minY) / 2;
  const r = degree * (Math.PI / 180);
  Object.values(graphNodes).forEach(node => {
    const newX = (node.x - cX) * Math.cos(r) - (node.y - cY) * Math.sin(r) + cX;
    const newY = (node.x - cX) * Math.sin(r) + (node.y - cY) * Math.cos(r) + cY;
    node.fx = newX;
    node.fy = newY;
  });
  drawGraph2d({ nodes: Object.values(graphNodes), links: graphLinks }, false);
}