selectedLinkWidth = 1.0;
linkWidth = 0.3;
fadedColor = "rgba(204, 204, 204, 1)";
selectedNode = undefined;
autoLoginDone = false;
nodes = {};
links = [];
allLinks = [];
groups = {};
regions = {};
mainGraph = true;
playerSettingChanged = false;
playerState = "stopped";

function b64ToUrlSafeB64(s) {
  const alts = { "/": "_", "+": "-", "=": "" };
  return s.replace(/[/+=]/g, (c) => alts[c]);
}

function hash(data) {
  const h = CryptoJS.SHA256(data);
  const b = h.toString(CryptoJS.enc.Base64);
  return b64ToUrlSafeB64(b);
}

async function loadUsers(user, key1, password) {
  $("#logoutFormUserName").text(user.name || "");

  // set the user's name and image
  Object.assign(nodes[user.id], { name: user.name, img: new Image() });
  let imgData = await localforage.getItem(`explorer_img_${user.id}`);
  if (imgData) {
    nodes[user.id].img.src = imgData;
    $("#logoutFormImage").attr("src", imgData);
  } else {
    $.get(`/storage/${key1}/${user.id}`, (data) => {
      imgData = CryptoJS.AES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
      localforage.setItem(`explorer_img_${user.id}`, imgData);
      nodes[user.id].img.src = imgData;
      $("#logoutFormImage").attr("src", imgData);
    });
  }

  // set the connections' name and image
  for (const conn of user.connections || []) {
    // skip conn.id === user.id to solve bugs related to users connected to themselves!
    if (!nodes[conn.id] || conn.id === user.id) {
      continue;
    }
    $("#searchFieldConnections").append(new Option(conn.name, conn.id));
    Object.assign(nodes[conn.id], { name: conn.name, img: new Image() });
    let imgData = await localforage.getItem(`explorer_img_${conn.id}`);
    if (imgData) {
      nodes[conn.id].img.src = imgData;
    } else {
      $.get(`/storage/${key1}/${conn.id}`, (data) => {
        imgData = CryptoJS.AES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
        localforage.setItem(`explorer_img_${conn.id}`, imgData);
        nodes[conn.id].img.src = imgData;
      });
    }
  }
}

async function loadGroups(user, key1, password) {
  for (const group of user.groups || []) {
    if (!(group.id in groups)) {
      continue;
    }

    if (group.name) {
      $("#searchFieldGroups").append(new Option(group.name, group.id));
    }

    if (!group.url || !group.aesKey) {
      continue;
    }

    Object.assign(groups[group.id], { name: group.name, img: new Image() });
    let imgData = await localforage.getItem(`explorer_img_${group.id}`);
    if (imgData) {
      groups[group.id].img.src = JSON.parse(imgData)?.photo || "";
    } else {
      const url = "/storage/immutable" + group.url.split("immutable")[1];
      $.get(url, (data) => {
        imgData = CryptoJS.AES.decrypt(data, group.aesKey).toString(CryptoJS.enc.Utf8);
        localforage.setItem(`explorer_img_${group.id}`, imgData);
        groups[group.id].img.src = JSON.parse(imgData)?.photo || "";
      });
    }
  }
}

async function loadInfo() {
  autoLoginDone = true;
  let user;
  let key1;
  const code = $("#code").val();
  const password = $("#password").val();;
  let backupData = await localforage.getItem("explorer_backup_data");
  if (backupData) {
    backupData = JSON.parse(backupData);
    user = { id: backupData.id };
    key1 = await localforage.getItem("explorer_key1");
  } else {
    if (code.indexOf("==") > -1) {
      const brightid = CryptoJS.AES.decrypt(code, password).toString(CryptoJS.enc.Utf8);
      user = { id: brightid };
    } else {
      user = { id: code };
    }
    key1 = hash(user.id + password);
    localforage.setItem("explorer_key1", key1);
    await $.get(`/storage/${key1}/data`)
      .done((data) => {
        backupData = CryptoJS.AES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
        if (!backupData) {
          return alert("No backup found");
        }
      })
      .fail(() => {
        return alert("Invalid explorer code or password or backup not available");
      })
    localforage.setItem("explorer_backup_data", backupData);
    backupData = JSON.parse(backupData);
  }
  $("#loginForm").hide();
  $("#logoutForm").show();
  Object.assign(user, {
    ...backupData.userData,
    connections: backupData.connections,
    groups: backupData.groups,
  });
  await loadGroups(user, key1, password);
  await loadUsers(user, key1, password);
  selectNode(nodes[user.id], true);
}

function resetLinksColor(link) {
  if (link.level == "recovery") return "blue";
  else if (link.level == "already known") return "green";
  else if (link.level == "suspicious") return "orange";
  else if (link.level == "reported") return "red";
  else return "black";
}

function resetNodesColor(n) {
  if (n.selected) return "red";
  else if (n.node_type == "Seed") return "blue";
  else if (n.verifications && "BrightID" in n.verifications) return "green";
  else return "yellow";
}

function copyBrightid() {
  $("#brightidField").select();
  document.execCommand("copy");
}

function showUser() {
  const node = nodes[$("#seedConnected").val()];
  selectNode(node, true);
}

function showMember() {
  const node = nodes[$("#members").val()];
  selectNode(node, true);
}

function copyGroupId() {
  $("#groupIdField").select();
  document.execCommand("copy");
}

function showGroup() {
  selectGroup($("#groups").val(), true);
}

function setDateRange() {
  const v = $("#dateRange").val();
  const today = Date.now();
  let fromDate;
  if (v == "none") {
    fromDate = new Date(today + 2 * 24 * 60 * 60 * 1000);
  } else if (v == "all") {
    fromDate = new Date(1546562922436);
  } else if (v == "day") {
    fromDate = new Date(today);
  } else if (v == "week") {
    fromDate = new Date(today - 7 * 24 * 60 * 60 * 1000);
  } else if (v == "month") {
    fromDate = new Date(today - 30 * 24 * 60 * 60 * 1000);
  }
  $("#fromDate").val(fromDate.toISOString().split("T")[0]);
  $("#toDate").val(new Date(today).toISOString().split("T")[0]);
  playerSettingChanged = true;
}

var gPlayer = new player();

function player() {
  let task;
  let fromDate;
  let toDate;
  let delay;
  let stepLength;
  let steps;
  let step = 0;

  this.start = start;
  this.pause = pause;
  this.stop = stop;
  this.next = next;
  this.previous = previous;
  this.reset = reset;

  function reset() {
    if (playerSettingChanged) {
      step = 0;
      $("#linkDetailDate").html("&nbsp;");
      Graph.nodeColor(n => fadedColor);
      Graph.linkVisibility(link => false);
      fromDate = new Date($("#fromDate").val()).getTime();
      toDate = new Date($("#toDate").val()).getTime() + 24 * 60 * 60 * 1000;
      delay = $("#delay").val() * 1000;
      if (toDate - fromDate == 24 * 60 * 60 * 1000) {
        stepLength = 60 * 60 * 1000;
      } else {
        stepLength = 24 * 60 * 60 * 1000;
      }
      steps = Math.floor((toDate - fromDate) / stepLength);
      playerSettingChanged = false;
    }
  }

  function start() {
    reset();
    task = setTimeout(loop, 0);
    return true;
  }

  function pause() {
    clearTimeout(task);
    return true;
  }

  function stop() {
    clearTimeout(task);
    drawMainGraph();
    $("#linkDetailDate").html("&nbsp;");
    step = 0;
    return true;
  }

  function next() {
    clearTimeout(task);
    reset();
    if (step + 1 < steps) {
      step++
      drawStep();
    }
  }

  function previous() {
    clearTimeout(task);
    reset();
    if (step - 1 > 0) {
      step--
      drawStep();
    }
  }

  function loop() {
    if (step + 1 < steps) {
      step++
      task = setTimeout(loop, delay);
      drawStep();
    } else {
      step = 0;
      playerState = "stopped";
      if ($("#playBtn").hasClass("fa-pause")) {
        $("#playBtn").removeClass("fa-pause");
        $("#playBtn").addClass("fa-play");
      }
      return true;
    }
  }

  function drawStep() {
    const stepLinks = new Set();
    const stepNodes = new Set();
    const previousStepsLinks = new Set();
    const to = fromDate + (step * stepLength);
    const from = to - stepLength;
    links.forEach((link) => {
      if (fromDate <= link.timestamp && link.timestamp < from) {
        previousStepsLinks.add(link);
        stepNodes.add(link.source.id);
        stepNodes.add(link.target.id);
      } else if (from <= link.timestamp && link.timestamp <= to) {
        stepLinks.add(link);
        stepNodes.add(link.source.id);
        stepNodes.add(link.target.id);
      }
    });

    if (stepLength == 60 * 60 * 1000) {
      $("#linkDetailDate").html(new Date(to).toJSON().split('.')[0].replace('T', ' '));
    } else {
      $("#linkDetailDate").html(new Date(to).toJSON().split('T')[0]);
    }
    Graph.nodeColor(n => stepNodes.has(n.id) ? resetNodesColor(n) : fadedColor);
    Graph.linkVisibility((link) => (stepLinks.has(link) || previousStepsLinks.has(link) ? true : false));
    Graph.linkWidth((link) => (stepLinks.has(link) ? selectedLinkWidth : linkWidth))
      .linkColor((link) => (stepLinks.has(link) ? resetLinksColor(link) : fadedColor))
      .linkDirectionalArrowLength((link) => stepLinks.has(link) ? 16 : 6);
  }
}

function move(x, y, z) {
  Graph.centerAt(x + 200, y);
  Graph.zoom(z, 2000);
}

function selectGroup(id, showDetails) {
  $("#groupQuotaContainer").hide();
  $("#groupNameContainer").hide();
  $("#groupSeedConnectedDiv").hide();
  $("#showMainGraph").hide();
  $("#groupDitailPlaceHolder").hide();
  $("#groupDitailContent").show();

  $("#groupIdText").html(id);
  $("#groupIdField").val(id);

  const group = groups[id];
  if (!mainGraph && !group.seed) {
    drawMainGraph();
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
    $("#members").append(new Option(nodes[member].name || member, member));
    subgraphNodes[member] = nodes[member];
  }

  if (group.seedConnected.length > 0) {
    $("#seedConectedCount").html(group.seedConnected.length);
    $("#seedConnected").empty().append(new Option("", "none"));
    for (const u of group.seedConnected) {
      $("#seedConnected").append(new Option(nodes[u].name || u, u));
      subgraphNodes[u] = nodes[u];
    }
    $("#groupSeedConnectedDiv").show();
    links.forEach((link) => {
      if (link.source.id in subgraphNodes && link.target.id in subgraphNodes) {
        subgraphLinks.push(link);
      }
    });
  }

  if (group.seed) {
    mainGraph = false;
    $("#showMainGraph").show();
    Graph.nodeColor(n => group.members.includes(n.id) || group.seedConnected.includes(n.id) ? resetNodesColor(n) : fadedColor);
    $("#groupQuota").html(group.quota);
    $("#groupQuotaContainer").show();
    for (const u of Object.keys(subgraphNodes)) {
      delete subgraphNodes[u].fx;
      delete subgraphNodes[u].fy;
    }
    drawGraph({ nodes: Object.values(subgraphNodes), links: subgraphLinks }, true);
  }

  if (showDetails) {
    openCollapsible("groupDitail", true);
  }

  let sumX = 0;
  let sumY = 0;
  for (const member of group.members) {
    sumX += nodes[member].x;
    sumY += nodes[member].y;
  }
  const n = group.members.length;
  move(sumX / n, sumY / n, .2);
}

function selectVerification(verification) {
  const verifieds = {};
  if (verification.startsWith("Rank ")) {
    const rank = parseInt(verification.replace("Rank ", "").replace("+", ""));
    for (const id in nodes) {
      if (
        "Yekta" in nodes[id].verifications &&
        nodes[id].verifications.Yekta.rank >= rank
      ) {
        verifieds[id] = true;
      }
    }
  } else {
    for (const id in nodes) {
      if (verification in nodes[id].verifications) {
        verifieds[id] = true;
      }
    }
  }
  Graph.nodeColor(n => n.id in verifieds ? resetNodesColor(n) : fadedColor);
  Graph.linkColor(fadedColor);
}

function selectRegion(name) {
  if (name == "Complete Graph") {
    const centerNode = nodes["AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA"];
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
      if (nodes[id]) {
        members.push(id);
      } else if (groups[id]) {
        for (const member of groups[id].members) {
          members.push(member);
        }
      }
    }
    for (const id of members) {
      sumX += nodes[id].x;
      sumY += nodes[id].y;
    }
    Graph.nodeColor(n => members.includes(n.id) ? resetNodesColor(n) : fadedColor);
    Graph.linkColor(fadedColor);
    const n = members.length;
    move(sumX / n, sumY / n, 1.2);
  }
}

function getGroupName(group) {
  return (groups[group] && groups[group].name) || group;
}

function selectNode(node, showDetails) {
  $("#userDitailContent").show();
  $("#seedData").hide();
  $("#userNameContainer").hide();
  $("#userRecoveryContainer").hide();
  $("#userDitailPlaceHolder").hide();

  Object.values(nodes).forEach(node => {
    node.selected = false
  });
  selectedNode = node;
  node.selected = true;

  $("#brightidText").html(node.id);
  $("#brightidField").val(node.id);

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

  if (node.statistics.recoveries.length > 0) {
    $("#userRecoveries").empty();
    node.statistics.recoveries.forEach((tid) => {
      const text = nodes[tid]?.name || tid;
      $('<li class="text-white" style="font-size: 12px;">').text(text).appendTo("#userRecoveries");
    });
    $("#userRecoveryContainer").show();
  }

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
  for (const group of node.groups) {
    $("#groups").append(new Option(getGroupName(group), group));
  }

  const selectedLinks = new Set();
  links.forEach((link) => {
    if (link.source.id == node.id ||
        link.target.id == node.id ||
        (node.neighbors || new Set()).has(link.source.id) ||
        (node.neighbors || new Set()).has(link.target.id)) {
      selectedLinks.add(link);
    }
  });
  Graph.linkVisibility((link) => (selectedLinks.has(link) ? true : false));

  const activeNodes = new Set([node.id]);
  (node.neighbors || []).forEach((n) => {
    activeNodes.add(n);
    (nodes[n].neighbors || []).forEach((neighbor) => activeNodes.add(neighbor));
  });
  Graph.nodeColor((n) => activeNodes.has(n.id) ? resetNodesColor(n) : fadedColor)
    .linkDirectionalArrowLength((link) => selectedLinks.has(link) ? 16 : 6)
    .linkWidth((link) => selectedLinks.has(link) ? selectedLinkWidth : linkWidth)
    .linkColor((link) => selectedLinks.has(link) ? resetLinksColor(link) : fadedColor);

  if (showDetails) {
    openCollapsible("userDitail", true);
  }

  move(node.x, node.y, 1.2);
}

function updateStatistics() {
  let numVerifieds = numSeeds = numNeighbors = 0;
  Object.keys(nodes).forEach((id) => {
    const node = nodes[id];
    if (node.verifications && "BrightID" in node.verifications) {
      numVerifieds++;
      numNeighbors += node.neighbors.size;
    }
    if (node.node_type == "Seed") {
      numSeeds++;
    }
  });
  $("#numNodes").html(Object.keys(nodes).length);
  $("#numVerifieds").html(numVerifieds);
  $("#numSeeds").html(numSeeds);
  $("#averageConnection").html(Math.ceil(numNeighbors / numVerifieds));
}

function drawGraph(data, subgraph) {
  $("#graphDiv").empty();
  const elem = document.getElementById("graphDiv");
  Graph = ForceGraph()(elem)
    .graphData(data)
    .linkColor(resetLinksColor)
    .nodeId("id")
    .nodeVal("size")
    .nodeLabel("id")
    .linkWidth(linkWidth)
    .nodeColor(resetNodesColor)
    .linkSource("source")
    .linkTarget("target")
    .onNodeClick((node) => {
      if (!node.selected) {
        selectNode(node, true);
      }
    })
    .linkVisibility((link) => subgraph ? true : false)
    .onBackgroundClick(() => {
      if (!selectedNode) {
        return;
      }
      selectedNode.selected = false;
      selectedNode = undefined;
      Graph.linkWidth(linkWidth)
        .nodeColor(resetNodesColor)
        .linkColor(resetLinksColor)
        .linkDirectionalArrowLength(6);
    })
    .nodeCanvasObjectMode(() => "after")
    .linkDirectionalArrowLength(6)
    .nodeCanvasObject((n, ctx) => {
      let size = 30;
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

function logPositions() {
  const pos = {};
  Object.values(nodes).forEach(node => {
    if (Date.now() - 30 * 24 * 60 * 60 * 1000 > node.createdAt) {
      pos[node.id] = { x: node.x, y: node.y };
    }
  });
  console.log(pos);
}

function drawMainGraph() {
  drawGraph({ nodes: Object.values(nodes), links }, false);
  $("#showMainGraph").hide();
}

$(document).ready(function() {
  let fixedPositions = {};
  $.get("positions.json", function(data) {
    fixedPositions = data;
  });

  $.get("brightid.json", function(data) {
    // data = JSON.parse(data);
    allLinks = data.links;
    const connections = {};
    data.links.forEach((l) => {
      connections[`${l.source}_${l.target}`] = l;
    })
    Object.values(connections).forEach((l) => {
      if (['just met', 'suspicious'].includes(l.level)) {
        return;
      }
      const otherSideLevel = connections[`${l.target}_${l.source}`]?.level
      if (l.level != 'reported' && [undefined, 'just met', 'suspicious'].includes(otherSideLevel)) {
        return;
      }
      links.push(l);
    })

    data.nodes.forEach((node) => {
      if (node.id in fixedPositions) {
        node.fx = fixedPositions[node.id].x;
        node.fy = fixedPositions[node.id].y;
      }

      node.neighbors = new Set();
      node.statistics = data.users_statistics[node.id];
      nodes[node.id] = node;

      node.groups.forEach((group) => {
        if (!(group in groups)) {
          groups[group] = { members: [], seedConnected: [] };
        }
        groups[group].members.push(node.id);
      });

      if (node.verifications.SeedConnected) {
        for (const sg of node.verifications.SeedConnected.connected) {
          if (!(sg in groups)) {
            groups[sg] = { members: [], seedConnected: [] };
          }
          groups[sg].seedConnected.push(node.id);
        }
      }
    });

    data.groups.forEach((group) => {
      groups[group.id] = Object.assign(groups[group.id] || {}, group);
      const region = group.region;
      if (region) {
        if (!(region in regions)) {
          regions[region] = [];
        }
        if (!regions[region].includes(group.id)) {
          regions[region].push(group.id);
          $("#searchFieldRegions").append(new Option(region, region));
        }
      }
    });

    links.forEach((link) => {
      nodes[link.target].neighbors.add(link.source);
      nodes[link.source].neighbors.add(link.target);
    });

    drawMainGraph();
    updateStatistics();
  });

  $("#searchField").change(function() {
    const val = $("#searchField").val();
    if (!val) {
      return;
    }
    const id = val.trim();
    if (
      ["BrightID", "SeedConnected", "DollarForEveryone", "SocialRecoverySetup"].includes(id) ||
      id.startsWith("Rank ")
    ) {
      selectVerification(id);
    } else if (nodes[id]) {
      selectNode(nodes[id], true);
    } else if (groups[id]) {
      selectGroup(id, true);
    } else if (regions[id] || id == "Complete Graph") {
      selectRegion(id);
    } else {
      return;
    }
  });

  $("#groups").change(function() {
    const id = $(this).val();
    selectGroup(id, false);
  });

  $("#members").change(function() {
    const id = $(this).val();
    selectNode(nodes[id], false);
  });

  $("#seedConnected").change(function() {
    const id = $(this).val();
    selectNode(nodes[id], false);
  });

  $("#logoutBtn").click(() => {
    localforage.clear().then(() => {
      location.reload();
    });
  });
  $("#login").click(loadInfo);
  $("#showGroup").click(showGroup);
  $("#copyBrightid").click(copyBrightid);
  $("#showMemeber").click(showMember);
  $("#showUser").click(showUser);
  $("#copyGroupId").click(copyGroupId);
  $("#searchField").select2({ tags: true });
  $("#dateRange").change(setDateRange);
  $("#showMainGraph").click(drawMainGraph);
  $("#fromDate").change(() => playerSettingChanged = true);
  $("#toDate").change(() => playerSettingChanged = true);
  $("#delay").change(() => playerSettingChanged = true);
  $("#playBtn").click(function() {
    if (playerState == "stopped" || playerState == "paused") {
      $("#playBtn").removeClass("fa-play");
      $("#playBtn").addClass("fa-pause");
      playerState = "playing";
      gPlayer.start();
    } else if (playerState == "playing") {
      $("#playBtn").removeClass("fa-pause");
      $("#playBtn").addClass("fa-play");
      playerState = "paused";
      gPlayer.pause();
    }
  });
  $("#stopBtn").click(function() {
    if ($("#playBtn").hasClass("fa-pause")) {
      $("#playBtn").removeClass("fa-pause");
      $("#playBtn").addClass("fa-play");
    }
    playerState = "stopped";
    gPlayer.stop();
  });
  $("#previousBtn").click(function() {
    if ($("#playBtn").hasClass("fa-pause")) {
      $("#playBtn").removeClass("fa-pause");
      $("#playBtn").addClass("fa-play");
    }
    playerState = "paused";
    gPlayer.previous();
  });
  $("#nextBtn").click(function() {
    if ($("#playBtn").hasClass("fa-pause")) {
      $("#playBtn").removeClass("fa-pause");
      $("#playBtn").addClass("fa-play");
    }
    playerState = "paused";
    gPlayer.next();
  });
});