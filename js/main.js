var linkWidth = 0.1;
var arrowLength = 2;
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
var positions = { status: "", "2d": {}, "3d": {} };
var selectedVerification = "Bitu";
var selectedLevels;
var boldMood = 0;
var auraMode = false;
var FocusedOnCenterNode = false;

var areaPoints = [];
$(document).keyup(function (e) {
  if (e.keyCode != 17) {
    return;
  }
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
});

$(document).keydown(function (e) {
  if (e.keyCode == 49 && e.shiftKey) {
    if ($("#linkVisibility").is(":checked")) {
      $("#linkVisibility").prop("checked", false);
      Graph.linkVisibility(false);
    } else {
      $("#linkVisibility").prop("checked", true);
      Graph.linkVisibility(true);
    }
  }
  if (e.keyCode == 50 && e.shiftKey) {
    boldMood = (boldMood += 1) % 3;
    Graph.nodeVal(resetNodesVal);
  }
});

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
  const fData =
    selectedNode.neighbors[node.id]["from"].length > 0
      ? selectedNode.neighbors[node.id]["from"][
          selectedNode.neighbors[node.id]["from"].length - 1
        ]
      : ["__", "__"];
  const tData =
    selectedNode.neighbors[node.id]["to"].length > 0
      ? selectedNode.neighbors[node.id]["to"][
          selectedNode.neighbors[node.id]["to"].length - 1
        ]
      : ["__", "__"];
  $("#neighbor").html(node.id);
  const outboundTime = new Date(tData[0])
    .toJSON()
    .split(".")[0]
    .replace("T", " ");
  const inboundTime = new Date(fData[0])
    .toJSON()
    .split(".")[0]
    .replace("T", " ");
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

function drawGroupSubgraph() {
  const id = $("#groupIdText").val();
  const subgraphData = getGroupGraphData(id);
  drawSubgraph(Object.values(subgraphData.nodes), subgraphData.links);
}

function getGroupGraphData(id) {
  const group = groups[id];
  const nodes = {};
  const links = [];
  for (const member of group.members) {
    nodes[member] = allNodes[member];
    Object.keys(allNodes[member].neighbors).forEach((n) => {
      if (n in graphNodes) {
        nodes[n] = allNodes[n];
      }
    });
  }
  for (const link of graphLinks) {
    if (link.source.id in nodes && link.target.id in nodes) {
      links.push(link);
    }
  }
  return { nodes, links };
}

function selectGroup(id, showDetails) {
  $("#groupQuotaContainer").hide();
  $("#groupNameContainer").hide();
  $("#groupSeedConnectedDiv").hide();
  $("#groupDetailsPlaceHolder").hide();
  $("#groupDetailsContent").show();

  $("#groupIdText").html(id);
  $("#groupIdText").val(id);
  $("#groupIdField").val(id);

  const group = groups[id];
  if (!mainGraph && !group.seed) {
    drawGraph();
    mainGraph = true;
  }

  if (group.seed) {
    $("#groupQuota").html(`${group.quota} / ${group.all_quota}`);
    $("#groupQuotaContainer").show();
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

  const subgraphData = getGroupGraphData(id);
  $("#groupMembersCount").html(group.members.length);
  $("#members").empty().append(new Option("", "none"));
  for (const member of group.members) {
    $("#members").append(new Option(allNodes[member].name || member, member));
  }
  if (group.seedConnected.length > 0) {
    $("#seedConectedCount").html(group.seedConnected.length);
    $("#seedConnected").empty().append(new Option("", "none"));
    for (const u of group.seedConnected) {
      $("#seedConnected").append(new Option(allNodes[u].name || u, u));
    }
    $("#groupSeedConnectedDiv").show();
  }

  Graph.nodeColor((n) => {
    if (group.members.includes(n.id)) return "blue";
    if (n.id in subgraphData.nodes) return "orange";
    return fadedColor;
  });

  Graph.linkColor((l) =>
    subgraphData.links.includes(l) ? resetLinksColor(l) : fadedColor
  );

  if (showDetails) {
    openCollapsible("groupDetails", true);
  }

  let sumX = 0;
  let sumY = 0;
  for (const member of group.members) {
    sumX += allNodes[member].x;
    sumY += allNodes[member].y;
  }
  const n = group.members.length;
  move(sumX / n, sumY / n, 0.5);
}

function selectVerification(verification) {
  selectedVerification = verification;
  Graph.nodeColor(resetNodesColor);
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
    Graph.nodeColor((n) =>
      members.includes(n.id) ? resetNodesColor(n) : resetNodesColor(n, true)
    );
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
      connTime = `${new Date(fData[0])
        .toJSON()
        .split(".")[0]
        .replace("T", " ")} | ${new Date(tData[0])
        .toJSON()
        .split(".")[0]
        .replace("T", " ")}`;
    } else {
      connTime = new Date(fData[0]).toJSON().split(".")[0].replace("T", " ");
    }
  } else {
    connTime = new Date(fData[0] || tData[0])
      .toJSON()
      .split(".")[0]
      .replace("T", " ");
  }
  if (fData[1]) {
    if (fData[1] == "reported") {
      fLevel = "reported";
    } else {
      fLevel = fData[1][0].toUpperCase();
    }
  } else {
    fLevel = "_";
  }
  if (tData[1]) {
    if (tData[1] == "reported") {
      tLevel = "reported";
    } else {
      tLevel = tData[1][0].toUpperCase();
    }
  } else {
    tLevel = "_";
  }
  let text = `${
    allNodes[neighbor]?.name || neighbor
  } | ${tLevel} | ${fLevel} | ${connTime}`;
  if (allNodes[neighbor].node_type == "Seed") {
    text = `🌱 ${text}`;
  }
  return text;
}

function addVerificationsTree(node) {
  let domString = "";
  for (const name in node.verifications) {
    if (node.verifications[name].app || node.verifications[name].expression) {
      continue;
    }
    domString += `<li><span class="caret">${name}</span><ul class="nested">`;
    for (let [key, value] of Object.entries(node.verifications[name])) {
      if (
        ["timestamp", "hash", "block", "communities", "releaseTime"].includes(
          key
        )
      ) {
        continue;
      } else if (!value && key == "friend") {
        continue;
      } else if (["reported", "connected"].includes(key) && value.length == 0) {
        continue;
      } else if (key == "connected") {
        domString += `<li><span class="caret">${key}</span><ul class="nested">`;
        for (const groupId of value) {
          domString += `<li>${groups[groupId].region || groupId}</li>`;
        }
        domString += "</ul></li>";
      } else if (key == "reported") {
        domString += `<li><span class="caret">${key}</span><ul class="nested">`;
        for (const groupId of value) {
          domString += `<li>${groups[groupId].region || groupId}</li>`;
        }
        domString += "</ul></li>";
      } else if (["directReports", "indirectReports"].includes(key)) {
        domString += `<li><span class="caret">${key}</span><ul class="nested">`;
        for (let k of Object.keys(value)) {
          domString += `<li>${allNodes[k].name || k}: ${value[k]}</li>`;
        }
        domString += "</ul></li>";
      } else if (key == "reportedConnections") {
        domString += `<li><span class="caret">${key}</span><ul class="nested">`;
        for (let k of Object.keys(value)) {
          domString += `<li><span class="caret">${
            allNodes[k].name || k
          }</span><ul class="nested">`;
          for (let v of value[k]) {
            domString += `<li>${allNodes[v].name || v}</li>`;
          }
          domString += "</ul></li>";
        }
        domString += "</ul></li>";
      } else {
        domString += `<li>${key}: ${value}</li>`;
      }
    }
    domString += "</ul></li>";
  }
  $("#verificationsTree").append(domString);
  var toggler = document.getElementsByClassName("caret");
  var i;
  for (i = 0; i < toggler.length; i++) {
    toggler[i].addEventListener("click", function () {
      this.parentElement.querySelector(".nested").classList.toggle("active");
      this.classList.toggle("caret-down");
    });
  }
}

function selectNode(node, showDetails, focus) {
  $("#userDetailsContent").show();
  $("#seedData").hide();
  $("#userNameContainer").hide();
  $("#userRecoveryContainer").hide();
  $("#userDetailsPlaceHolder").hide();
  $("#neighborsContainer").hide();
  $("#neighborContainer").hide();
  $("#verificationsTree").empty();

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
    const allNeighbors = [];
    Object.keys(node.neighbors).forEach((n) => {
      const fData =
        node.neighbors[n]["from"].length > 0
          ? node.neighbors[n]["from"][node.neighbors[n]["from"].length - 1]
          : [null, null];
      const tData =
        node.neighbors[n]["to"].length > 0
          ? node.neighbors[n]["to"][node.neighbors[n]["to"].length - 1]
          : [null, null];
      const connText = getConnText(n, fData, tData);
      $("#neighbors").append(new Option(connText, n));
      for (const nf of node.neighbors[n]["from"]) {
        allNeighbors.push([...nf, "in", n]);
      }
      for (const nt of node.neighbors[n]["to"]) {
        allNeighbors.push([...nt, "out", n]);
      }
    });
    allNeighbors.sort((a, b) => a[0] - b[0]);
    for (const n2 of allNeighbors) {
      const text = `${allNodes[n2[3]]?.name || n2[3]} | ${n2[2]} | ${
        n2[1] == "reported" ? "reported" : n2[1][0].toUpperCase()
      } | ${new Date(n2[0]).toJSON().split(".")[0].replace("T", " ")}`;
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

  addVerificationsTree(node);

  $("#groups").empty().append(new Option("", "none"));
  $("#groupsCount").html(node.groups.length);
  for (const group of node.groups) {
    $("#groups").append(new Option(getGroupName(group), group));
  }

  const highlightNodes = new Set([node.id]);

  Object.keys(node.neighbors).forEach((n1) => {
    const tLevel =
      node.neighbors[n1]["to"].length > 0
        ? node.neighbors[n1]["to"][node.neighbors[n1]["to"].length - 1][1]
        : null;
    const fLevel =
      node.neighbors[n1]["from"].length > 0
        ? node.neighbors[n1]["from"][node.neighbors[n1]["from"].length - 1][1]
        : null;
    if (!selectedLevels.includes("just met")) {
      if (
        !selectedLevels.includes(fLevel) ||
        !selectedLevels.includes(tLevel)
      ) {
        return;
      }
    } else {
      if (
        !selectedLevels.includes(fLevel) &&
        !selectedLevels.includes(tLevel)
      ) {
        return;
      }
    }
    highlightNodes.add(n1);
  });

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
    );

  if (showDetails) {
    openCollapsible("userDetails", true);
  }

  if (focus === undefined || focus === true) {
    move(node.x, node.y, 1.2);
  }
}

function updateStatistics() {
  let bituVerifieds =
    (bituVerifiedsHighScore =
    seedVerifieds =
    seedConnectedVerifieds =
    socialRecoverySetupVerifieds =
      0);
  Object.values(allNodes).forEach((node) => {
    if (node.verifications) {
      if ("Bitu" in node.verifications && node.verifications.Bitu.score > 0) {
        bituVerifieds++;
        if (node.verifications.Bitu.score >= 10) {
          bituVerifiedsHighScore++;
        }
      }
      if ("Seed" in node.verifications) {
        seedVerifieds++;
      }
      if ("SeedConnected" in node.verifications) {
        seedConnectedVerifieds++;
      }
      if ("SocialRecoverySetup" in node.verifications) {
        socialRecoverySetupVerifieds++;
      }
    }
  });
  const d = new Date(
    allNodes["AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA"]["verifications"][
      "Bitu"
    ]["releaseTime"]
  );
  const releaseDate = `${d.getDate()}/${d.getMonth() + 1}`;
  const nd = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextReleaseDate = `${nd.getDate()}/${nd.getMonth() + 1}`;
  $("#numNodes").html(Object.keys(allNodes).length);
  $("#bituVerifieds").html(bituVerifieds);
  $("#bituVerifiedsHighScore").html(bituVerifiedsHighScore);
  $("#releaseDate").html(releaseDate);
  $("#nextReleaseDate").html(nextReleaseDate);
  $("#seedVerifieds").html(seedVerifieds);
  $("#seedConnectedVerifieds").html(seedConnectedVerifieds);
  $("#socialRecoverySetupVerifieds").html(socialRecoverySetupVerifieds);
}

function alert(alertTitle, alertBody) {
  $("#alertTitle").html(alertTitle);
  $("#alertBody").html(alertBody);
  $("#alert").modal("show");
}

function updateLegend(index) {
  const connectionLevels = {
    suspicious: "red",
    "just met": "yellow",
    filtered: "gray",
    "already known": "orange",
    recovery: "blue",
  };
  const selectedLevels = Object.keys(connectionLevels).slice(index, 5);
  $("#legendLinks").empty();
  selectedLevels.forEach((level) => {
    $(
      `<li><span style="background:${connectionLevels[level]};"></span>${level}</li>`
    ).appendTo("#legendLinks");
  });
}

const accordion = {
  loginDetails: false,
  graphDetails: false,
  userDetails: false,
  groupDetails: false,
  statisticsDetails: false,
  userIllustratorDetails: false,
  starsIllustrator: false,
};
function openCollapsible(selectedId, reopen) {
  if ($("#wrapper").hasClass("toggled")) {
    $("#wrapper").removeClass("toggled");
    $("#menuToggleIcon").addClass("fa-times");
  }
  if (!accordion[selectedId]) {
    $(`#${selectedId}`).removeClass("hidden");
    accordion[selectedId] = true;
    Object.keys(accordion).forEach((id) => {
      if (id != selectedId) {
        $(`#${id}`).addClass("hidden");
        accordion[id] = false;
      }
    });
  } else if (accordion[selectedId] && !reopen) {
    $(`#${selectedId}`).addClass("hidden");
    accordion[selectedId] = false;
  }
}

function checkExpression(exprString) {
  const expr = exprEval.Parser.parse(exprString);
  const verifieds = [];
  for (let n of Object.values(graphNodes)) {
    try {
      if (expr.evaluate(n.verifications)) {
        verifieds.push(n.id);
      }
    } catch (err) {
      // console.log(err)
    }
  }
  if (verifieds.length > 0) {
    Graph.nodeColor((n) => (verifieds.includes(n.id) ? "blue" : "orange"));
    Graph.nodeVal((n) => (verifieds.includes(n.id) ? 20 ** 0.5 : 3 ** 0.5));
    alert("Info:", `There are ${verifieds.length} verified users`);
  }
  return;
}

$(document).ready(function () {
  $("#loadingoverlay").fadeIn();
  let dataFileAddr;
  let location2dFileAddr;
  const req = new URL(window.location);
  const folderName = req.searchParams.get("d");
  if (folderName) {
    if (folderName == "last") {
      dataFileAddr = `/history/brightid.json.gz`;
      location2dFileAddr = `/history/positions2d.json`;
    } else {
      dataFileAddr = `/history/${folderName}/brightid.json.gz`;
      location2dFileAddr = `/history/${folderName}/positions2d.json`;
    }
  } else {
    dataFileAddr = "brightid.json";
    location2dFileAddr = "positions2d.json";
  }

  $.get(location2dFileAddr, function (data) {
    positions["2d"] = data;
  });

  // $.get("positions3d.json", function (data) {
  //   positions["3d"] = data;
  // });

  $.get(dataFileAddr, function (data) {
    // data = JSON.parse(data);
    data.links.forEach((l) => {
      allLinks[`${l.source}${l.target}`] = l;
    });
    data.groups.forEach((group) => {
      groups[group.id] = { ...group, members: [], seedConnected: [] };
      const region = group.region;
      if (region) {
        if (!(region in regions)) {
          regions[region] = [];
        }
        if (!regions[region].includes(group.id)) {
          regions[region].push(group.id);
          $("#searchFieldSeedGroups").append(new Option(region, region));
        }
      }
    });

    data.nodes.forEach((node) => {
      node.neighbors = {};
      node.statistics = data.users_statistics[node.id];
      allNodes[node.id] = node;

      node.groups.forEach((group) => groups[group].members.push(node.id));
      if (node.verifications.SeedConnected) {
        for (const sg of node.verifications.SeedConnected.connected) {
          groups[sg].seedConnected.push(node.id);
        }
      }
    });

    Object.values(allLinks).forEach((l) => {
      if (!(l.target in allNodes[l.source].neighbors)) {
        allNodes[l.source].neighbors[l.target] = { from: [], to: [] };
      }
      if (!(l.source in allNodes[l.target].neighbors)) {
        allNodes[l.target].neighbors[l.source] = { from: [], to: [] };
      }
      for (h of l["history"]) {
        allNodes[l.source].neighbors[l.target]["to"].push(h);
        allNodes[l.target].neighbors[l.source]["from"].push(h);
      }
    });
    drawGraph();
    $("#loadingoverlay").fadeOut();
  });

  $("#searchField").change(function () {
    const val = $("#searchField").val();
    if (!val) {
      return;
    }
    const id = val.trim();
    if (["Bitu", "SeedConnected", "Seed", "SocialRecoverySetup"].includes(id)) {
      selectVerification(id);
    } else if (allNodes[id]) {
      if (graphNodes[id]) {
        if (auraMode) {
          selectAuraNode(allNodes[id], true);
        } else {
          selectNode(allNodes[id], true);
        }
      } else {
        alert("Error:", "This id is not node of this subgraph.");
      }
    } else if (groups[id]) {
      selectGroup(id, true);
    } else if (regions[id] || id == "Complete Graph") {
      selectRegion(id);
    } else {
      checkExpression(id);
    }
  });

  $("#groups").change(function () {
    const id = $(this).val();
    selectGroup(id, false);
  });

  $("#members").change(function () {
    const id = $(this).val();
    selectNode(allNodes[id], false);
  });

  $("#seedConnected").change(function () {
    const id = $(this).val();
    selectNode(allNodes[id], false);
  });

  $("#logoutBtn").click(() => {
    localforage.clear().then(() => {
      location.reload();
    });
  });
  $("#connectBrightidBtn").click(importBrightID);
  $("#syncBrightidBtn").click(syncBrightID);
  $("#showGroup").click(showGroup);
  $("#showMember").click(showMember);
  $("#showUser").click(showUser);
  $("#searchField").select2({ tags: true });
  $("#dateRange").change(setDateRange);
  $("#fromDate").change(() => (playerSettingChanged = true));
  $("#toDate").change(() => (playerSettingChanged = true));
  $("#delay").change(() => (playerSettingChanged = true));
  $("#playBtn").click(playBtnUI);
  $("#stopBtn").click(stopBtnUI);
  $("#previousBtn").click(previousBtnUI);
  $("#nextBtn").click(nextBtnUI);
  $("#drawSubgraphBtn").click(subgraphBtnUI);
  $("#dateRangeSI").change(setDateRangeSI);
  $("#fromDateSI").change(() => (playerSettingChangedSI = true));
  $("#toDateSI").change(() => (playerSettingChangedSI = true));
  $("#delaySI").change(() => (playerSettingChangedSI = true));
  $("#playBtnSI").click(playBtnSI);
  $("#stopBtnSI").click(stopBtnSI);
  $("#previousBtnSI").click(previousBtnSI);
  $("#nextBtnSI").click(nextBtnSI);
  $("#resetBtn").click(() => {
    $("#3dBtn").prop("checked", false);
    $("#levelsRange").val(3);
    $("#connectionLevel").html("Already known");
    stopBtnSI();
    stopBtnUI();
  });
  $("#selectNeighbor").click(selectNeighbor);
  $("#neighbors").change(showNeighborDetails);
  $("#3dBtn").click(drawGraph);
  $("#levelsRange").change(() => {
    const levelIndex = $("#levelsRange").val();
    const connectionLevels = [
      "Suspicious",
      "Just met",
      "Filtered",
      "Already known",
      "Recovery",
    ];
    $("#connectionLevel").html(connectionLevels[levelIndex]);
  });
  $("#drawGustomGraph").click(drawGraph);
  $("#linkVisibility").change(() => {
    if ($("#linkVisibility").is(":checked")) {
      Graph.linkVisibility(true);
    } else {
      Graph.linkVisibility(false);
    }
  });

  $("#logoutForm").hide();

  $("#menuToggle").click(function (e) {
    e.preventDefault();
    if ($("#wrapper").hasClass("toggled")) {
      $("#menuToggleIcon").addClass("fa-times");
      $("#wrapper").removeClass("toggled");
    } else {
      $("#menuToggleIcon").removeClass("fa-times");
      $("#wrapper").addClass("toggled");
    }
  });
  $("#drawGroupSubgraphBtn").click(drawGroupSubgraph);
});
