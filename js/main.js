var selectedLinkWidth = 0.4;
var linkWidth = 0.3;
var arrowLength = 4;
var fadedColor = "rgba(204, 204, 204, 1)";
var selectedNode = undefined;
var autoLoginDone = false;
var groups = {};
var regions = {};
var mainGraph = true;
var playerSettingChanged = false;
var playerState = "stopped";
var playerSettingChangedSI = false;
var PlayerStateSI = "stopped";
var mode3D = false;
var allNodes = {};
var allLinks = {};
var graphNodes = {};
var graphLinks = [];
var Graph;
var positions = { "status": "", "2d": {}, "3d": {} };

var areaPoints = [];
$(document).keyup(function (e) {
  if (e.keyCode != 17) {
    return;
  };
  // clear area points from canvas
  Graph.zoom(Graph.zoom());
  const nodes = [];
  for (const id in allNodes) {
    if (inside([allNodes[id].x, allNodes[id].y], areaPoints)) {
      nodes.push(id);
    }
  }
  if (nodes.length > 0) {
    selectNodes(nodes);
  }
  areaPoints = [];
})

function showUser() {
  const node = allNodes[$("#seedConnected").val()];
  selectNode(node, true);
}

function showMember() {
  const node = allNodes[$("#members").val()];
  selectNode(node, true);
}

function selectNeighbor() {
  const node = allNodes[$("#neighbors").val()];
  selectNode(node, true, true);
}

function showNeighborDetails() {
  const node = allNodes[$("#neighbors").val()];
  const fData = selectedNode.neighbors[node.id]["from"].length > 0 ? selectedNode.neighbors[node.id]["from"][selectedNode.neighbors[node.id]["from"].length - 1] : ["__", "__"];
  const tData = selectedNode.neighbors[node.id]["to"].length > 0 ? selectedNode.neighbors[node.id]["to"][selectedNode.neighbors[node.id]["to"].length - 1] : ["__", "__"];
  $("#neighbor").html(node.id);
  const outboundTime = new Date(tData[0]).toJSON().split(".")[0].replace("T", " ");
  const inboundTime = new Date(fData[0]).toJSON().split(".")[0].replace("T", " ");
  $("#outboundLevel").html(tData[1]);
  $("#outboundTime").html(outboundTime);
  $("#inboundLevel").html(fData[1]);
  $("#inboundTime").html(inboundTime);
  $("#neighborContainer").show();
  move(node.x, node.y, 1.2);
}

function showGroup() {
  selectGroup($("#groups").val(), true);
}

function selectGroup(id, showDetails) {
  $("#groupQuotaContainer").hide();
  $("#groupNameContainer").hide();
  $("#groupSeedConnectedDiv").hide();
  $("#groupDetailsPlaceHolder").hide();
  $("#groupDetailsContent").show();

  $("#groupIdText").html(id);
  $("#groupIdField").val(id);

  const group = groups[id];
  if (!mainGraph && !group.seed) {
    drawGraph();
    mainGraph = true;
  }

  if (!group.seed) {
    Graph.linkColor(fadedColor);
    Graph.nodeColor(n => group.members.includes(n.id) ? resetNodesColor(n) : fadedColor);
  }

  if (group.region || group.name) {
    $("#groupName").html(group.region || group.name);
    $("#groupNameContainer").show();
  }

  if (group.img && group.img.src && group.img.src.includes("base64")) {
    $("#groupImg").attr("src", group.img.src);
  } else {
    $("#groupImg").attr("src", "");
  }

  const subgraphNodes = {};
  const subgraphLinks = [];
  $("#groupMembersCount").html(group.members.length);
  $("#members").empty().append(new Option("", "none"));
  for (const member of group.members) {
    $("#members").append(new Option(allNodes[member].name || member, member));
    subgraphNodes[member] = allNodes[member];
  }

  if (group.seedConnected.length > 0) {
    $("#seedConectedCount").html(group.seedConnected.length);
    $("#seedConnected").empty().append(new Option("", "none"));
    for (const u of group.seedConnected) {
      $("#seedConnected").append(new Option(allNodes[u].name || u, u));
      subgraphNodes[u] = allNodes[u];
    }
    $("#groupSeedConnectedDiv").show();
    for (const link of graphLinks) {
      if (link.source.id in subgraphNodes && link.target.id in subgraphNodes) {
        subgraphLinks.push(link);
      }
    }
  }

  if (group.seed) {
    mainGraph = false;
    $("#groupQuota").html(group.quota);
    $("#groupQuotaContainer").show();
    drawSubgraph(Object.values(subgraphNodes), subgraphLinks);
  }

  if (showDetails) {
    openCollapsible("groupDetails", true);
  }

  if (!group.seed) {
    let sumX = 0;
    let sumY = 0;
    for (const member of group.members) {
      sumX += allNodes[member].x;
      sumY += allNodes[member].y;
    }
    const n = group.members.length;
    move(sumX / n, sumY / n, .2);
  }
}

function selectVerification(verification) {
  const verifieds = new Set();
  for (const id in allNodes) {
    if (verification in allNodes[id].verifications) {
      verifieds.add(id);
    }
  }
  Graph.nodeColor(n => verifieds.has(n.id) ? "green" : "yellow");
}

function selectRegion(name) {
  if (name == "Complete Graph") {
    const centerNode = allNodes["AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA"];
    Graph.nodeColor(resetNodesColor);
    Graph.linkColor(resetLinksColor);
    return move(centerNode.x, centerNode.y, 0.7);
  }
  if (regions[name].length == 1 && groups[regions[name][0]]) {
    selectGroup(regions[name][0], true);
  } else {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    const members = [];
    for (const id of regions[name]) {
      if (allNodes[id]) {
        members.push(id);
      } else if (groups[id]) {
        for (const member of groups[id].members) {
          members.push(member);
        }
      }
    }
    for (const id of members) {
      sumX += allNodes[id].x;
      sumY += allNodes[id].y;
    }
    Graph.nodeColor(n => members.includes(n.id) ? resetNodesColor(n) : fadedColor);
    Graph.linkColor(fadedColor);
    const n = members.length;
    move(sumX / n, sumY / n, 1.2);
  }
}

function getGroupName(group) {
  return groups[group]?.region || groups[group]?.name || group;
}

function getConnText(neighbor, fData, tData) {
  if (fData[0] && tData[0]) {
    if (Math.abs(fData[0] - tData[0]) > 15 * 60 * 1000) {
      connTime = `${new Date(fData[0]).toJSON().split(".")[0].replace("T", " ")} | ${new Date(tData[0]).toJSON().split(".")[0].replace("T", " ")}`
    } else {
      connTime = new Date(fData[0]).toJSON().split(".")[0].replace("T", " ");
    }
  } else {
    connTime = new Date(fData[0] || tData[0]).toJSON().split(".")[0].replace("T", " ");
  }
  if (fData[1]) {
    if (fData[1] == "reported") {
      fLevel = "reported";
    } else {
      fLevel = fData[1][0].toUpperCase();
    }
  } else {
    fLevel = "_"
  }
  if (tData[1]) {
    if (tData[1] == "reported") {
      tLevel = "reported";
    } else {
      tLevel = tData[1][0].toUpperCase();
    }
  } else {
    tLevel = "_"
  }
  let text = `${allNodes[neighbor]?.name || neighbor} | ${tLevel} | ${fLevel} | ${connTime}`
  if (allNodes[neighbor].node_type == "Seed") {
    text = `* ${text}`;
  }
  return text;
}

function selectNodes(nodes) {
  $("#userDetailsContent").show();
  $("#seedData").hide();
  $("#userNameContainer").hide();
  $("#userRecoveryContainer").hide();
  $("#userDetailsPlaceHolder").hide();
  $("#neighborsContainer").hide();
  $("#neighborContainer").hide();
  const selectedNodesText = nodes.join("\n");
  console.log('$$$', selectedNodesText)
  navigator.clipboard.writeText(selectedNodesText).then(function() {
    console.log('The selected nodes copying to clipboard was successful!');
  }, function(err) {
    console.error('Async: Could not copy text: ', err);
  });

  const highlightNodes = new Set();
  nodes.forEach(id => {
    highlightNodes.add(id);
    const node = allNodes[id];
    Object.keys(node.neighbors).forEach(n1 => {
      const tLevel = node.neighbors[n1]["to"].length > 0 ? node.neighbors[n1]["to"][node.neighbors[n1]["to"].length - 1][1] : null
      const fLevel = node.neighbors[n1]["from"].length > 0 ? node.neighbors[n1]["from"][node.neighbors[n1]["from"].length - 1][1] : null
      if (!selectedLevels.includes(tLevel) || !selectedLevels.includes(fLevel)) {
        return;
      }
      highlightNodes.add(n1);
    });
  });

  const highlightLinks = new Set();
  graphLinks.forEach(l => {
    if (!nodes.includes(l.source.id) && !nodes.includes(l.target.id)) {
      return;
    }
    if (highlightNodes.has(l.source.id) && highlightNodes.has(l.target.id)) {
      highlightLinks.add(l);
    }
  });

  Graph.linkVisibility(l => (highlightLinks.has(l) ? true : false))
    .nodeColor(n => highlightNodes.has(n.id) ? resetNodesColor(n) : fadedColor)
    .linkDirectionalArrowLength(l => highlightLinks.has(l) ? 6 : 2)
    .linkColor(l => highlightLinks.has(l) ? resetLinksColor(l) : fadedColor);
}

function selectNode(node, showDetails, focus) {
  $("#userDetailsContent").show();
  $("#seedData").hide();
  $("#userNameContainer").hide();
  $("#userRecoveryContainer").hide();
  $("#userDetailsPlaceHolder").hide();
  $("#neighborsContainer").hide();
  $("#neighborContainer").hide();

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

  if (node.node_type == "Seed") {
    $("#quotaValue").html(node.quota);
    $("#noSeedGroups").html(node.seed_groups.length);
    $("#seedData").show();
  }

  if (node.name) {
    $("#userName").html(node.name);
    $("#userNameContainer").show();
  }

  $("#userImage").attr("src", node?.img?.src || "");
  const neighborsCount = Object.keys(node.neighbors).length;
  if (neighborsCount > 0) {
    $("#neighborsCount").html(neighborsCount);
    $("#neighbors").empty().append(new Option("", "none"));
    $("#neighborsHistory").empty().append(new Option("", "none"));
    const allNeighbors = []
    Object.keys(node.neighbors).forEach(n => {
      const fData = node.neighbors[n]["from"].length > 0 ? node.neighbors[n]["from"][node.neighbors[n]["from"].length - 1] : [null, null];
      const tData = node.neighbors[n]["to"].length > 0 ? node.neighbors[n]["to"][node.neighbors[n]["to"].length - 1] : [null, null];
      const connText = getConnText(n, fData, tData);
      $("#neighbors").append(new Option(connText, n));
      for (const nf of node.neighbors[n]["from"]) {
        allNeighbors.push([...nf, "in", n]);
      }
      for (const nt of node.neighbors[n]["to"]) {
        allNeighbors.push([...nt, "out", n]);
      }
    });
    allNeighbors.sort((a, b) => a[0] - b[0] );
    for (const n2 of allNeighbors) {
      const text = `${allNodes[n2[3]]?.name || n2[3]} | ${n2[2]} | ${n2[1] == "reported" ? "reported" : n2[1][0].toUpperCase()} | ${new Date(n2[0]).toJSON().split(".")[0].replace("T", " ")}`
      $("#neighborsHistory").append(new Option(text, n2[3]));
    }
    $("#neighborsContainer").show();
    $("#neighborsHistoryContainer").show();
  }

  // if (node.statistics.recoveries.length > 0) {
  //   $("#userRecoveries").empty();
  //   node.statistics.recoveries.forEach((tid) => {
  //     const text = allNodes[tid]?.name || tid;
  //     $('<li class="text-white" style="font-size: 12px;">').text(text).appendTo("#userRecoveries");
  //   });
  //   $("#userRecoveryContainer").show();
  // }

  let verificationsString = "";
  for (const name in node.verifications) {
    if (node.verifications[name].app) {
      continue;
    }
    const details = [];
    for (let [key, value] of Object.entries(node.verifications[name])) {
      if (["timestamp", "hash", "block"].includes(key)) {
        continue;
      } else if (!value && key == "friend") {
        continue;
      } else if (["reported", "connected"].includes(key) && value.length == 0) {
        continue;
      } else if (key == "connected") {
        const seedGroups = [];
        for (const groupId of value) {
          seedGroups.push(groups[groupId].region ? groups[groupId].region : groupId);
        }
        value = seedGroups.join(", ");
      } else if (key == "reported") {
        const seedGroups = [];
        for (const groupId of value) {
          seedGroups.push(groups[groupId].region ? groups[groupId].region : groupId);
        }
        value = seedGroups.join(", ");
      } else if (key == "raw_rank") {
        value = value.toFixed(2);
      }
      details.push(`${key}: ${value}`);
    }
    verificationsString += `<b>${name}</b> ${details.join(", ")}<br/>`;
  }
  $("#verifications").html(verificationsString);

  $("#groups").empty().append(new Option("", "none"));
  $("#groupsCount").html(node.groups.length);
  for (const group of node.groups) {
    $("#groups").append(new Option(getGroupName(group), group));
  }

  const highlightNodes = new Set([node.id]);

  Object.keys(node.neighbors).forEach(n1 => {
    const tLevel = node.neighbors[n1]["to"].length > 0 ? node.neighbors[n1]["to"][node.neighbors[n1]["to"].length - 1][1] : null
    const fLevel = node.neighbors[n1]["from"].length > 0 ? node.neighbors[n1]["from"][node.neighbors[n1]["from"].length - 1][1] : null
    if (!selectedLevels.includes("just met")) {
      if (!selectedLevels.includes(fLevel) || !selectedLevels.includes(tLevel)) {
        return;
      }
    } else {
      if (!selectedLevels.includes(fLevel) && !selectedLevels.includes(tLevel)) {
        return;
      }
    }
    highlightNodes.add(n1);
  });

  const highlightLinks = new Set();
  graphLinks.forEach(l => {
    if (l.source.id != node.id && l.target.id != node.id) {
      return;
    }
    if (highlightNodes.has(l.source.id) && highlightNodes.has(l.target.id)) {
      highlightLinks.add(l);
    }
  });
  Graph.linkVisibility(l => (highlightLinks.has(l) ? true : false));
  Graph.linkColor(n => highlightLinks.has(l) ? resetLinksColor(l) : fadedColor)

  Graph.nodeColor(n => highlightNodes.has(n.id) ? resetNodesColor(n) : fadedColor)
    .linkDirectionalArrowLength(l => highlightLinks.has(l) ? arrowLength : 1)
    .linkColor(l => highlightLinks.has(l) ? resetLinksColor(l) : fadedColor);

  if (showDetails) {
    openCollapsible("userDetails", true);
  }

  if (focus === undefined || focus === true) {
    move(node.x, node.y, 1.2);
  }
}

function updateStatistics() {
  const graphData = Graph.graphData()
  let numVerifieds = numSeeds = 0;
  graphData.nodes.forEach((node) => {
    if (node.verifications && "BrightID" in node.verifications) {
      numVerifieds++;
    }
    if (node.node_type == "Seed") {
      numSeeds++;
    }
  });
  $("#numNodes").html(graphData.nodes.length);
  $("#numVerifieds").html(numVerifieds);
  $("#numSeeds").html(numSeeds);
  $("#averageConnection").html(Math.ceil(graphData.links.length / graphData.nodes.length));
}

$(document).ready(function () {
  // $("#loadingoverlay").fadeIn();
  // let dataFileAddr;
  // let location2dFileAddr;
  // const req = new URL(window.location);
  // const folderName = req.searchParams.get('d');
  // if (folderName) {
  //   if (folderName == "last") {
  //     dataFileAddr = `/history/brightid.json.gz`;
  //     location2dFileAddr = `/history/positions2d.json`;
  //   } else {
  //     dataFileAddr = `/history/${folderName}/brightid.json.gz`;
  //     location2dFileAddr = `/history/${folderName}/positions2d.json`;
  //   }
  // } else {
  //   dataFileAddr = "brightid.json";
  //   location2dFileAddr = "positions2d.json";
  // }

  // $.get(location2dFileAddr, function (data) {
  //   positions["2d"] = data;
  // });

  // $.get("positions3d.json", function (data) {
  //   positions["3d"] = data;
  // });

  // $.get(dataFileAddr, function (data) {
  //   // data = JSON.parse(data);
  //   data.links.forEach(l => {
  //     allLinks[`${l.source}${l.target}`] = l;
  //   });
  //   data.groups.forEach(group => {
  //     groups[group.id] = { ...group, members: [], seedConnected: [] };
  //     const region = group.region;
  //     if (region) {
  //       if (!(region in regions)) {
  //         regions[region] = [];
  //       }
  //       if (!regions[region].includes(group.id)) {
  //         regions[region].push(group.id);
  //         $("#searchFieldRegions").append(new Option(region, region));
  //       }
  //     }
  //   });

  //   data.nodes.forEach(node => {
  //     node.neighbors = {};
  //     node.statistics = data.users_statistics[node.id];
  //     allNodes[node.id] = node;

  //     node.groups.forEach(group => groups[group].members.push(node.id));
  //     if (node.verifications.SeedConnected) {
  //       for (const sg of node.verifications.SeedConnected.connected) {
  //         groups[sg].seedConnected.push(node.id);
  //       }
  //     }
  //   });

  //   Object.values(allLinks).forEach(l => {
  //     if (!(l.target in allNodes[l.source].neighbors)) {
  //       allNodes[l.source].neighbors[l.target] = { "from": [], "to": [] };
  //     }
  //     if (!(l.source in allNodes[l.target].neighbors)) {
  //       allNodes[l.target].neighbors[l.source] = { "from": [], "to": [] };
  //     }
  //     for (h of l["history"]) {
  //       allNodes[l.source].neighbors[l.target]["to"].push(h);
  //       allNodes[l.target].neighbors[l.source]["from"].push(h);
  //     }
  //   });
  //   drawGraph();
  //   $("#loadingoverlay").fadeOut();
  // });

  // $("#searchField").change(function () {
  //   const val = $("#searchField").val();
  //   if (!val) {
  //     return;
  //   }
  //   const id = val.trim();
  //   if (["BrightID", "markaz", "SeedConnected", "DollarForEveryone", "SocialRecoverySetup"].includes(id)) {
  //     selectVerification(id);
  //   } else if (allNodes[id]) {
  //     selectNode(allNodes[id], true);
  //   } else if (groups[id]) {
  //     selectGroup(id, true);
  //   } else if (regions[id] || id == "Complete Graph") {
  //     selectRegion(id);
  //   } else {
  //     return;
  //   }
  // });

  // $("#groups").change(function () {
  //   const id = $(this).val();
  //   selectGroup(id, false);
  // });

  // $("#members").change(function () {
  //   const id = $(this).val();
  //   selectNode(allNodes[id], false);
  // });

  // $("#seedConnected").change(function () {
  //   const id = $(this).val();
  //   selectNode(allNodes[id], false);
  // });

  // $("#logoutBtn").click(() => {
  //   localforage.clear().then(() => {
  //     location.reload();
  //   });
  // });
  // $("#login").click(loadInfo);
  // $("#showGroup").click(showGroup);
  // $("#showMember").click(showMember);
  // $("#showUser").click(showUser);
  // $("#searchField").select2({ tags: true });
  // $("#dateRange").change(setDateRange);
  // $("#fromDate").change(() => playerSettingChanged = true);
  // $("#toDate").change(() => playerSettingChanged = true);
  // $("#delay").change(() => playerSettingChanged = true);
  // $("#playBtn").click(playBtnUI);
  // $("#stopBtn").click(stopBtnUI);
  // $("#previousBtn").click(previousBtnUI);
  // $("#nextBtn").click(nextBtnUI);
  // $("#drawSubgraphBtn").click(subgraphBtnUI);
  // $("#dateRangeSI").change(setDateRangeSI);
  // $("#fromDateSI").change(() => playerSettingChangedSI = true);
  // $("#toDateSI").change(() => playerSettingChangedSI = true);
  // $("#delaySI").change(() => playerSettingChangedSI = true);
  // $("#playBtnSI").click(playBtnSI);
  // $("#stopBtnSI").click(stopBtnSI);
  // $("#previousBtnSI").click(previousBtnSI);
  // $("#nextBtnSI").click(nextBtnSI);
  // $("#resetBtn").click(() => {
  //   $("#3dBtn").prop("checked", false);
  //   $("#levelsRange").val(3);
  //   $("#connectionLevel").html("Already Known");
  //   stopBtnSI();
  //   stopBtnUI();
  // });
  // $("#selectNeighbor").click(selectNeighbor)
  // $("#neighbors").change(showNeighborDetails);
  // $("#3dBtn").click(drawGraph);
  // $("#levelsRange").change(() => {
  //   const levelIndex = $("#levelsRange").val();
  //   const connectionLevels = ["Suspicious", "Just Met", "Filtered", "Already Known", "Recovery"];
  //   $("#connectionLevel").html(connectionLevels[levelIndex]);
  // });
  // $("#drawGustomGraph").click(drawGraph);
  // $("#linkVisibility").change(() => {
  //   if ($("#linkVisibility").is(":checked")) {
  //     Graph.linkVisibility(true).linkDirectionalArrowLength(2).linkWidth(.1).nodeVal(15);
  //   } else {
  //     Graph.linkVisibility(false);
  //   }
  // });
});