function drawGraph() {
  const cooldownTime = $("#cooldownTime").val() * 1000;
  const levelIndex = $("#levelsRange").val();
  const linkVisibility = $("#linkVisibility").is(":checked") && levelIndex > 2;
  if ($("#linkVisibility").is(":checked") && levelIndex <= 2) {
    $("#linkVisibility").prop("checked", false);
    alert("You can't see the edges in this level");
  }
  updateGraphData(levelIndex);
  updateLegend(levelIndex);
  const predefinedPosition = $("#predefinedPosition").is(":checked");
  if ($("#3dBtn").is(":checked")) {
    setPosition(predefinedPosition ? "3d" : "noPositions");
    drawGraph3d({ nodes: Object.values(graphNodes), links: graphLinks }, cooldownTime, linkVisibility);
  } else {
    const positions = predefinedPosition ? "2d" : "noPositions";
    setPosition(positions, levelIndex);
    drawGraph2d({ nodes: Object.values(graphNodes), links: graphLinks }, cooldownTime, linkVisibility);
    Graph.zoom(0, 2000);
  }
}

function drawSubgraph(nodes, links) {
  const cooldownTime = 10000;
  setPosition("noPositions");
  if ($("#3dBtn").is(":checked")) {
    drawGraph3d({ nodes, links }, cooldownTime, true);
  } else {
    drawGraph2d({ nodes, links }, cooldownTime, true);
  }
}

function drawCoordinates(x, y, size) {
  var canvas = document.getElementsByTagName("canvas")[0];
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ff2626"; // Red color
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2, true);
  ctx.fill();
}

function inside(point, vs) {
  var x = point[0], y = point[1];
  var inside = false;
  for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    var xi = vs[i][0], yi = vs[i][1];
    var xj = vs[j][0], yj = vs[j][1];
    var intersect = ((yi > y) != (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function resetLinksColor(link) {
  const colors = { "recovery": "blue", "already known": "orange", "just met": "yellow", "suspicious": "red", "reported": "red", "filtered": "gray" };
  const level = link["history"][link["history"].length - 1][1];
  return (level in colors) ? colors[level] : "black";
}

colors = ["#332288", "#117733", "#44AA99", "#88CCEE", "#DDCC77", "#CC6677", "#AA4499", "#882255", "#000000", "#F1FF09"]
function resetNodesColor(n, fade = false, clusters = false) {
  let color;
  if (clusters) {
    if (n.cluster == "") color = fadedColor;
    else color = colors[n.cluster.replace(/^.*\D+/g, "") % colors.length];
  } else if (bituVerifieds.length != 0) {
    if (fade) color = fadedColor;
    else if (n.selected) color = "red";
    else if (n.hasBitu) color = "blue";
    else color = "orange";
    n.color = color;
  } else {
    if (fade) color = fadedColor;
    else if (n.selected) color = "red";
    else if (selectedVerification == "Bitu" && n.verifications && selectedVerification in n.verifications && n.verifications.Bitu.score > 0) color = "blue";
    else if (selectedVerification != "Bitu" && n.verifications && selectedVerification in n.verifications) color = "blue";
    else color = "orange";
    n.color = color;
  }
  return color;
}

function resetNodesVal(n, clusters = false) {
  let val;
  if (clusters) {
    if (n.cluster == "") val = 1;
    else val = (n.cluster.replace(/^.*\D+/g, "") % 10) * 10;
  } else if (bituVerifieds.length != 0) {
    if (boldMood == 0) {
      val = Math.min(Math.max(n.verifications?.Bitu?.score || 1, 3), 20) ** .5;
    } else if (boldMood == 1) {
      val = n.hasBitu ? 20 : 1;
    } else if (boldMood == 2) {
      val = n.hasBitu ? 1 : 20;
    }
  } else {
    if (selectedVerification == "Bitu") {
      val = Math.min(Math.max(n.verifications?.Bitu?.score || 1, 3), 20) ** .5;
    } else if (selectedVerification == "Seed") {
      val = ("Seed" in n.verifications ? 20 : 3) ** .5;
    } else if (selectedVerification == "SeedConnected") {
      val = Math.min(Math.max(n.verifications?.SeedConnected?.rank || 1, 3), 20) ** .5;
    } else if (selectedVerification == "SocialRecoverySetup") {
      val = ("SocialRecoverySetup" in n.verifications ? 20 : 3) ** .5;
    }
  }
  return val;
}

function move(x, y, z) {
  if (mode3D) {
    const distance = 40;
    const distRatio = 1 + distance / Math.hypot(x, y, z);

    Graph.cameraPosition({ x: x * distRatio, y: y * distRatio, z: z * distRatio }, { x, y, z }, // lookAt ({ x, y, z })
      3000 // ms transition duration
    );

  } else {
    Graph.centerAt(x + 200, y);
    Graph.zoom(z, 2000);
  }
}

function setPosition(type, levelIndex) {
  for (let n of Object.values(graphNodes)) {
    delete n.fx;
    delete n.fy;
    delete n.fz;
  }

  if (type == "noPositions") {
    if (positions["status"] != "noPosition") {
      for (let n of Object.values(graphNodes)) {
        delete n.x;
        delete n.y;
        delete n.z;
      }
      positions["status"] = "noPosition";
    }
  } else if (type == "2d") {
    if (levelIndex && levelIndex < 3) {
      updateGraphData(3);
      for (let n of Object.values(graphNodes)) {
        if (n.id in positions["2d"]) {
          n.fx = positions["2d"][n.id].x;
          n.fy = positions["2d"][n.id].y;
        }
      }
      updateGraphData(levelIndex);
    }
    for (let n of Object.values(graphNodes)) {
      if (n.id in positions["2d"]) {
        n.x = positions["2d"][n.id].x;
        n.y = positions["2d"][n.id].y;
      }
    }
    positions["status"] = "2d";
  } else if (type == "3d") {
    if (positions["status"] != "3d") {
      for (let n of Object.values(graphNodes)) {
        if (n.id in positions["3d"]) {
          n.x = positions["3d"][n.id].x;
          n.y = positions["3d"][n.id].y;
          n.z = positions["3d"][n.id].z;
        }
      }
      positions["status"] = "3d";
    }
  }
}

function updateGraphData(index) {
  graphNodes = {};
  graphLinks = [];
  const connectionLevels = ["suspicious", "just met", "filtered", "already known", "recovery"];
  selectedLevels = connectionLevels.slice(index, 5);

  Object.values(allLinks).forEach(l => {
    const timestamp = l["history"][l["history"].length - 1][0];
    const level = l["history"][l["history"].length - 1][1];

    if (!(selectedLevels.includes(level))) {
      return;
    }

    const s = l.source?.id || l.source;
    const t = l.target?.id || l.target;
    const otherSideLevel = allLinks[`${t}${s}`]?.history[allLinks[`${t}${s}`]["history"].length - 1][1];
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
}

function drawGraph2d(data, cooldownTime, linkVisibility) {
  // to fix an issue
  for (let l of data.links) {
    if (!l.__indexColor) {
      l.__indexColor = resetLinksColor(l);
    }
  }

  $("#graphDiv").empty();
  const elem = document.getElementById("graphDiv");
  Graph = ForceGraph()(elem)
    .minZoom(0.009)
    .linkVisibility(false)
    .cooldownTime(cooldownTime)
    .enableNodeDrag(false)
    .nodeColor(resetNodesColor)
    .graphData(data)
    .nodeId("id")
    .nodeVal(resetNodesVal)
    .nodeLabel("id")
    .linkSource("source")
    .linkTarget("target")
    .onNodeClick((node) => {
      if (!node.selected) {
        selectNode(node, true, false);
      }
    })
    .onBackgroundClick((evt) => {
      if (evt.ctrlKey) {
        const p = Graph.screen2GraphCoords(evt.layerX, evt.layerY);
        var rect = document.getElementById("graphDiv").getBoundingClientRect();
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
        .linkDirectionalArrowLength(arrowLength);
    })
    .nodeCanvasObjectMode(() => "after")
    .nodeCanvasObject((n, ctx) => {
      let size = 30;
      if (n.img) {
        ctx.lineWidth = 5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, size / 2, 0, Math.PI * 2, true);
        ctx.clip();
        ctx.strokeStyle = n.color;
        try {
          ctx.drawImage(n.img, n.x - size / 2, n.y - size / 2, size, size);
        } catch (err) {
          console.log("Error in drawImage: ", err)
        }
        ctx.stroke();
        ctx.restore();
      }
    })
    .linkColor(resetLinksColor)
    .linkWidth(linkWidth)
    .linkDirectionalArrowLength(arrowLength)
    .onEngineTick(async () => {
      Graph.linkVisibility(false);
    })
    .onEngineStop(async () => {
      Graph.linkVisibility(linkVisibility);
      if ((await localforage.getItem("brightid_has_imported")) && !autoLoginDone) {
        loadPersonalData();
      }
    })
  Graph.moving = false;
  Graph.onZoom(() => {
    moving = true;
    Graph.linkVisibility(false);
  })
    .onZoomEnd(() => {
      moving = false;
      setTimeout(() => {
        if (!moving) {
          Graph.linkVisibility(linkVisibility);
        }
      }, 3000);
    })
  updateStatistics();
}

function drawGraph3d(data, cooldownTime, linkVisibility) {
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
    .nodeVal(resetNodesVal)
    .linkWidth(linkWidth)
    .linkSource("source")
    .linkTarget("target")
    .onNodeClick((node) => {
      if (!node.selected) {
        selectNode(node, true, false);
      }
    })
    .linkVisibility(linkVisibility)
    .onBackgroundClick(() => {
      for (const id in graphNodes) {
        graphNodes[id].selected = false;
      }
      selectedNode = undefined;
      Graph.linkWidth(linkWidth)
        .nodeColor(resetNodesColor)
        .linkColor(resetLinksColor)
        .linkDirectionalArrowLength(arrowLength);
    })
    .linkDirectionalArrowLength(arrowLength)
  updateStatistics();
}

async function logPositions2d(type) {
  let loopNo;
  let loopTime;
  if (type == "a") {
    updateGraphData(3);
    updateLegend(3);
    setPosition("2d");
    loopNo = 10;
    loopTime = 110000;
  } else if (type == "j") {
    updateGraphData(3);
    updateLegend(3);
    setPosition("2d");
    for (let n of Object.values(graphNodes)) {
      if (n.id in positions["2d"]) {
        n.fx = n.x;
        n.fy = n.y;
      }
    }
    updateGraphData(1);
    updateLegend(1);
    loopNo = 1;
    loopTime = 300000;
  } else {
    console.log("type should be a (already Known) or j (just met)");
    return;
  }
  for (let i = 0; i <= loopNo; i++) {
    draw(i);
  }
  function draw(i) {
    setTimeout(function () {
      if (i == loopNo) {
        const pos = {};
        Object.values(graphNodes).forEach(node => {
          if (!("x" in node) || !("y" in node)) {
            return;
          }
          pos[node.id] = { x: node.x, y: node.y };
        });
        console.log(`nodes: ${Object.keys(pos).length}`);
        console.log(pos);
      } else {
        console.log(`setPositions2d ${i}`);
        drawGraph2d({ nodes: Object.values(graphNodes), links: graphLinks }, 100000, false);
      }
    }, loopTime * i);
  }
}

function logPositions3d() {
  const pos = {};
  Object.values(graphNodes).forEach(node => {
    if (!("x" in node) || !("y" in node) || !("z" in node)) {
      return;
    }
    if (Date.now() - 10 * 24 * 60 * 60 * 1000 > node.createdAt) {
      pos[node.id] = { x: node.x, y: node.y, z: node.z };
    }
  });
  console.log(`nodes: ${Object.keys(pos).length}`);
  console.log(pos);
}
