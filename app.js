function b64ToUrlSafeB64(s) {
  const alts = {
    "/": "_",
    "+": "-",
    "=": "",
  };
  return s.replace(/[/+=]/g, (c) => alts[c]);
}

function hash(data) {
  const h = CryptoJS.SHA256(data);
  const b = h.toString(CryptoJS.enc.Base64);
  return b64ToUrlSafeB64(b);
}

function load_users(user, key1, password) {
  nodes[user.id].trusted.forEach((t) => {
    $('<div class="text-white row mt-2 px-4" style="font-size: 12px;">').text(t).appendTo("#recoveries");
  })
  $("<option>").val(user.id).text(user.name).appendTo("#usersgroup");
  $.get(`/storage/${key1}/${user.id}`).done((data) => {
    data = CryptoJS.AES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
    let img1 = new Image();
    img1.src = data;
    Object.assign(nodes[user.id], {
      name: user.name,
      img: img1,
    });
  });
  for (const c of user.connections || []) {
    // skip c.id === user.id to solve bugs related to users connected to themselves!
    if (!nodes[c.id] || c.id === user.id) {
      continue;
    }
    $("<option>").val(c.id).text(c.name).appendTo("#usersgroup");
    Object.assign(nodes[c.id], { name: c.name });
    $.get(`/storage/${key1}/${c.id}`).done((data) => {
      data = CryptoJS.AES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
      let img2 = new Image();
      img2.src = data;
      Object.assign(nodes[c.id], { img: img2 });
    });
  }
  $("#searchfield").select2({ tags: true });
}

function load_groups(user, key1, password) {
  for (const g of user.groups || []) {
    if (!groups[g.id]) {
      continue;
    }
    Object.assign(groups[g.id], { name: g.name });
    if (g.name) {
      $("<option>").val(g.id).text(g.name).appendTo("#groupsgroup");
    }
    if (!g.url) {
      continue;
    }
    const url = "/storage/immutable" + g.url.split("immutable")[1];
    $.get(url).done((data) => {
      if (!g.aesKey || !data) {
        return;
      }
      data = CryptoJS.AES.decrypt(data, g.aesKey).toString(CryptoJS.enc.Utf8);
      let img = new Image();
      img.src = JSON.parse(data).img;
      Object.assign(groups[g.id], { img });
    });
  }
  $("#searchfield").select2({ tags: true });
}

async function load_info() {
  const code = $("#code").val();
  const password = $("#password").val();
  if (code.indexOf("==") > -1) {
    const brightid = CryptoJS.AES.decrypt(code, password).toString(
      CryptoJS.enc.Utf8
    );
    user = { id: brightid };
  } else {
    user = { id: code };
  }
  try {
    const api_data = await $.get(`/api/v5/users/${user.id}`);
    key1 = hash(user.id + password);
    backup_data = await $.get(`/storage/${key1}/data`);
  } catch {
    return alert("Invalid explorer code or password or backup not available");
  }
  backup_data = CryptoJS.AES.decrypt(backup_data, password).toString(
    CryptoJS.enc.Utf8
  );
  $("#loginform").hide();
  $("#logoutbtnform").show();
  localStorage.explorer_code = code;
  if (!backup_data) {
    return alert("no backup found");
  }
  backup_data = JSON.parse(backup_data);
  Object.assign(user, {
    ...backup_data.userData,
    connections: backup_data.connections,
    groups: backup_data.groups,
  });
  load_users(user, key1, password);
  load_groups(user, key1, password);
}

function reset_colors(n) {
  let color;
  if (n.node_type == "Seed") {
    color = "blue";
  } else if (n.verifications && "BrightID" in n.verifications) {
    color = "green";
  } else {
    color = "yellow";
  }
  if (reds.includes(n.id)) {
    color = "red";
  } else if (oranges.includes(n.id)) {
    color = "orange";
  }
  n.color = color;
  return color;
}

function copy_brightid() {
  $("#brightidfield").select();
  document.execCommand("copy");
}

function show_user() {
  const node = nodes[$("#seedConnected").val()];
  select_node(node, true);
}

function show_member() {
  const node = nodes[$("#members").val()];
  select_node(node, true);
}

function copy_groupid() {
  $("#groupidfield").select();
  document.execCommand("copy");
}

function show_group() {
  select_group($("#groups").val(), true);
}

function set_date_range() {
  const v = $("#daterange").val();
  const today = Date.now();
  let days;
  if (v == "none") {
    fromdate = new Date(today + 2 * 24 * 60 * 60 * 1000);
  } else if (v == "all") {
    fromdate = new Date(today - 10000 * 24 * 60 * 60 * 1000);
  } else if (v == "day") {
    fromdate = new Date(today - 1 * 24 * 60 * 60 * 1000);
  } else if (v == "week") {
    fromdate = new Date(today - 7 * 24 * 60 * 60 * 1000);
  } else if (v == "month") {
    fromdate = new Date(today - 30 * 24 * 60 * 60 * 1000);
  }
  $("#fromdate").val(fromdate.toISOString().split("T")[0]);
  $("#todate").val(new Date(today).toISOString().split("T")[0]);
  highlight_edges();
}

function read_regions(e) {
  var file = e.target.files[0];
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function (e) {
    parse_regions(e.target.result);
  };
  reader.readAsText(file);
}
const regions = {};

function parse_regions(s) {
  const lines = s.split("\n");
  for (let line of lines) {
    line = line.trim();
    const [region, id] = line.split("\t");
    let type;
    if (!regions[region]) {
      regions[region] = [];
      $("<option>").val(region).text(region).appendTo("#regionsgroup");
    }
    if (!regions[region].includes(id)) {
      regions[region].push(id);
    }
  }
  $("#searchfield").select2({ tags: true });
}

function highlight_edges() {
  const highlightLinks = new Set();
  const fromdate = new Date($("#fromdate").val()).getTime();
  const todate = new Date($("#todate").val()).getTime() + 24 * 60 * 60 * 1000;
  links.forEach((link) => {
    if (fromdate <= link.timestamp && link.timestamp <= todate) {
      highlightLinks.add(link);
    }
  });
  Graph.linkWidth((link) => (highlightLinks.has(link) ? 1 : 0.1));
  Graph.linkVisibility((link) => (highlightLinks.has(link) ? true : false));
}

function move(x, y, z) {
  Graph.centerAt(x + 200, y);
  Graph.zoom(z, 2000);
}

function select_group(id, show_details) {
  let sum_x = 0;
  let sum_y = 0;
  const group = groups[id];
  for (member of group.members) {
    sum_x += nodes[member].x;
    sum_y += nodes[member].y;
  }
  const n = group.members.length;
  move(sum_x / n, sum_y / n, 1.2);
  if (group.seed) {
    reds = group.members;
    oranges = group.seedConnected;
  } else {
    reds = [];
    oranges = group.members;
  }
  Graph.nodeColor(reset_colors);
  // group details
  if (group.name) {
    $("#groupnamecontainer").show();
    $("#groupname").html(group.name);
  } else if (group.region) {
    $("#groupnamecontainer").show();
    $("#groupname").html(group.region);
  } else {
    $("#groupnamecontainer").hide();
  }
  if (group.quota) {
    $("#groupquotacontainer").show();
    $("#groupquota").html(group.quota);
  } else {
    $("#groupquotacontainer").hide();
  }
  if (group.photo) {
    $("#groupphotocontainer").show();
    $("#groupphoto").attr("src", group.photo);
  } else {
    $("#groupphoto").hide();
  }
  if (group.seedConnected.length > 0) {
    $("#groupseedconectedcount").html(group.seedConnected.length);
    $("#seedConnected").empty().append(new Option("", "none"));
    for (const u of group.seedConnected) {
      $("#seedConnected").append(new Option(nodes[u].name || u, u));
    }
    $("#seedConnectedDiv").show();
  } else {
    $("#seedConnectedDiv").hide();
  }
  $("#groupidtext").html(id);
  $("#groupidfield").val(id);
  $("#groupmemberscount").html(group.members.length);
  $("#groupuserphoto").hide();
  $("#members").empty().append(new Option("", "none"));
  for (const member of group.members) {
    $("#members").append(new Option(nodes[member].name || member, member));
  }
  if (show_details) {
    openCollapsible("groupDitail", true);
  }
}

function select_verification(v) {
  const members = [];
  if (v.startsWith("Rank ")) {
    const _rank = parseInt(v.replace("Rank ", "").replace("+", ""));
    for (let id in nodes) {
      if (
        "Yekta" in nodes[id].verifications &&
        nodes[id].verifications.Yekta.rank >= _rank
      ) {
        members.push(id);
      }
    }
  } else {
    for (let id in nodes) {
      if (v in nodes[id].verifications) {
        members.push(id);
      }
    }
  }
  reds = [];
  oranges = members;
  Graph.nodeColor(reset_colors);
}

function select_region(name) {
  if (name == "Complete Graph") {
    const centerNode = nodes["AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA"];
    reds = [];
    oranges = [];
    Graph.nodeColor(reset_colors);
    return move(centerNode.x, centerNode.y, 0.7);
  }
  if (regions[name].length == 1 && groups[regions[name][0]]) {
    select_group(regions[name][0], true);
  } else {
    let sum_x = 0;
    let sum_y = 0;
    let count = 0;
    const members = [];
    for (let id of regions[name]) {
      if (nodes[id]) {
        members.push(id);
      } else if (groups[id]) {
        for (member of groups[id].members) {
          members.push(member);
        }
      }
    }
    for (const id of members) {
      sum_x += nodes[id].x;
      sum_y += nodes[id].y;
    }
    reds = [];
    oranges = members;
    Graph.nodeColor(reset_colors);
    const n = members.length;
    move(sum_x / n, sum_y / n, 1.2);
  }
}

function get_group_name(g) {
  return (groups[g] && groups[g].name) || g;
}

function select_node(node, show_details) {
  if (node.node_type == "Seed") {
    $("#quotaValue").html(node.quota);
    $("#noSeedGroups").html(node.seed_groups);
    $("#seedData").show();
  } else {
    $("#seedData").hide();
  }
  if (node.name) {
    $("#name").show();
    $("#name").html(node.name);
  } else {
    $("#name").hide();
  }
  if (node.photo) {
    $("#photo").show();
    $("#photo").attr("src", node.photo);
  } else {
    $("#photo").hide();
  }
  var str_verifications = "";
  for (const name in node.verifications) {
    let keyValue = "";
    for (let [key, value] of Object.entries(node.verifications[name])) {
      if (key == "timestamp") {
        key = "Date";
        var d = new Date(value);
        value = d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
      } else if (key == "seedGroup") {
        let groupId = value.replace("groups/", "");
        value = groups[groupId].region ? groups[groupId].region : groupId;
      }
      keyValue +=
        '<div class="card-value-container"> <div class="inline-text">' +
        key +
        ": " +
        value +
        "</div> </div>";
    }
    str_verifications += creatCard(name, keyValue);
  }
  $("#verifications").html(str_verifications);
  $("#brightidtext").html(node.id);
  $("#brightidfield").val(node.id);
  reds = [];
  oranges = [];
  reds = [node.id];
  oranges = node.connections;
  Graph.nodeColor(reset_colors);
  move(node.x, node.y, 1.2);
  $("#usergroupphoto").hide();
  $("#groups").empty().append(new Option("", "none"));
  for (const g of node.groups) {
    $("#groups").append(new Option(get_group_name(g), g));
  }
  const highlightLinks = new Set();
  links.forEach((link) => {
    if (link.source.id == node.id || link.target.id == node.id) {
      highlightLinks.add(link);
    }
  });
  Graph.linkWidth((link) => (highlightLinks.has(link) ? 1 : 0.1));
  Graph.linkVisibility((link) => (highlightLinks.has(link) ? true : false));
  if (show_details) {
    openCollapsible("userDitail", true);
  }
}

function update_statistics() {
  const [num_verified, num_seeds, average_connection] = count_statistics();
  $("#num_nodes").html(Object.keys(nodes).length);
  $("#num_verified").html(num_verified);
  $("#num_seeds").html(num_seeds);
  $("#average_connection").html(average_connection);
}

function count_statistics() {
  let num_verified = (num_seeds = sum_neighbors = 0);
  Object.keys(nodes).forEach((id) => {
    let node = nodes[id];
    if (node.verifications && "BrightID" in node.verifications) {
      num_verified++;
      sum_neighbors += node.connections.length;
    }
    if (node.node_type == "Seed") {
      num_seeds++;
    }
  });
  return [num_verified, num_seeds, Math.ceil(sum_neighbors / num_verified)];
}

function draw_graph(data) {
  const elem = document.getElementById("graph_div");
  Graph = ForceGraph()(elem)
    .graphData(data)
    .linkColor(() => "rgba(204, 204, 204, 1)")
    .nodeId("id")
    .nodeVal("size")
    .nodeLabel("id")
    .linkWidth(0.1)
    .nodeColor(reset_colors)
    .linkSource("source")
    .linkTarget("target")
    .onNodeClick((node) => {
      select_node(node, true);
    })
    .linkVisibility((link) => false)
    .nodeCanvasObjectMode(() => "after")
    .nodeCanvasObject(({ img, x, y, color }, ctx) => {
      let size = 20;
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2, true);
        ctx.clip();
        ctx.strokeStyle = color;
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
        ctx.stroke();
        ctx.restore();
      }
    });
}

$(document).ready(function () {
  nodes = {};
  oranges = [];
  reds = [];
  $.get("brightid.json", function (data) {
    // data = JSON.parse(data);
    links = data.links;
    data.nodes.forEach((node) => {
      node.connections = [];
      nodes[node.id] = node;
      node.groups.forEach((group) => {
        if (!groups[group]) {
          groups[group] = { members: [], seedConnected: [] };
        }
        groups[group].members.push(node.id);
      });
      if (node.verifications.SeedConnected) {
        let sg = node.verifications.SeedConnected.seedGroup.replace(
          "groups/",
          ""
        );
        if (!groups[sg]) {
          groups[sg] = { members: [], seedConnected: [] };
        }
        groups[sg].seedConnected.push(node.id);
      }
    });
    data.groups.forEach((group) => {
      groups[group.id] = Object.assign(groups[group.id] || {}, group);
      if (group.region) {
        const region = group.region;
        if (!regions[region]) {
          regions[region] = [];
          $("<option>").val(region).text(region).appendTo("#regionsgroup");
        }
        if (!regions[region].includes(group.id)) {
          regions[region].push(group.id);
        }
      }
    });
    data.links.forEach((edge) => {
      // edges[edge.source + ',' + edge.target] = edge[2];
      nodes[edge.source].connections.push(edge.target);
      nodes[edge.target].connections.push(edge.source);
    });
    draw_graph(data);
  });
  $("#searchfield").change(function () {
    const val = $("#searchfield").val();
    if (!val) {
      return;
    }
    const id = val.trim();
    if (
      ["BrightID", "SeedConnected", "CallJoined", "DollarForEveryone"].includes(
        id
      ) ||
      id.startsWith("Rank ")
    ) {
      select_verification(id);
    } else if (nodes[id]) {
      select_node(nodes[id], true);
    } else if (groups[id]) {
      select_group(id, true);
    } else if (regions[id] || id == "Complete Graph") {
      select_region(id);
    } else {
      return;
    }
  });
  $("#groups").change(function () {
    const id = $(this).val();
    if (groups[id].photo) {
      $("#usergroupphoto").show();
      $("#usergroupphoto").attr("src", groups[id].photo);
    } else {
      $("#usergroupphoto").hide();
    }
    select_group(id, false);
  });
  $("#members").change(function () {
    const id = $(this).val();
    if (nodes[id].photo) {
      $("#groupuserphoto").show();
      $("#groupuserphoto").attr("src", nodes[id].photo);
    } else {
      $("#groupuserphoto").hide();
    }
    select_node(nodes[id], false);
  });
  $("#seedConnected").change(function () {
    const id = $(this).val();
    if (nodes[id].photo) {
      $("#groupuserphoto").show();
      $("#groupuserphoto").attr("src", nodes[id].photo);
    } else {
      $("#groupuserphoto").hide();
    }
    select_node(nodes[id], false);
  });
  $("#statisticsbtn").click(update_statistics);
  $("#logoutbtn").click(() => {
    location.reload();
  });
  $("#load").click(load_info);
  $("#showGroup").click(show_group);
  $("#copybrightid").click(copy_brightid);
  $("#showMemeber").click(show_member);
  $("#showUser").click(show_user);
  $("#copygroupid").click(copy_groupid);
  $("#uploadregionbtn").click(function (e) {
    e.preventDefault();
    $("#regionfile").click();
  });
  $("#regionfile").change(read_regions);
  $("#searchfield").select2({ tags: true });
  $("#daterange").change(set_date_range);
  $("#fromdate").change(highlight_edges);
  $("#todate").change(highlight_edges);

  if (localStorage.explorer_code) {
    $("#code").val(localStorage.explorer_code);
  }
  update_statistics();
});
