var selectedNodes = [];
var bituVerifieds = [];

function getMainComponent() {
  const mainNode = "AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA";
  const checked = {};
  const checkList = [];
  const mainComponent = [];
  checkList.push(mainNode);
  while (checkList.length > 0) {
    const v = checkList.shift();
    if (!checked[v]) {
      mainComponent.push(v);
      checked[v] = true;
      for (const neighbor of Object.keys(allNodes[v].neighbors)) {
        const outConns = allNodes[v].neighbors[neighbor]["to"];
        const inConns = allNodes[v].neighbors[neighbor]["from"];
        const tLevel = outConns.length > 0 ? outConns[outConns.length - 1][1] : null;
        const fLevel = inConns.length > 0 ? inConns[inConns.length - 1][1] : null;
        if (["already known", "recovery"].includes(tLevel) && ["already known", "recovery"].includes(fLevel)) {
          checkList.push(neighbor);
        }
      }
    }
  }
  console.log(`Main Component length: ${mainComponent.length}`);
  // console.log("Main Component: ", mainComponent)
  return mainComponent;
}

function bitu() {
  const directPenalty = 5;
  const indirectPenalty = 1;
  scores = {}
  const verifieds = new Set(bituVerifieds)
  verifieds.forEach(v => scores[v] = { "linksNum": 0, "score": 0, "directReports": {}, "indirectReports": {}, "reportedConnections": {} });
  Object.values(allLinks).forEach(l => {
    const s = l.source?.id || l.source;
    const t = l.target?.id || l.target;
    if (!verifieds.has(s) || !verifieds.has(t)) {
      return;
    }

    const level = l.history[l.history.length - 1][1];
    if (!["already known", "recovery"].includes(level)) {
      return;
    }
    const ol = allLinks[`${t}${s}`];
    const otherSideLevel = ol?.history[ol.history.length - 1][1];
    if (["already known", "recovery"].includes(otherSideLevel)) {
      scores[s]["linksNum"] += 1;
      scores[s]["score"] += 1;
    } else if (["suspicious", "reported"].includes(otherSideLevel)) {
      scores[s]["directReports"][t] = -directPenalty;
      scores[s]["score"] -= directPenalty;
    }
  });

  Object.values(allLinks).forEach(l => {
    const s = l.source?.id || l.source;
    const t = l.target?.id || l.target;
    if (!verifieds.has(s) || !verifieds.has(t)) {
      return;
    }

    const level = l["history"][l["history"].length - 1][1];
    if (!["already known", "recovery"].includes(level)) {
      return;
    }

    if (Object.keys(scores[t]["directReports"]).length > 0) {
      scores[s]["indirectReports"][t] = -indirectPenalty * Object.keys(scores[t]["directReports"]).length;
      scores[s]["reportedConnections"][t] = Object.keys(scores[t]["directReports"]);
      scores[s]["score"] -= indirectPenalty * Object.keys(scores[t]["directReports"]).length;
    }
  });

  // visualizing result
  updateGraphData(3);
  setPosition("2d");
  drawGraph2d({ nodes: Object.values(graphNodes), links: Object.values(graphLinks) }, 0, false, false);
  Graph
    .linkVisibility(l => verifieds.has(l.source.id) && verifieds.has(l.target.id) && ["already known", "recovery"].includes(l.history[l.history.length - 1][1]))
    .nodeVal(n => Math.min(Math.max(3 * scores[n.id]?.score || 1, 3), 20) ** .5)
    .nodeColor(n => (scores[n.id]?.score || 0) > 0 ? "blue" : "red")
    .linkDirectionalArrowLength(2)
    .linkWidth(.1);
  console.log(Object.keys(scores).map(user => {
    return {
      name: 'Bitu',
      user,
      ...scores[user]
    }
  }));
}

function selectNodes(nodes) {
  selectedNodes = nodes;
  if (bituVerifieds.length == 0) {
    const mainComponent = new Set(getMainComponent());
    mainComponent.forEach(v => {
      let n = allNodes[v];
      if (n.verifications && "Bitu" in n.verifications && n.verifications.Bitu.score > 0) {
        bituVerifieds.push(v);
        n.bituVerified = true;
      }
    });
  }
  $("#userDetailsContent").show();
  $("#seedData").hide();
  $("#userNameContainer").hide();
  $("#userRecoveryContainer").hide();
  $("#userDetailsPlaceHolder").hide();
  $("#neighborsContainer").hide();
  $("#neighborContainer").hide();

  const highlightNodes = new Set();
  nodes.forEach(id => {
    highlightNodes.add(id);
    const node = allNodes[id];
    Object.keys(node.neighbors).forEach(n1 => {
      const tLevel = node.neighbors[n1]["to"].length > 0 ? node.neighbors[n1]["to"][node.neighbors[n1]["to"].length - 1][1] : null;
      const fLevel = node.neighbors[n1]["from"].length > 0 ? node.neighbors[n1]["from"][node.neighbors[n1]["from"].length - 1][1] : null;
      if (!selectedLevels.includes(tLevel) || !selectedLevels.includes(fLevel)) {
        return;
      }
      highlightNodes.add(n1);
    });
  });

  const activeMembers = new Set();
  const outboundNeighbors = new Set();
  let inboundConns = 0;
  let outboundConns = 0;
  const highlightLinks = new Set();
  graphLinks.forEach(l => {
    if (!nodes.includes(l.source.id) && !nodes.includes(l.target.id)) {
      return;
    }
    let level = l["history"][l["history"].length - 1][1];
    if (nodes.includes(l.source.id) && nodes.includes(l.target.id)) {
      inboundConns += 1;
    } else {
      outboundConns += 1;
      if (!nodes.includes(l.source.id) && nodes.includes(l.target.id)) {
        activeMembers.add(l.target.id);
        outboundNeighbors.add(l.source.id);
      } else if (nodes.includes(l.source.id) && !nodes.includes(l.target.id)) {
        activeMembers.add(l.source.id);
        outboundNeighbors.add(l.target.id);
      }
    }

    if (highlightNodes.has(l.source.id) && highlightNodes.has(l.target.id)) {
      highlightLinks.add(l);
    }
  });

  const selectedNodesText = nodes.join("\n");
  navigator.clipboard.writeText(selectedNodesText).then(function () {
    alert("Info:", `
      Selected nodes: ${nodes.length}</br>Active nodes: ${activeMembers.size}</br>Outbound neighbors: ${outboundNeighbors.size}</br>Outbound connections: ${outboundConns / 2}</br>Inbound connections: ${inboundConns / 2}</br>selected nodes' id were copied to the clipboard.
      <br>
      <button class="btn btn-primary mr-5 mt-1" onclick="addToBituVerifieds()">
        add
      </button>
      <button class="btn btn-primary mr-5 mt-1" onclick="removeFromBituVerifieds()">
        remove
      </button>
    `);
  }, function (err) {
    console.error("Async: Could not copy text: ", err);
  });

  Graph.linkVisibility(l => (highlightLinks.has(l) ? true : false))
    .nodeColor(n => highlightNodes.has(n.id) ? resetNodesColor(n) : resetNodesColor(n, true))
    .linkDirectionalArrowLength(l => highlightLinks.has(l) ? 6 : 2)
    .linkColor(l => highlightLinks.has(l) ? resetLinksColor(l) : fadedColor);
}

function addToBituVerifieds() {
  selectedNodes.forEach(id => {
    if (!(bituVerifieds.includes(id))) {
      bituVerifieds.push(id);
      allNodes[id].bituVerified = true;
    }
  });
  console.log(`add ${selectedNodes.length} nodes. verifieds: ${bituVerifieds.length}`);
}

function removeFromBituVerifieds() {
  bituVerifieds = bituVerifieds.filter(id => {
    return selectedNodes.indexOf(id) < 0;
  });
  selectedNodes.forEach(id => {
    allNodes[id].bituVerified = false;
  });
  console.log(`remove ${selectedNodes.length} nodes. verifieds: ${bituVerifieds.length}`);
}
