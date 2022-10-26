const gold = "#FFD700";
const silver = "#A6ACAF";
const bronze = "#CD7F32";
const red = "#FF0000";
const gray = "#BB8FCE";
const honestyLinkColor = "orange";
const energyLinkColor = "blue";

const auraGraphView = { honesty: true, energy: true };
const auraLinkDirection = { incoming: true, outgoing: true };
var allNum = goldNum = silverNum = bronzeNum = susNum = 0;

function formatId(id) {
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

function prepare() {
  $("#legendNodes").empty();
  $(`<li><span style="background:${gold};"></span>Gold</li>`).appendTo(
    "#legendNodes"
  );
  $(`<li><span style="background:${silver};"></span>Silver</li>`).appendTo(
    "#legendNodes"
  );
  $(`<li><span style="background:${bronze};"></span>Bronze</li>`).appendTo(
    "#legendNodes"
  );
  $(`<li><span style="background:${red};"></span>Suspicious</li>`).appendTo(
    "#legendNodes"
  );
  $(`<li><span style="background:${gray};"></span>Unverified</li>`).appendTo(
    "#legendNodes"
  );

  $("#legendLinks").empty();
  $(
    `<li><a href="#" id="ratingLinks" onclick="selectAuraView('honesty')" style="text-decoration: none; color: black;"><span style="background:${honestyLinkColor};"></span>honesty</a></li>`
  ).appendTo("#legendLinks");
  $(
    `<li><a href="#" id="energyLinks" onclick="selectAuraView('energy')" style="text-decoration: none; color: black;"><span style="background:${energyLinkColor};"></span>energy transfer</a></li>`
  ).appendTo("#legendLinks");

  $("#legendDirectionContainar").show();
  $("#legendDirection").empty();
  $(
    `<li><a href="#" id="incomingLink" onclick="selectAuraLinkDirection('incoming')" style="text-decoration: none; color: black;"><span style="background:yellow;">⬋</span> incoming</a></li>`
  ).appendTo("#legendDirection");
  $(
    `<li><a href="#" id="outgoingLink" onclick="selectAuraLinkDirection('outgoing')" style="text-decoration: none; color: black;"><span style="background:yellow;">⬈</span> outgoing</a></li>`
  ).appendTo("#legendDirection");

  $("#aurastatisticsbtntitle").show();
  $("#graphbtntitle").hide();
  $("#groupbtntitle").hide();
  $("#statisticsbtntitle").hide();
  $("#starillustratorbtntitle").hide();
  $("#seedData").hide();
  $("#neighborsContainer").hide();
  $("#neighborsHistoryContainer").hide();
  $("#groupsContainer").hide();
  $("#resetBtn").hide();
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
  $("#energyIn").html(
    `${parseInt(node.inEnergy).toLocaleString("en-US")} (${
      node.inEnergyNum || 0
    })`
  );
  $("#energyOut").html(
    `${parseInt(node.outEnergy).toLocaleString("en-US")} (${
      node.outEnergyNum || 0
    })`
  );
  $("#honestyIn").html(
    `${parseInt(node.inHonesty)} (${node.inHonestyNum || 0})`
  );
  $("#honestyOut").html(
    `${parseInt(node.outHonesty)} (${node.outHonestyNum || 0})`
  );

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
        "connection ↭ energy-out | honesty-out ⬈ energy-in | honesty-in ⬋",
        "none"
      )
    );
  Object.keys(node.neighbors).forEach((n) => {
    const l = auraLinks[`${node.id}:${n}`];
    const rl = auraLinks[`${n}:${node.id}`];
    if (!l && !rl) {
      return;
    }
    const connText = `${allNodes[n]?.name || formatId(n)} ↭ 
    ${l ? parseInt(l.energy || 0).toLocaleString("en-US") : "_"} | ${
      l ? l.honesty || 0 : "_"
    } ⬈ 
    ${rl ? parseInt(rl.energy || 0).toLocaleString("en-US") : "_"} | ${
      rl ? rl.honesty || 0 : "_"
    } ⬋`;
    $("#auraConnections").append(new Option(connText, n));
  });
  $("#auraStatistics").show();
  $("#auraConnectionsContainer").show();

  const highlightNodes = new Set([...Object.keys(node.neighbors), node.id]);
  const highlightLinks = new Set();
  graphLinks.forEach((l) => {
    if (auraLinkDirection.incoming && auraLinkDirection.outgoing) {
      if (l.source.id != node.id && l.target.id != node.id) {
        return;
      }
    } else if (auraLinkDirection.incoming) {
      if (l.target.id != node.id) {
        return;
      }
    } else if (auraLinkDirection.outgoing) {
      if (l.source.id != node.id) {
        return;
      }
    } else {
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
    .linkLabel((l) => (highlightLinks.has(l) ? resetAuraLinksLabel(l) : ""))
    .linkWidth((l) => (highlightLinks.has(l) ? resetAuraLinksWidth(l) : 0))
    .centerAt(node.x + 200, node.y)
    .zoom(1.2, 1000);

  openCollapsible("userDetails", true);
}

function placeComment() {
  console.log("nodes:", selectedNodes);
  const message = document.getElementById("nodesComment").value;
  console.log("message:", message);
}

function selectAuraNodes(nodes) {
  selectedNodes = nodes;
  $("#userDetailsContent").show();
  $("#seedData").hide();
  $("#userNameContainer").hide();
  $("#userRecoveryContainer").hide();
  $("#userDetailsPlaceHolder").hide();
  $("#neighborsContainer").hide();
  $("#neighborContainer").hide();

  const highlightNodes = new Set();
  sumX = 0;
  sumY = 0;
  nodes.forEach((id) => {
    highlightNodes.add(id);
  });

  const highlightLinks = new Set();
  Object.values(auraLinks).forEach((l) => {
    if (highlightNodes.has(l.source.id) && highlightNodes.has(l.target.id)) {
      highlightLinks.add(l);
    }
  });

  const selectedNodesText = nodes.join("\n");
  alert(
    "Submit Comment:",
    `You selected ${nodes.length} nodes.
    <br>
    Please submit your comment.
    <br>
    <div class="text-center">
      <textarea id="nodesComment" name="nodesComment"></textarea>
      <br>
      <button id="placeCommentBtn" class="btn btn-primary" onclick="placeComment()">
        Submit
      </button>
    </div>`
  );

  Graph.linkVisibility((l) => (highlightLinks.has(l) ? true : false))
    .nodeColor((n) => {
      if (highlightNodes.has(n.id)) return resetAuraNodesColor(n);
      else return resetNodesColor(n, true);
    })
    .linkDirectionalArrowLength((l) => (highlightLinks.has(l) ? 6 : 2))
    .linkColor((l) =>
      highlightLinks.has(l) ? resetAuraLinksColor(l) : fadedColor
    );
}

async function getAuraData(fname) {
  const { nodes, links } = await $.ajax({
    url: `./${fname}.json`,
    cache: false,
  });

  allNum = goldNum = silverNum = bronzeNum = susNum = 0
  auraNodes = {};
  auraLinks = {};

  nodes.forEach((n) => {
    // Skip if node data doesn't exist in the main graph, it happens for the newly joined nodes to the BrightID.
    if (!(n.id in allNodes)) {
      return;
    }

    auraNodes[n.id] = Object.assign(allNodes[n.id], n);

    allNum += 1;
    if (n.aura_level == "Gold") goldNum += 1;
    else if (n.aura_level == "Silver") silverNum += 1;
    else if (n.aura_level == "Bronze") bronzeNum += 1;
    else if (n.aura_level == "Sus") susNum += 1;
  });

  let energies = [];
  links.forEach((l) => {
    if (l.energy > 0) {
      energies.push(l.energy);
    }
  });
  let maxEnergy = Math.max(...energies);
  let minEnergy = Math.min(...energies);

  links.forEach((l) => {
    if (!(l.source in allNodes) || !(l.target in allNodes)) {
      return;
    }

    auraLinks[`${l.source}:${l.target}`] = l;
    auraLinks[`${l.source}:${l.target}`]["honestyWidth"] =
      ((parseFloat(l.honesty) - 0) * (5 - 1)) / (4 - 0) + 1;
    if (l.energy > 0) {
      auraLinks[`${l.source}:${l.target}`]["energyWidth"] =
        ((l.energy - minEnergy) * (5 - 2)) / (maxEnergy - minEnergy) + 2;
    }
  });

  const honesties = [];
  energies = [];
  Object.values(auraNodes).forEach((n) => {
    if (n.inHonesty != 0) {
      honesties.push(n.inHonesty);
    }
    if (n.energy != 0) {
      energies.push(n.energy);
    }
  });

  const maxHonesty = Math.max(...honesties);
  const minHonesty = Math.min(...honesties);

  maxEnergy = Math.max(...energies);
  minEnergy = Math.min(...energies);

  Object.values(auraNodes).forEach((n) => {
    auraNodes[n.id]["honestyVal"] =
      ((n.inHonesty - minHonesty) * (10 - 1)) / (maxHonesty - minHonesty) + 1;

    auraNodes[n.id] = Object.assign(auraNodes[n.id], {
      honestyVal:
        ((n.inHonesty - minHonesty) * (10 - 1)) / (maxHonesty - minHonesty) + 1,
      aColor: resetAuraNodesColor(n),
      energyVal:
        ((n.energy - minEnergy) * (10 - 2)) / (maxEnergy - minEnergy) + 2,
    });
  });
}

async function drawAura(fname) {
  prepare();

  if ((await localforage.getItem("brightid_has_imported")) && !autoLoginDone) {
    await loadPersonalData();
  }

  await getAuraData(fname);
  $("#goldNum").html(goldNum);
  $("#silverNum").html(silverNum);
  $("#bronzeNum").html(bronzeNum);
  $("#susNum").html(susNum);
  $("#allNum").html(allNum);

  await drawAuraGraph(auraNodes, auraLinks);
}

function resetAuraNodesColor(n) {
  if (n.aura_level == "Gold") return gold;
  if (n.aura_level == "Silver") return silver;
  if (n.aura_level == "Bronze") return bronze;
  if (n.aura_level == "Sus") return red;
  return gray;
}

function resetAuraNodesVal(n) {
  if (auraGraphView.honesty && auraGraphView.energy) {
    return n.energyVal > 0 ? n.energyVal : 1;
  }
  if (auraGraphView.honesty) return n.honestyVal;
  if (auraGraphView.energy) return n.energyVal;
}

function resetAuraNodesLabel(n) {
  let label = `${allNodes[n.id]?.name || formatId(n.id)}`;
  label += `<br/>level: ${n.aura_level || "_"} <br/> score: ${parseInt(
    n.aura_score || 0
  ).toLocaleString("en-US")}`;
  if (auraGraphView.energy) {
    label += `<br/>energy: ${parseInt(n.energy || 0).toLocaleString(
      "en-US"
    )} (${n.inEnergyNum} ⬋ / ${n.outEnergyNum} ⬈)`;
  }
  if (auraGraphView.honesty) {
    label += `<br/>honesty: ${n.inHonesty || 0} (${n.inHonestyNum} ⬋ / ${
      n.outHonestyNum
    } ⬈)`;
  }
  return label;
}

function resetAuraLinksColor(l) {
  if (auraGraphView.honesty && auraGraphView.energy) {
    return l.energy > 0 ? energyLinkColor : honestyLinkColor;
  }
  if (auraGraphView.honesty) return honestyLinkColor;
  if (auraGraphView.energy) return energyLinkColor;
}

function resetAuraLinksWidth(l) {
  if (auraGraphView.honesty && auraGraphView.energy) {
    return l.energyWidth > 0 ? l.energyWidth : 1;
  }
  if (auraGraphView.honesty) return l.honestyWidth;
  if (auraGraphView.energy) return l.energyWidth;
}

function resetAuraLinksLabel(l) {
  let label = "";
  const source = allNodes[l.source.id]?.name || formatId(l.source.id);
  const target = allNodes[l.target.id]?.name || formatId(l.target.id);

  label += `${source} -> ${target}`;
  if (auraGraphView.energy) {
    label += ` energy: ${parseInt(l.energy || 0).toLocaleString("en-US")} (${
      l.allocation || 0
    }%)`;
  }
  if (auraGraphView.honesty) {
    label += ` honesty: ${l.honesty || 0}`;
  }

  if (auraLinkDirection.incoming && auraLinkDirection.outgoing) {
    const rl = auraLinks[`${l.target.id}:${l.source.id}`];
    if (rl) {
      label += `<br/>${target} -> ${source}`;
      if (auraGraphView.energy) {
        label += ` energy: ${parseInt(rl.energy || 0).toLocaleString(
          "en-US"
        )} (${rl.allocation || 0}%)`;
      }
      if (auraGraphView.honesty) {
        label += ` honesty: ${rl.honesty || 0}`;
      }
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
      selectAuraNode(node, true);
    })
    .onBackgroundClick((evt) => {
      if (evt.shiftKey) {
        Graph.pauseAnimation();
        const p = Graph.screen2GraphCoords(evt.layerX, evt.layerY);
        var rect = document.getElementById("graphDiv").getBoundingClientRect();
        drawCoordinates(p.x, p.y, 5 / Graph.zoom() ** 0.5);
        areaPoints.push([p.x, p.y]);
        return;
      }

      for (const id in graphNodes) {
        graphNodes[id].selected = false;
      }
      selectedNode = undefined;
      Graph.nodeColor(resetAuraNodesColor)
        .linkVisibility(true)
        .linkColor(resetAuraLinksColor)
        .linkWidth(resetAuraLinksWidth)
        .linkLabel(resetAuraLinksLabel)
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
    .onEngineStop(async () => {
      const req = new URL(window.location);
      const centerUser = req.searchParams.get("u");
      if (!FocusedOnCenterNode && centerUser) {
        selectAuraNode(graphNodes[centerUser], true, true);
        FocusedOnCenterNode = true;
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
  $("#ratingLinks").css("color", auraGraphView.honesty ? "black" : "#d49a9a");
  $("#energyLinks").css("color", auraGraphView.energy ? "black" : "#d49a9a");

  const nodes = {};
  const links = {};

  for (const key in auraLinks) {
    const l = auraLinks[key];
    if (auraGraphView.energy && l.energy) {
      links[key] = l;
      nodes[l.source.id] = auraNodes[l.source.id];
      nodes[l.target.id] = auraNodes[l.target.id];
    }

    if (auraGraphView.honesty && l.honesty) {
      links[key] = l;
      nodes[l.source.id] = auraNodes[l.source.id];
      nodes[l.target.id] = auraNodes[l.target.id];
    }
  }

  await drawAuraGraph(nodes, links);
}

async function selectAuraLinkDirection(type) {
  auraLinkDirection[type] = !auraLinkDirection[type];
  $("#incomingLink").css(
    "color",
    auraLinkDirection.incoming ? "black" : "#d49a9a"
  );
  $("#outgoingLink").css(
    "color",
    auraLinkDirection.outgoing ? "black" : "#d49a9a"
  );

  if (selectedNode) {
    selectAuraNode(selectedNode, true);
  }
}
