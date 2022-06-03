const ratingLinkColor = "orange";
const energyLinkColor = "blue";
const ratedNodeColor = "orange";
const energyTransferedNodeColor = "blue";

const auraGraphView = { rating: true, energy: true };

function prepare() {
  $("#legendNodes").empty();
  $(
    `<li><a href="#" id="ratingNodes" onclick="selectAuraView('rating')" style="text-decoration: none; color: black;"><span style="background:${ratedNodeColor};"></span>rating</a></li>`
  ).appendTo("#legendNodes");
  $(
    `<li><a href="#" id="energyNodes" onclick="selectAuraView('energy')" style="text-decoration: none; color: black;"><span style="background:${energyTransferedNodeColor};"></span>energy transfer</a></li>`
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
    const l = auraLinks[`${node.id}:${n}`];
    const rl = auraLinks[`${n}:${node.id}`];
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
      highlightNodes.has(n.id) ? resetAuraNodesColor(n) : fadedColor
    )
    .linkColor((l) =>
      highlightLinks.has(l) ? resetAuraLinksColor(l) : fadedColor
    )
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

  auraNodes = {};
  auraLinks = {};

  ratings.forEach((r) => {
    if (!(r.fromBrightId in auraNodes)) {
      auraNodes[r.fromBrightId] = {
        ...allNodes[r.fromBrightId],
        incomingRatings: 0,
        outgoingRatings: 0,
        givenRatings: 0,
        rating: 0,
        incomingEnergies: 0,
        outgoingEnergies: 0,
      };
    }

    if (!(r.toBrightId in auraNodes)) {
      auraNodes[r.toBrightId] = {
        ...allNodes[r.toBrightId],
        incomingRatings: 0,
        outgoingRatings: 0,
        givenRatings: 0,
        rating: 0,
        incomingEnergies: 0,
        outgoingEnergies: 0,
      };
    }

    auraNodes[r.fromBrightId]["outgoingRatings"] += 1;
    auraNodes[r.toBrightId]["incomingRatings"] += 1;
    auraNodes[r.fromBrightId]["givenRatings"] += parseFloat(r.rating);
    auraNodes[r.toBrightId]["rating"] += parseFloat(r.rating);

    auraLinks[`${r.fromBrightId}:${r.toBrightId}`] = {
      source: r.fromBrightId,
      target: r.toBrightId,
      history: [[new Date(r.createdAt).getTime(), "already known"]],
      ratingWidth: ((parseFloat(r.rating) - 0) * (5 - 1)) / (4 - 0) + 1,
      rating: parseFloat(r.rating),
    };
  });

  const ratingAmounts = [];
  Object.values(auraNodes).forEach((n) => {
    if (n.rating == 0) {
      return;
    }
    ratingAmounts.push(n.rating);
  });
  const maxRatings = Math.max(...ratingAmounts);
  const minRatings = Math.min(...ratingAmounts);
  Object.values(auraNodes).forEach((n) => {
    auraNodes[n.id]["ratingVal"] =
      ((n.rating - minRatings) * (10 - 1)) / (maxRatings - minRatings) + 1;
  });

  energyTransfers.forEach((et) => {
    if (et.amount == 0) {
      return;
    }

    auraNodes[et.fromBrightId]["outgoingEnergies"] += 1;
    auraNodes[et.toBrightId]["incomingEnergies"] += 1;

    auraLinks[`${et.fromBrightId}:${et.toBrightId}`] = Object.assign(
      auraLinks[`${et.fromBrightId}:${et.toBrightId}`],
      {
        energyWidth: ((et.amount - 1) * (5 - 2)) / (100 - 1) + 2,
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
    auraNodes[e.brightId] = Object.assign(auraNodes[e.brightId], {
      aColor: energyTransferedNodeColor,
      energyVal:
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

  await drawAuraGraph(auraNodes, auraLinks);
}

function resetAuraNodesColor(n) {
  if (auraGraphView.rating && auraGraphView.energy) {
    return n.energy > 0 ? energyTransferedNodeColor : ratedNodeColor;
  }
  if (auraGraphView.rating) return ratedNodeColor;
  if (auraGraphView.energy) return energyTransferedNodeColor;
}

function resetAuraNodesVal(n) {
  if (auraGraphView.rating && auraGraphView.energy) {
    return n.energyVal > 0 ? n.energyVal : 1;
  }
  if (auraGraphView.rating) return n.ratingVal;
  if (auraGraphView.energy) return n.energyVal;
}

function resetAuraNodesLabel(n) {
  let label = `${allNodes[n.id]?.name || n.id}`;
  if (auraGraphView.energy) {
    label += `<br/>energy: ${n.energy || 0}`;
  }
  if (auraGraphView.rating) {
    label += `<br/>outgoing ratings: ${
      n.outgoingRatings || 0
    }<br/>incoming ratings: ${n.incomingRatings || 0}`;
  }
  return label;
}

function resetAuraLinksColor(l) {
  if (auraGraphView.rating && auraGraphView.energy) {
    return l.energy > 0 ? energyLinkColor : ratingLinkColor;
  }
  if (auraGraphView.rating) return ratingLinkColor;
  if (auraGraphView.energy) return energyLinkColor;
}

function resetAuraLinksWidth(l) {
  if (auraGraphView.rating && auraGraphView.energy) {
    return l.energyWidth > 0 ? l.energyWidth : 1;
  }
  if (auraGraphView.rating) return l.ratingWidth;
  if (auraGraphView.energy) return l.energyWidth;
}

function resetAuraLinksLabel(l) {
  const source = allNodes[l.source.id]?.name || l.source.id;
  const target = allNodes[l.target.id]?.name || l.target.id;

  let label = `${source} -> ${target}`;
  if (auraGraphView.energy) {
    label += ` energy: ${l.energy || 0}`;
  }
  if (auraGraphView.rating) {
    label += ` rating: ${l.rating || 0}`;
  }

  const rl = auraLinks[`${l.target.id}:${l.source.id}`];

  if (rl) {
    label += `<br/>${target} -> ${source}`;
    if (auraGraphView.energy) {
      label += ` energy: ${rl.energy || 0}`;
    }
    if (auraGraphView.rating) {
      label += ` rating: ${rl.rating || 0}`;
    }
  }
  return label;
}

async function drawAuraGraph(nodes, links) {
  graphNodes = nodes;
  graphLinks = Object.values(links);
  const data = { nodes: Object.values(nodes), links: Object.values(links) };

  $("#graphDiv").empty();
  const elem = document.getElementById("graphDiv");
  Graph = ForceGraph()(elem);
  Graph.nodeColor(resetAuraNodesColor)
    .graphData(data)
    .nodeId("id")
    .nodeVal(resetAuraNodesVal)
    .nodeLabel(resetAuraNodesLabel)
    .linkSource("source")
    .linkTarget("target")
    .linkLabel(resetAuraLinksLabel)
    .onNodeClick((node) => {
      if (!node.selected) {
        selectAuraNode(node, true);
      }
    })
    .onBackgroundClick((evt) => {
      for (const id in graphNodes) {
        graphNodes[id].selected = false;
      }
      selectedNode = undefined;
      Graph.nodeColor(resetAuraNodesColor)
        .linkVisibility(true)
        .linkColor(resetAuraLinksColor)
        .linkDirectionalArrowLength(arrowLength);
    })
    .nodeCanvasObjectMode(() => "after")
    .nodeCanvasObject((n, ctx) => {
      let size = 7 * (n.energyVal || 1) ** 0.5;
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
    .linkColor(resetAuraLinksColor)
    .linkWidth(resetAuraLinksWidth)
    .linkVisibility(true)
    .linkDirectionalArrowLength(arrowLength)
    .cooldownTime(10000)
    .zoom(1, 2000);
}

async function selectAuraView(type) {
  auraGraphView[type] = !auraGraphView[type];
  $("#ratingNodes").css("color", auraGraphView.rating ? "black" : "#d49a9a");
  $("#energyNodes").css("color", auraGraphView.energy ? "black" : "#d49a9a");

  const nodes = {};
  const links = {};

  for (const key in auraLinks) {
    const l = auraLinks[key];
    if (auraGraphView.energy && l.energy) {
      links[key] = l;
      nodes[l.source.id] = auraNodes[l.source.id];
      nodes[l.target.id] = auraNodes[l.target.id];
    }

    if (auraGraphView.rating && l.rating) {
      links[key] = l;
      nodes[l.source.id] = auraNodes[l.source.id];
      nodes[l.target.id] = auraNodes[l.target.id];
    }
  }

  await drawAuraGraph(nodes, links);
}
