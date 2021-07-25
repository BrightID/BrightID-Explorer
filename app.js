selected_link_width = 1.0;
link_width = 0.3;
faded_color = "rgba(204, 204, 204, 1)";
selected_node = undefined;
auto_login_done = false;

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

async function load_users(user, key1, password) {
  $("<option>").val(user.id).text(user.name).appendTo("#usersgroup");
  $("#username").empty();
  $('#profileimage').empty();
  $('<div class="text-white" style="font-size: 25px;">').text(user.name).appendTo("#username");
  let img1 = new Image();
  let data;
  Object.assign(nodes[user.id], { name: user.name, img: img1 });
  if (!(await localforage.getItem(`explorer_img_${user.id}`))) {
    console.log('loading', user.id);
    $.get(`/storage/${key1}/${user.id}`).done((data) => {
      data = CryptoJS.AES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
      localforage.setItem(`explorer_img_${user.id}`, data);
      img1.src = data;
      $('#profileimage').prepend('<img src="' + data + '" class="profile-image"/>');
      select_node(nodes[user.id], true);
    });
  } else {
    data = await localforage.getItem(`explorer_img_${user.id}`);
    img1.src = data;
    $('#profileimage').prepend('<img src="' + data + '" class="profile-image"/>');
    select_node(nodes[user.id], true);
  }
  for (const c of user.connections || []) {
    // skip c.id === user.id to solve bugs related to users connected to themselves!
    if (!nodes[c.id] || c.id === user.id) {
      continue;
    }
    $("<option>").val(c.id).text(c.name).appendTo("#usersgroup");
    Object.assign(nodes[c.id], { name: c.name });
    data = await localforage.getItem(`explorer_img_${c.id}`);
    if (!data) {
      console.log('loading from web');
      try {
        data = await $.get(`/storage/${key1}/${c.id}`);
      } catch (e) {
        continue;
      }
      data = CryptoJS.AES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
      localforage.setItem(`explorer_img_${c.id}`, data);
      let img2 = new Image();
      img2.src = data;
      Object.assign(nodes[c.id], { img: img2 });
    } else {
      console.log('loading from localforage');
      let img2 = new Image();
      img2.src = data;
      Object.assign(nodes[c.id], { img: img2 });
    }
  }
  $("#searchfield").select2({ tags: true });
}

async function load_groups(user, key1, password) {
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
    if (!(await localforage.getItem(`explorer_img_${g.id}`))) {
      $.get(url).done((data) => {
        if (!g.aesKey || !data) {
          return;
        }
        data = CryptoJS.AES.decrypt(data, g.aesKey).toString(CryptoJS.enc.Utf8);
        localforage.setItem(`explorer_img_${g.id}`, data);
        let img = new Image();
        img.src = JSON.parse(data).img;
        Object.assign(groups[g.id], { img });
      });
    } else {
      let data = await localforage.getItem(`explorer_img_${g.id}`);
      let img = new Image();
      img.src = JSON.parse(data).img;
      Object.assign(groups[g.id], { img });
    }
  }
  $("#searchfield").select2({ tags: true });
}

async function load_info() {
  auto_login_done = true;
  let password;
  if (!(await localforage.getItem('explorer_backup_data'))) {
    const code = $("#code").val();
    password = $("#password").val();
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
      localforage.setItem('explorer_key1', key1);
      backup_data = await $.get(`/storage/${key1}/data`);
    } catch {
      return alert("Invalid explorer code or password or backup not available");
    }
    backup_data = CryptoJS.AES.decrypt(backup_data, password).toString(
      CryptoJS.enc.Utf8
    );
    if (!backup_data) {
      return alert("no backup found");
    }
    localforage.setItem('explorer_backup_data', backup_data);
    backup_data = JSON.parse(backup_data);
  } else {
    backup_data = JSON.parse((await localforage.getItem('explorer_backup_data')));
    user = { id: backup_data.id };
    key1 = await localforage.getItem('explorer_key1');
  }
  $("#loginform").hide();
  $("#logoutbtnform").show();

  Object.assign(user, {
    ...backup_data.userData,
    connections: backup_data.connections,
    groups: backup_data.groups,
  });
  load_users(user, key1, password);
  load_groups(user, key1, password);
}

function reset_link_colors(link) {
  if (link.level == 'recovery') return 'blue';
  else if (link.level == 'already known') return 'green';
  else if (link.level == 'suspicious') return 'orange';
  else if (link.level == 'reported') return 'red';
  else return 'black';
}

function reset_node_colors(n) {
  if (n.node_type == "Seed") return "blue";
  else if (n.verifications && "BrightID" in n.verifications) return "green";
  else return "yellow";
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
  reader.onload = function(e) {
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
  const highlightNodes = new Set();
  const fromdate = new Date($("#fromdate").val()).getTime();
  const todate = new Date($("#todate").val()).getTime() + 24 * 60 * 60 * 1000;
  links.forEach((link) => {
    if (fromdate <= link.timestamp && link.timestamp <= todate) {
      highlightLinks.add(link);
      highlightNodes.add(link.source.id);
      highlightNodes.add(link.target.id);
    }
  });
  Graph.nodeColor(n => highlightNodes.has(n.id) ? reset_node_colors(n) : faded_color);
  Graph.linkVisibility((link) => (highlightLinks.has(link) ? true : false));
  Graph.linkWidth((link) => (highlightLinks.has(link) ? selected_link_width : link_width))
    .linkColor((link) => (highlightLinks.has(link) ? reset_link_colors(link) : faded_color))
    .linkDirectionalArrowLength((link) => highlightLinks.has(link) ? 16 : 6);
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
    Graph.nodeColor(n => group.members.includes(n.id) || group.seedConnected.includes(n.id) ? reset_node_colors(n) : faded_color);
  } else {
    Graph.nodeColor(n => group.members.includes(n.id) ? reset_node_colors(n) : faded_color);
  }

  Graph.linkColor(faded_color);
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
  if ('quota' in group) {
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
  Graph.nodeColor(n => members.includes(n.id) ? reset_node_colors(n) : faded_color);
  Graph.linkColor(faded_color);
}

function select_region(name) {
  if (name == "Complete Graph") {
    const centerNode = nodes["AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA"];
    Graph.nodeColor(reset_node_colors);
    Graph.linkColor(reset_link_colors);
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
    Graph.nodeColor(n => members.includes(n.id) ? reset_node_colors(n) : faded_color);
    Graph.linkColor(faded_color);
    const n = members.length;
    move(sum_x / n, sum_y / n, 1.2);
  }
}

function get_group_name(g) {
  return (groups[g] && groups[g].name) || g;
}

function select_node(node, show_details) {
  $("#recoveryIn").html(node.statistics['inbound']['recovery']);
  $("#recoveryOut").html(node.statistics['outbound']['recovery']);
  $("#alreadyKnownIn").html(node.statistics['inbound']['already known']);
  $("#alreadyKnownOut").html(node.statistics['outbound']['already known']);
  $("#justMetIn").html(node.statistics['inbound']['just met']);
  $("#justMetOut").html(node.statistics['outbound']['just met']);
  $("#suspiciousIn").html(node.statistics['inbound']['suspicious']);
  $("#suspiciousOut").html(node.statistics['outbound']['suspicious']);
  $("#reportedIn").html(node.statistics['inbound']['reported']);
  $("#reportedOut").html(node.statistics['outbound']['reported']);

  Object.values(nodes).forEach(node => {
    node.selected = false
  });
  selected_node = node;
  node.selected = true;
  if (node.node_type == "Seed") {
    $("#quotaValue").html(node.quota);
    $("#noSeedGroups").html(node.seed_groups.length);
    $("#seedData").show();
  } else {
    $("#seedData").hide();
  }
  if (node.name) {
    $("#nameContainer").show();
    $("#name").html(node.name);
  } else {
    $("#nameContainer").hide();
  }
  if (node.img) {
    $("#userimage").show();
    $("#userimage").empty();
    $('#userimage').prepend('<img src="' + node.img.src + '" class="user-image"/>');
  } else {
    $("#userimage").hide();
  }
  if (node.trusted) {
    $("#userRecoveryContainer").show();
    $("#userRecoveries").empty();
    node.trusted.forEach((tid) => {
      let text = nodes[tid] ? .name || tid;
      $('<li class="text-white" style="font-size: 12px;">').text(text).appendTo("#userRecoveries");
    });
  } else {
    $("#userRecoveryContainer").hide();
  }
  var str_verifications = "";
  for (const name in node.verifications) {
    if (node.verifications[name].app) {
      continue;
    }
    let details = [];
    for (let [key, value] of Object.entries(node.verifications[name])) {
      if (["timestamp", "hash", "block"].includes(key)) {
        continue;
      } else if (!value && key == "friend") {
        continue;
      } else if (["reported", "connected"].includes(key) && value.length == 0) {
        continue;
      } else if (key == "connected") {
        let seedGroups = [];
        for (let groupId of value) {
          seedGroups.push(groups[groupId].region ? groups[groupId].region : groupId);
        }
        value = seedGroups.join(', ');
      } else if (key == "reported") {
        let seedGroups = [];
        for (let groupId of value) {
          seedGroups.push(groups[groupId].region ? groups[groupId].region : groupId);
        }
        value = seedGroups.join(', ');
      } else if (key == "raw_rank") {
        value = value.toFixed(2)
      }
      details.push(`${key}: ${value}`);
    }
    str_verifications += `<b>${name}</b> ${details.join(', ')}<br/>`;
  }
  $("#verifications").html(str_verifications);
  $("#brightidtext").html(node.id);
  $("#brightidfield").val(node.id);
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
  Graph.linkVisibility((link) => (highlightLinks.has(link) ? true : false));
  Graph.nodeColor((n) => node.neighbors.has(n.id) || n == node ? reset_node_colors(n) : faded_color)
    .linkDirectionalArrowLength((link) => highlightLinks.has(link) ? 16 : 6)
    .linkWidth((link) => highlightLinks.has(link) ? selected_link_width : link_width)
    .linkColor((link) => highlightLinks.has(link) ? reset_link_colors(link) : faded_color);
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
      sum_neighbors += node.neighbors.size;
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
    .linkColor(reset_link_colors)
    .nodeId("id")
    .nodeVal("size")
    .nodeLabel("id")
    .linkWidth(link_width)
    .nodeColor(reset_node_colors)
    .linkSource("source")
    .linkTarget("target")
    .onNodeClick((node) => {
      if (!node.selected) {
        select_node(node, true);
      }
    })
    .linkVisibility((link) => false)
    .onBackgroundClick(() => {
      if (!selected_node) {
        return;
      }
      selected_node.selected = false;
      selected_node = undefined;
      Graph.linkWidth(link_width)
        .nodeColor(reset_node_colors)
        .linkColor(reset_link_colors)
        .linkDirectionalArrowLength(6);
    })
    .nodeCanvasObjectMode(() => "after")
    .linkDirectionalArrowLength(6)
    .nodeCanvasObject(({ img, x, y, color }, ctx) => {
      let size = 30;
      if (img) {
        ctx.lineWidth = 5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2, true);
        ctx.clip();
        ctx.strokeStyle = color;
        try {
          ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
        } catch (err) {
          console.log('Error in drawImage: ', err)
        }
        ctx.stroke();
        ctx.restore();
      }
    })
    .onEngineStop(async () => {
      if ((await localforage.getItem('explorer_backup_data')) && !auto_login_done) {
        load_info();
      }
    });
}

function log_positions() {
  const pos = {};
  Object.values(nodes).forEach(node => {
    pos[node.id] = { x: node.x, y: node.y }
  });
  console.log(pos);
}

$(document).ready(function() {
  nodes = {};
  let fixed_positions;
  $.get("positions.json", function(data) {
    fixed_positions = data;
  });
  $.get("brightid.json", function(data) {
    // data = JSON.parse(data);
    data.links = data.links.filter(link => link.level != 'just met');
    links = data.links;
    data.nodes.forEach((node) => {
      if (node.id in fixed_positions) {
        node.fx = fixed_positions[node.id].x;
        node.fy = fixed_positions[node.id].y;
      }
      node.neighbors = new Set();
      node.statistics = data.users_statistics[node.id];
      nodes[node.id] = node;
      node.groups.forEach((group) => {
        if (!groups[group]) {
          groups[group] = { members: [], seedConnected: [] };
        }
        groups[group].members.push(node.id);
      });
      if (node.verifications.SeedConnected) {
        for (const sg of node.verifications.SeedConnected.connected) {
          if (!groups[sg]) {
            groups[sg] = { members: [], seedConnected: [] };
          }
          groups[sg].seedConnected.push(node.id);
        }
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
      nodes[edge.target].neighbors.add(edge.source);
      nodes[edge.source].neighbors.add(edge.target)
    });
    draw_graph(data);
  });

  $("#searchfield").change(function() {
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
  $("#groups").change(function() {
    const id = $(this).val();
    if (groups[id].photo) {
      $("#usergroupphoto").show();
      $("#usergroupphoto").attr("src", groups[id].photo);
    } else {
      $("#usergroupphoto").hide();
    }
    select_group(id, false);
  });
  $("#members").change(function() {
    const id = $(this).val();
    if (nodes[id].photo) {
      $("#groupuserphoto").show();
      $("#groupuserphoto").attr("src", nodes[id].photo);
    } else {
      $("#groupuserphoto").hide();
    }
    select_node(nodes[id], false);
  });
  $("#seedConnected").change(function() {
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
    localforage.clear().then(() => {
      location.reload();
    });
  });
  $("#load").click(load_info);
  $("#showGroup").click(show_group);
  $("#copybrightid").click(copy_brightid);
  $("#showMemeber").click(show_member);
  $("#showUser").click(show_user);
  $("#copygroupid").click(copy_groupid);
  $("#uploadregionbtn").click(function(e) {
    e.preventDefault();
    $("#regionfile").click();
  });
  $("#regionfile").change(read_regions);
  $("#searchfield").select2({ tags: true });
  $("#daterange").change(set_date_range);
  $("#fromdate").change(highlight_edges);
  $("#todate").change(highlight_edges);
  update_statistics();
});
