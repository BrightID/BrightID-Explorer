const ratingLinkColor = "orange";
const energyLinkColor = "blue";
const ratedNodeColor = "orange";
const energyTransferedNodeColor = "blue";

function prepare() {
  $("#legendNodes").empty();
  $(
    `<li><a href="#" id="ratingNodes" onclick="drawAuraView('rating')" style="text-decoration: none; color: black;"><span style="background:${ratedNodeColor};"></span>rating</a></li>`
  ).appendTo("#legendNodes");
  $(
    `<li><a href="#" id="energyNodes" onclick="drawAuraView('energy')" style="text-decoration: none; color: black;"><span style="background:${energyTransferedNodeColor};"></span>energy transfer</a></li>`
  ).appendTo("#legendNodes");

  $("#legendLinks").empty();
  $(
    `<li><span style="background:${ratingLinkColor};"></span>rating</li>`
  ).appendTo("#legendLinks");
  $(
    `<li><span style="background:${energyLinkColor};"></span>energy transfer</li>`
  ).appendTo("#legendLinks");

  $("#graphbtntitle").hide();
  $("#groupbtntitle").hide();
  $("#statisticsbtntitle").hide();
  $("#usersillustratorbtntitle").hide();
  $("#starillustratorbtntitle").hide();
  $("#seedData").hide();
  $("#neighborsContainer").hide();
  $("#neighborsHistoryContainer").hide();
  $("#groupsContainer").hide();
}

function selectAuraNode(node, showDetails, focus) {
  $("#userDetailsContent").show();
  $("#seedData").hide();
  $("#groupsData").hide();
  $("#userNameContainer").hide();
  $("#userRecoveryContainer").hide();
  $("#userDetailsPlaceHolder").hide();
  $("#neighborsContainer").hide();
  $("#neighborContainer").hide();
  $("#verificationsTree").empty();
  $("#neighborsHistoryContainer").hide();
  $("#groupsContainer").hide();
  $("#auraConnectionsContainer").show();

  if (selectedNode) {
    selectedNode.selected = false;
  }

  node.selected = true;
  selectedNode = node;
  $("#brightidText").html(node.id);
  $("#brightidField").val(node.id);
  $("#nodeCreatedAt").html(new Date(node.createdAt).toJSON().split("T")[0]);
  $("#recoveryIn").html(node.statistics["inbound"]["recovery"]);
  $("#recoveryOut").html(node.statistics["outbound"]["recovery"]);
  $("#alreadyKnownIn").html(node.statistics["inbound"]["already known"]);
  $("#alreadyKnownOut").html(node.statistics["outbound"]["already known"]);
  $("#justMetIn").html(node.statistics["inbound"]["just met"]);
  $("#justMetOut").html(node.statistics["outbound"]["just met"]);
  $("#suspiciousIn").html(node.statistics["inbound"]["suspicious"]);
  $("#suspiciousOut").html(node.statistics["outbound"]["suspicious"]);
  $("#reportedIn").html(node.statistics["inbound"]["reported"]);
  $("#reportedOut").html(node.statistics["outbound"]["reported"]);
  $("#filteredIn").html(node.statistics["inbound"]["filtered"]);
  $("#filteredOut").html(node.statistics["outbound"]["filtered"]);
  $("#energyIn").html(node.incomingEnergies || 0);
  $("#energyOut").html(node.outgoingEnergies || 0);
  $("#ratingIn").html(node.incomingRatings || 0);
  $("#ratingOut").html(node.outgoingRatings || 0);

  $("#userImage").attr("src", node?.img?.src || "");

  if (node.name) {
    $("#userName").html(node.name);
    $("#userNameContainer").show();
  }

  addVerificationsTree(node);

  $("#auraConnections")
    .empty()
    .append(
      new Option(
        "connection ↭ energy-out | rating-out ⬈ energy-in | rating-in ⬋",
        "none"
      )
    );
  Object.keys(node.neighbors).forEach((n) => {
    const l = linksMap[`${node.id}:${n}`];
    const rl = linksMap[`${n}:${node.id}`];
    if (!l && !rl) {
      return;
    }
    const connText = `${allNodes[n]?.name || n} ↭ ${
      l ? l.energy || "_" : "_"
    } | ${l ? l.rating || "_" : "_"} ⬈ ${rl ? rl.energy || "_" : "_"} | ${
      rl ? rl.rating || "_" : "_"
    } ⬋`;
    $("#auraConnections").append(new Option(connText, n));
  });
  $("#auraStatistics").show();
  $("#auraConnectionsContainer").show();

  const highlightNodes = new Set([...Object.keys(node.neighbors), node.id]);
  const highlightLinks = new Set();
  graphLinks.forEach((l) => {
    if (l.source.id != node.id && l.target.id != node.id) {
      return;
    }
    if (highlightNodes.has(l.source.id) && highlightNodes.has(l.target.id)) {
      highlightLinks.add(l);
    }
  });

  Graph.linkVisibility((l) => (highlightLinks.has(l) ? true : false))
    .nodeColor((n) =>
      highlightNodes.has(n.id) ? resetNodesColor(n) : resetNodesColor(n, true)
    )
    .linkColor((l) => (highlightLinks.has(l) ? resetLinksColor(l) : fadedColor))
    .linkDirectionalArrowLength((l) =>
      highlightLinks.has(l) ? arrowLength : 1
    )
    .centerAt(node.x + 200, node.y)
    .zoom(1.2, 1000);

  openCollapsible("userDetails", true);
}

async function getAuraData(fname) {
  const { energyTransfers, ratings, energy } = await $.ajax({
    url: `./${fname}.json`,
    cache: false,
  });

  graphNodes = {};
  graphLinks = [];
  linksMap = {};

  ratings.forEach((r) => {
    allNodes[r.fromBrightId]["outgoingRatings"] =
      (allNodes[r.fromBrightId]["outgoingRatings"] || 0) + 1;
    allNodes[r.toBrightId]["incomingRatings"] =
      (allNodes[r.toBrightId]["incomingRatings"] || 0) + 1;
    allNodes[r.fromBrightId]["givenRatings"] =
      (allNodes[r.fromBrightId]["givenRatings"] || 0) + parseFloat(r.rating);
    allNodes[r.toBrightId]["rating"] =
      (allNodes[r.toBrightId]["rating"] || 0) + parseFloat(r.rating);

    linksMap[`${r.fromBrightId}:${r.toBrightId}`] = {
      source: r.fromBrightId,
      target: r.toBrightId,
      history: [[new Date(r.createdAt).getTime(), "already known"]],
      aColor: ratingLinkColor,
      width: 1,
      rating: parseFloat(r.rating),
    };

    graphNodes[r.fromBrightId] = {
      ...allNodes[r.fromBrightId],
      aColor: ratedNodeColor,
      val: 1,
    };

    graphNodes[r.toBrightId] = {
      ...allNodes[r.toBrightId],
      aColor: ratedNodeColor,
      val: 1,
    };
  });

  energyTransfers.forEach((et) => {
    if (et.amount == 0) {
      return;
    }

    graphNodes[et.fromBrightId]["outgoingEnergies"] =
      (graphNodes[et.fromBrightId]["outgoingEnergies"] || 0) + 1;
    graphNodes[et.toBrightId]["incomingEnergies"] =
      (graphNodes[et.toBrightId]["incomingEnergies"] || 0) + 1;

    linksMap[`${et.fromBrightId}:${et.toBrightId}`] = Object.assign(
      linksMap[`${et.fromBrightId}:${et.toBrightId}`],
      {
        aColor: energyLinkColor,
        width: ((et.amount - 1) * (5 - 2)) / (100 - 1) + 2,
        energy: et.amount,
      }
    );
  });

  const energies = [];
  energy.forEach((e) => {
    if (e.amount == 0) {
      return;
    }
    energies.push(e.amount);
  });
  const maxEnergies = Math.max(...energies);
  const minEnergies = Math.min(...energies);
  energy.forEach((e) => {
    if (e.amount == 0) {
      return;
    }
    graphNodes[e.brightId] = Object.assign(graphNodes[e.brightId], {
      aColor: energyTransferedNodeColor,
      val:
        ((e.amount - minEnergies) * (10 - 2)) / (maxEnergies - minEnergies) + 2,
      energy: e.amount,
    });
  });
}

async function drawAura(fname) {
  prepare();

  if ((await localforage.getItem("brightid_has_imported")) && !autoLoginDone) {
    await loadPersonalData();
  }

  await getAuraData(fname);

  graphLinks = Object.values(linksMap);
  const data = { nodes: Object.values(graphNodes), links: graphLinks };

  $("#graphDiv").empty();
  const elem = document.getElementById("graphDiv");
  Graph = ForceGraph()(elem);
  Graph.nodeColor((n) => n.aColor)
    .graphData(data)
    .nodeId("id")
    .nodeVal((n) => n.val)
    .nodeLabel(
      (n) =>
        `${allNodes[n.id]?.name || n.id}<br/>energy: ${
          n.energy || 0
        }<br/>outgoing ratings: ${
          n.outgoingRatings || 0
        }<br/>incoming ratings: ${n.incomingRatings || 0}`
    )
    .linkSource("source")
    .linkTarget("target")
    .linkLabel((link) => {
      const source = allNodes[link.source.id]?.name || link.source.id;
      const target = allNodes[link.target.id]?.name || link.target.id;
      const res = `${source} -> ${target} rank: ${link.rating || 0} energy: ${
        link.energy || 0
      }`;
      const rlink = linksMap[`${link.target.id}:${link.source.id}`];
      return rlink
        ? `${res}<br/>${target} -> ${source}  rank: ${
            rlink.rating || 0
          } energy: ${rlink.energy || 0}`
        : res;
    })
    .onNodeClick((node) => {
      if (!node.selected) {
        selectAuraNode(node, true);
      }
      Graph.linkWidth((l) => l.width).linkVisibility(true);
    })
    .onBackgroundClick((evt) => {
      for (const id in graphNodes) {
        graphNodes[id].selected = false;
      }
      selectedNode = undefined;
      Graph.nodeColor((n) => n.aColor)
        .linkVisibility(true)
        .linkColor((l) => l.aColor)
        .linkDirectionalArrowLength(arrowLength);
    })
    .nodeCanvasObjectMode(() => "after")
    .nodeCanvasObject((n, ctx) => {
      let size = 7 * n.val ** 0.5;
      if (n.img) {
        ctx.lineWidth = 0;
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, size / 2, 0, Math.PI * 2, true);
        ctx.clip();
        ctx.strokeStyle = n.aColor;
        try {
          ctx.drawImage(n.img, n.x - size / 2, n.y - size / 2, size, size);
        } catch (err) {
          console.log("Error in drawImage: ", err);
        }
        // ctx.stroke();
        ctx.restore();
      }
    })
    .linkColor((l) => l.aColor)
    .linkWidth((l) => l.width)
    .linkVisibility(true)
    .linkDirectionalArrowLength(arrowLength)
    .cooldownTime(10000)
    .zoom(1, 2000);
}

const auraGraphView = { rating: true, energy: true };
async function drawAuraView(type) {
  auraGraphView[type] = !auraGraphView[type];
  $("#ratingNodes").css("color", auraGraphView.rating ? "black" : "#d49a9a");
  $("#energyNodes").css("color", auraGraphView.energy ? "black" : "#d49a9a");

  Graph.nodeVisibility((n) =>
    auraGraphView.energy && n.energy
      ? true
      : auraGraphView.rating && n.rating
      ? true
      : false
  )
    .linkVisibility((l) =>
      auraGraphView.energy && l.energy
        ? true
        : auraGraphView.rating && l.rating
        ? true
        : false
    )
    .nodeLabel((n) => {
      let label = `${allNodes[n.id]?.name || n.id}`;
      if (auraGraphView.energy && n.energy)
        label += `<br/>energy: ${n.energy || 0}`;
      if (auraGraphView.rating && n.rating)
        label += `<br/>outgoing ratings: ${
          n.outgoingRatings || 0
        }<br/>incoming ratings: ${n.incomingRatings || 0}`;
      return label;
    })
    .linkLabel((l) => {
      const source = allNodes[l.source.id]?.name || l.source.id;
      const target = allNodes[l.target.id]?.name || l.target.id;
      let label = `${source} -> ${target}`;
      if (auraGraphView.energy && l.energy)
        label += ` energy: ${l.energy || 0}`;
      if (auraGraphView.rating && l.rating) label += ` rank: ${l.rating || 0}`;
      const rl = linksMap[`${l.target.id}:${l.source.id}`];
      if (rl) label += `<br/>${target} -> ${source}`;
      if (rl && auraGraphView.energy && l.energy)
        label += ` energy: ${rl.energy || 0}`;
      if (rl && auraGraphView.rating && l.rating)
        label += ` rank: ${rl.rating || 0}`;
      return label;
    })
    .nodeColor((n) => {
      if (auraGraphView.rating && auraGraphView.energy) return n.aColor;
      if (auraGraphView.rating) return ratedNodeColor;
      if (auraGraphView.energy) return energyTransferedNodeColor;
    })
    .linkColor((l) => {
      if (auraGraphView.rating && auraGraphView.energy) return l.aColor;
      if (auraGraphView.rating) return ratingLinkColor;
      if (auraGraphView.energy) return energyLinkColor;
    });
}
