const gold = "#FFD700";
const silver = "#A6ACAF";
const bronze = "#CD7F32";
const red = "#FF0000";
const gray = "#BB8FCE";
const honestyLinkColor = "orange";
const energyLinkColor = "blue";
var aura;
var auraComments = {};

const auraGraphView = { honesty: true, energy: true };
const auraLinkDirection = { incoming: true, outgoing: true };
var allNum = (goldNum = silverNum = bronzeNum = susNum = unverifiedNum = 0);

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
    `<li><a href="#" id="ratingLinks" onclick="selectAuraView('honesty')" class="legend-link text-dark"><span style="background:${honestyLinkColor};"></span>honesty</a></li>`
  ).appendTo("#legendLinks");
  $(
    `<li><a href="#" id="energyLinks" onclick="selectAuraView('energy')" class="legend-link text-dark"><span style="background:${energyLinkColor};"></span>energy transfer</a></li>`
  ).appendTo("#legendLinks");

  $("#legendDirectionContainar").show();
  $("#legendDirection").empty();
  $(
    `<li><a href="#" id="incomingLink" onclick="selectAuraLinkDirection('incoming')" class="legend-link text-dark"><span style="background:yellow;">⬋</span> incoming</a></li>`
  ).appendTo("#legendDirection");
  $(
    `<li><a href="#" id="outgoingLink" onclick="selectAuraLinkDirection('outgoing')" class="legend-link text-dark"><span style="background:yellow;">⬈</span> outgoing</a></li>`
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
  $("#auraleaderboardbtntitle").show();
}

function selectAuraNode(node, showDetails, focus) {
  if (node in graphNodes) {
    node = graphNodes[node];
  }
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

  loadUserComments(node.id);

  $("#auraStatistics").show();
  $("#auraConnectionsContainer").show();
  $("#connectionsStatistics").show();
  $("#userCommentsContainar").show();

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

  if (showDetails) {
    openCollapsible("userDetails", true);
  }
  if (focus) {
    move(node.x, node.y, 1.2);
  }
}

function strToUint8Array(str) {
  if (!("TextEncoder" in window)) {
    alert("Error!", "Sorry, this browser does not support TextEncoder...");
  }
  var enc = new TextEncoder();
  return enc.encode(str);
}

async function selectAuraNodes(nodes, openCommentForm = false) {
  selectedNodes = nodes;
  $("#userDetailsContent").show();
  $("#seedData").hide();
  $("#userNameContainer").hide();
  $("#userRecoveryContainer").hide();
  $("#userDetailsPlaceHolder").hide();
  $("#neighborsContainer").hide();
  $("#neighborContainer").hide();

  const highlightNodes = new Set();
  let sumX = 0;
  let sumY = 0;
  nodes.forEach((id) => {
    highlightNodes.add(id);
    const node = allNodes[id];
    sumX += node.x;
    sumY += node.y;
  });

  const highlightLinks = new Set();
  Object.values(auraLinks).forEach((l) => {
    if (highlightNodes.has(l.source.id) && highlightNodes.has(l.target.id)) {
      highlightLinks.add(l);
    }
  });

  const cneterX = Math.round(sumX / nodes.length);
  const cneterY = Math.round(sumY / nodes.length);
  Graph.linkVisibility((l) => (highlightLinks.has(l) ? true : false))
    .nodeColor((n) => {
      if (highlightNodes.has(n.id)) return resetAuraNodesColor(n);
      else return resetNodesColor(n, true);
    })
    .linkDirectionalArrowLength((l) => (highlightLinks.has(l) ? 6 : 2))
    .linkColor((l) =>
      highlightLinks.has(l) ? resetAuraLinksColor(l) : fadedColor
    )
    .centerAt(cneterX + 200, cneterY)
    .zoom(1.2, 1000);

  let authorized_user = false;
  if (await localforage.getItem("brightid_has_imported")) {
    const owner = await localforage.getItem("explorer_owner");
    if (auraNodes[owner]?.energy > 0) {
      authorized_user = true;
    }
  }

  if (openCommentForm & authorized_user) {
    openCommentModal(nodes.length);
  }
}

function LoadLeaderBoard() {
  $("#auraLeaderBoardTable tbody").empty();
  const nodesEnergy = {};
  Object.values(auraNodes).forEach((n) => {
    if (n.energy != 0) {
      nodesEnergy[n.id] = n.energy;
    }
  });

  const sortedNodesEnergy = Object.entries(nodesEnergy)
    .sort(([, a], [, b]) => b - a)
    .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

  $("#auraLeaderBoardTable tbody").append(
    `<tr><th>User</th><th>Energy</th></tr>`
  );

  Object.keys(sortedNodesEnergy).forEach((id) => {
    $("#auraLeaderBoardTable tbody").append(
      `<tr role="button" onclick="selectAuraNode('${id}', false, true)"><td>${
        allNodes[id]?.name || formatId(id)
      }</td><td>${parseInt(sortedNodesEnergy[id]).toLocaleString(
        "en-US"
      )}</td></tr>`
    );
  });
}

async function getAuraData(fileName) {
  const { nodes, links, comments } = await $.ajax({
    url: `./${fileName}.json`,
    cache: false,
  });

  allNum = goldNum = silverNum = bronzeNum = susNum = unverifiedNum = 0;
  auraNodes = {};
  auraLinks = {};

  comments.forEach((c) => {
    if (!c["mainCommentKey"]) {
      c["replies"] = [];
    }
    auraComments[c._key] = c;
  });
  comments.forEach((c) => {
    if (c["mainCommentKey"]) {
      auraComments[c["mainCommentKey"]]["replies"].push([c._key]);
    }
  });

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
    else unverifiedNum += 1;
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
      ((parseFloat(l.honesty) - 0) * (3 - 1)) / (4 - 0) + 1;
    if (l.energy > 0) {
      auraLinks[`${l.source}:${l.target}`]["energyWidth"] =
        ((l.energy - minEnergy) * (3 - 1)) / (maxEnergy - minEnergy) + 1;
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

async function drawAura(fileName) {
  aura = fileName;
  prepare();

  const brightid_has_imported = await localforage.getItem(
    "brightid_has_imported"
  );
  if (brightid_has_imported && !autoLoginDone) {
    await loadPersonalData();
  }

  await getAuraData(fileName);

  LoadLeaderBoard();

  const owner = await localforage.getItem("explorer_owner");
  if (brightid_has_imported & (auraNodes[owner]?.energy > 0)) {
    $("#auracommentsbtntitle").show();
  }

  $("#goldNum").html(goldNum);
  $("#goldQualifiedNum").html(goldNum);
  $("#silverNum").html(silverNum);
  $("#silverQualifiedNum").html(silverNum + goldNum);
  $("#bronzeNum").html(bronzeNum);
  $("#bronzeQualifiedNum").html(silverNum + goldNum + bronzeNum);
  $("#susNum").html(susNum);
  $("#unverifiedNum").html(unverifiedNum);
  $("#allNum").html(allNum);

  await loadComments();
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
  label += `<br/>energy: ${parseInt(n.energy || 0).toLocaleString("en-US")} (${
    n.inEnergyNum
  } ⬋ / ${n.outEnergyNum} ⬈)`;
  label += `<br/>honesty: ${n.inHonesty || 0} (${n.inHonestyNum} ⬋ / ${
    n.outHonestyNum
  } ⬈)`;
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
  label += ` energy: ${parseInt(l.energy || 0).toLocaleString("en-US")} (${
    l.allocation || 0
  }%)`;
  label += ` honesty: ${l.honesty || 0}`;

  if (auraLinkDirection.incoming && auraLinkDirection.outgoing) {
    const rl = auraLinks[`${l.target.id}:${l.source.id}`];
    if (rl) {
      label += `<br/>${target} -> ${source}`;
      label += ` energy: ${parseInt(rl.energy || 0).toLocaleString("en-US")} (${
        rl.allocation || 0
      }%)`;
      label += ` honesty: ${rl.honesty || 0}`;
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
    .backgroundColor(graphBg)
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
        Graph.enablePanInteraction(false);
        drawLasso();
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

function timestampToDate(timestamp) {
  var o = new Date(timestamp);
  var months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return o.getDate() + " " + months[o.getMonth()] + " " + o.getFullYear();
}

function openCommentModal(selectNodesLength) {
  $("#comment").val("");
  $("#commentCategorySeter").val("");
  $("#selectNodesLength").html(selectNodesLength);
  $("#addCommentModal").modal("show");
}

function openReplyModal(commentKey) {
  $("#replyComment").val("");
  const comment = auraComments[commentKey];
  domString = `
    <row class="main-comment">
      <span class="text-medium">${comment.comment}</span>
      <br>
      <span class="text-too-small">${
        allNodes[comment.user]?.name || formatId(comment.user)
      } (${timestampToDate(comment.timestamp)})</span>
      </span>
    </row>`;
  comment["replies"].forEach((k) => {
    const reply = auraComments[k];
    if (reply.user == comment.user) {
      domString += `
      <row class="chat mb-1">
        <span class="text-small">${reply.comment}</span>
        <br>
        <span class="text-too-small">${
          allNodes[reply.user]?.name || formatId(reply.user)
        } (${timestampToDate(reply.timestamp)})</span>
      </row>`;
    } else {
      domString += `
      <row class="chat-reply mb-1">
        <span class="text-small">${reply.comment}</span>
        <br>
        <span class="text-too-small">${
          allNodes[reply.user]?.name || formatId(reply.user)
        } (${timestampToDate(reply.timestamp)})</span>
      </row>`;
    }
  });
  $("#mainComment").html(domString);
  $("#mainCommentId").val(commentKey);
  $("#replyCommentModal").modal("show");
}

function replyComment() {
  const commentKey = $("#mainCommentId").val();
  addComment(commentKey);
}

async function addComment(mainCommentKey) {
  // should remove after test
  if (aura == "aura") {
    return alert(
      "Error!",
      "This feature is only available on the aura-test for now."
    );
    return;
  }

  let category, comment;
  if (mainCommentKey) {
    comment = $("#replyComment").val();
    const mainComment = auraComments[mainCommentKey];
    category = mainComment.category || "Old";
    selectedNodes = mainComment.nodes;
  } else {
    comment = $("#comment").val();
    category = $("#commentCategorySeter").val();
  }

  const user = await localforage.getItem("explorer_owner");
  let data = {
    user,
    comment,
    category,
    nodes: selectedNodes,
    aura,
  };
  if (mainCommentKey) {
    data["mainCommentKey"] = mainCommentKey;
  }
  data = sortObject(data);
  const message = strToUint8Array(JSON.stringify(data));
  const secretKey = await localforage.getItem("explorer_sk");
  const sig = base64js.fromByteArray(nacl.sign.detached(message, secretKey));
  data["signing_key"] = await localforage.getItem("explorer_signing_key");
  data["sig"] = sig;
  let request = $.ajax({
    type: "PUT",
    url: "/aura-api/comment",
    data: JSON.stringify(data),
    contentType: "application/json",
    success: async function (response, status, xhr) {
      let rsp = JSON.parse(response);
      if (rsp.status == 200) {
        if (mainCommentKey) {
          auraComments[mainCommentKey]["replies"].push(rsp._key);
        } else {
          data["replies"] = [];
        }
        data["_key"] = rsp._key;
        data["timestamp"] = Date.now();
        auraComments[rsp._key] = data;
        alert(
          "Info",
          "The request was successful and will apply in 5 minutes."
        );
        await loadComments();
      } else {
        console.log("Error!", rsp);
        alert("Error!", JSON.stringify(rsp.message));
      }
    },
    error: function (xhr, exception) {
      console.log("Error!", exception);
      alert("Error!", JSON.stringify(exception));
    },
    complete: function (response, status, xhr) {
      $("#addCommentModal").modal("hide");
      $("#replyCommentModal").modal("hide");
    },
  });
}

async function removeComment(commentKey) {
  let data = {
    user: await localforage.getItem("explorer_owner"),
    _key: commentKey,
    aura,
  };
  data = sortObject(data);
  const message = strToUint8Array(JSON.stringify(data));
  const secretKey = await localforage.getItem("explorer_sk");
  const sig = base64js.fromByteArray(nacl.sign.detached(message, secretKey));
  data["signing_key"] = await localforage.getItem("explorer_signing_key");
  data["sig"] = sig;
  let request = $.ajax({
    type: "DELETE",
    url: "/aura-api/comment",
    data: JSON.stringify(data),
    contentType: "application/json",
    success: async function (response, status, xhr) {
      let rsp = JSON.parse(response);
      if (rsp.status == 200) {
        delete auraComments[commentKey];
        await loadComments();
        alert(
          "Info",
          "The request was successful and will apply in 5 minutes."
        );
      } else {
        console.log("Error!", rsp);
        alert("Error!", JSON.stringify(rsp.message));
      }
    },
    error: function (xhr, exception) {
      console.log("Error!", exception);
      alert("Error!", JSON.stringify(exception));
    },
    complete: function (response, status, xhr) {
      $("#addCommentModal").modal("hide");
      $("#replyCommentModal").modal("hide");
    },
  });
}

async function loadComments(category) {
  $("#comments").empty();

  selectedComments = Object.values(auraComments).filter((c) => {
    if (!category || category == "All") {
      return "replies" in c;
    } else {
      return (c.category == category) & ("replies" in c);
    }
  });

  if (Object.keys(selectedComments).length == 0) {
    $("#comments").prepend(
      '<div class="carousel-item text-center text-small active" slide="1"><h3>No comment</h3></div>'
    );
    return;
  }

  const user = await localforage.getItem("explorer_owner");
  selectedComments.sort((a, b) => b.timestamp - a.timestamp);

  for (var i = 0; i < selectedComments.length; i++) {
    let c = selectedComments[i];

    domString = `
      <div class="carousel-item text-center text-small ${
        selectedComments[0]._key == c._key ? "active" : ""
      }" id="${c._key}" slide="${i}">
        <div class="input-group-sm comment-nodes-container">
          <select class="custom-select text-small" size="2" id="selectCommentNode">`;

    for (const n of c.nodes) {
      domString += `<option value="${n}">${
        allNodes[n]?.name || formatId(n)
      }</option>`;
    }
    domString += `
      </select>
        </div>
        <p>${c.comment}</p>
        <p class="text-too-small">${
          allNodes[c.user]?.name || formatId(c.user)
        } (${timestampToDate(c.timestamp)})</p>
        <p class="text-too-small">${c["replies"].length} ${
      c["replies"].length > 1 ? "replies" : "reply"
    }</p>`;
    domString += `
      <div class="d-flex justify-content-evenly">
        <button id="replyCommentBtn" class="btn btn-primary btn-sm" onclick="openReplyModal(${c._key})">Open</button>`;
    if (c.user == user) {
      domString += `
        <button id="removeCommentBtn" class="btn btn-primary btn-sm" onclick="removeComment(${c._key})">Remove</button>`;
    }
    domString += `</div></div>`;
    $("#comments").prepend(domString);
  }

  $("#commentsCarousel").bind("slide.bs.carousel", function (e) {
    const slide = e.relatedTarget.getAttribute("slide");
    selectAuraNodes(selectedComments[slide].nodes);
  });
}

async function loadUserComments(sn) {
  $("#userComments").empty();

  userComments = Object.values(auraComments).filter(
    (c) => ("replies" in c) & (c.user == sn || c.nodes.includes(sn))
  );

  if (Object.keys(userComments).length == 0) {
    $("#userComments").prepend(
      '<div class="carousel-item text-center text-small active" slide="1"><h3>No comment</h3></div>'
    );
    return;
  }

  const user = await localforage.getItem("explorer_owner");
  userComments.sort((a, b) => b.timestamp - a.timestamp);
  for (var i = 0; i < userComments.length; i++) {
    let c = userComments[i];
    domString = `
      <div class="carousel-item text-center text-small ${
        userComments[0]._key == c._key ? "active" : ""
      }" id="${c._key}" slide="${i}">
        <div class="input-group-sm comment-nodes-container">
          <select class="custom-select text-small" size="2" id="selectCommentNode">`;

    for (const n of c.nodes) {
      domString += `<option value="${n}">${
        allNodes[n]?.name || formatId(n)
      }</option>`;
    }
    domString += `
      </select>
        </div>
        <p>${c.comment}</p>
        <p class="text-too-small">${
          allNodes[c.user]?.name || formatId(c.user)
        } (${timestampToDate(c.timestamp)})</p>
        <p class="text-too-small">${c["replies"].length} ${
      c["replies"].length > 1 ? "replies" : "reply"
    }</p>`;
    domString += `
      <div class="d-flex justify-content-evenly">
        <button id="replyCommentBtn" class="btn btn-primary btn-sm" onclick="openReplyModal(${c._key})">Open</button>`;
    if (c.user == user) {
      domString += `
        <button id="removeCommentBtn" class="btn btn-primary btn-sm" onclick="removeComment(${c._key})">Remove</button>`;
    }
    domString += `</div></div>`;
    $("#userComments").prepend(domString);
  }

  $("#userCommentsCarousel").bind("slide.bs.carousel", function (e) {
    const slide = e.relatedTarget.getAttribute("slide");
    selectAuraNodes(userComments[slide].nodes);
  });
}
