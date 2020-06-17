function copy_brightid() {
  $("#brightidtext").select();
  document.execCommand("copy");
}

function copy_group() {
  $("#groupstext").val($('#groups').val());
  $("#groupstext").select();
  document.execCommand("copy");
}

function copy_groupid() {
  $("#groupidtext").select();
  document.execCommand("copy");
}

function copy_member() {
  $("#memberstext").val($('#members').val());
  $("#memberstext").select();
  document.execCommand("copy");
}


function open_nav() {
  document.getElementById("sidenav").style.width = "300px";
}

function close_nav() {
  document.getElementById("sidenav").style.width = "0";
}

function set_nav(type) {
  for (let id of ['userform', 'groupform', 'menuform']) {
    $('#'+id).hide();
  }
  $('#'+type+'form').show();
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
  const lines = s.split('\n');
  for (let line of lines) {
    line = line.trim();
    const [region, id] = line.split('\t');
    let type;
    if (!regions[region]) {
      regions[region] = [];
      $("<option>").val(region).text(region).appendTo('#regionsgroup');
    }
    if (!regions[region].includes(id)) {
      regions[region].push(id);
    }
  }
  $("#searchfield").select2({ tags: true });
}

const big_r = 8;
const small_r = 6;

function b64ToUrlSafeB64(s) {
  const alts = {
    '/': '_',
    '+': '-',
    '=': '',
  };
  return s.replace(/[/+=]/g, (c) => alts[c]);
}

function hash(data) {
  const h = CryptoJS.SHA256(data);
  const b = h.toString(CryptoJS.enc.Base64);
  return b64ToUrlSafeB64(b);
}

function color(node) {
  if (node.node_type == 'Seed') {
    return 'blue';
  } else if (node.verifications && node.verifications.includes('BrightID')) {
    return 'green';
  } else {
    return 'yellow';
  }
};

function move(x, y, z) {
  svg.transition().duration(1500)
    .call(zoom.translate([((x*-1*z) + (window.innerWidth/2)), ((y*-1*z) + window.innerHeight/2)])
    .scale(z).event);
}


last_selected_ids = [];
function reset_colors(next, selected_member) {
  last_selected_ids.forEach(id => {
    const circle = d3.select((nodes[id].name ? '#back_' : '#node_')+id);
    circle.style('fill', color(nodes[id]));
  });
  last_selected_ids = next;
  next.forEach(id => {
    const circle = d3.select((nodes[id].name ? '#back_' : '#node_')+id);
    circle.style('fill', id != selected_member ? 'orange' : 'red');
  });
}

function set_photo(id, photo) {
  const node = d3.select('#node_'+id);
  const p = d3.select(node[0][0].parentNode);
  const r = nodes[id].rank >= 90 ? big_r : small_r;
  const size = nodes[id].rank >= 90 ? 'big' : 'small';
  p.append('circle')
    .attr('id', 'back_' + id)
    .attr('r', r+2)
    .style('fill', function(d) {
      return color(d)
    });

  p.append("image")
    .attr("x", -r)
    .attr("y", -r)
    .attr("width", r*2)
    .attr("height", r*2)
    .attr("xlink:href", photo)
    .attr("clip-path", "url(#"+size+"-avatar-clip)")  
}

function select_group(id, selected_member, show_details) {
  let sum_x = 0, sum_y = 0;
  const group = groups[id];
  for (member of group.members) {
    sum_x += nodes[member].x;
    sum_y += nodes[member].y;
  }
  reset_colors(group.members, selected_member);
  const n = group.members.length;
  move(sum_x/n, sum_y/n, 1.2);

  if (group.name) {
    $('#groupname').show();
    $('#groupname').html(group.name);
  } else {
    $('#groupname').hide();
  }
  if (group.photo) {
    $('#groupphoto').show();
    $('#groupphoto').attr("src", group.photo);
  } else {
    $('#groupphoto').hide();
  }
  $('#grouprank').html(group.rank);
  $('#groupid').html(id);
  $('#groupidtext').val(id);
  
  $('#groupuserphoto').hide();
  $("#members").empty().append(new Option('', 'none'));
  for (const member of group.members) {
    $("#members").append(new Option(nodes[member].name || member, member));
  };

  if (show_details) {
    set_nav('group');
    open_nav();
  }
}

function select_region(name) {
  if (name == 'Complete Graph') {
    const centerNode = nodes['AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA'];
    reset_colors([]);
    return move(centerNode.x, centerNode.y, 0.8);
  }
  let sum_x = 0, sum_y = 0, count = 0;
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
  reset_colors(members);
  const n = members.length;
  move(sum_x/n, sum_y/n, 1.2);
}

function select_node(id, show_details) {
  const node = nodes[id];
  if (node.name) {
    $('#name').show();
    $('#name').html(node.name);
  } else {
    $('#name').hide();
  }
  if (node.photo) {
    $('#photo').show();
    $('#photo').attr("src", node.photo);
  } else {
    $('#photo').hide();
  }
  $('#rank').html(node.rank);
  $('#brightid').html(node.id);
  $('#brightidtext').val(node.id);
  move(node.x, node.y, 2);
  reset_colors([node.id, ...node.connections], node.id);
  
  $('#usergroupphoto').hide();
  $("#groups").empty().append(new Option('', 'none'));
  for (const g of node.groups) {
    $("#groups").append(new Option(get_group_name(g), g));
  };
  if (show_details) {
    set_nav('user');
    open_nav();
  }
}

function get_group_name(g) {
  return (groups[g] && groups[g].name) || g;
}

function load_users(user, key1, password) {
  $("<option>").val(user.id).text(user.name).appendTo('#usersgroup');
  $.get(`/storage/${key1}/${user.id}`).done(data => {
    data = CryptoJS.AES.decrypt(data, password).toString(
      CryptoJS.enc.Utf8,
    );
    Object.assign(nodes[user.id], {
      name: user.name,
      photo: data
    });
    set_photo(user.id, nodes[user.id].photo);
  });
  for (const c of (user.connections || [])) {
    // skip c.id === user.id to solve bugs related to users connected to themselves!
    if (!nodes[c.id] || c.id === user.id) {
      continue
    }
    $("<option>").val(c.id).text(c.name).appendTo('#usersgroup');
    Object.assign(nodes[c.id], { name: c.name });
    $.get(`/storage/${key1}/${c.id}`).done(data => {
      data = CryptoJS.AES.decrypt(data, password).toString(
        CryptoJS.enc.Utf8,
      );
      Object.assign(nodes[c.id], { photo: data });
      set_photo(c.id, nodes[c.id].photo);
    });
  }
  $("#searchfield").select2({ tags: true });
}

function load_groups(user, key1, password) {
  for (const g of (user.groups || [])) {
    if (!groups[g.id]) {
      continue;
    }
    Object.assign(groups[g.id], { name: g.name });
    if (g.name) {
      $("<option>").val(g.id).text(g.name).appendTo('#groupsgroup');
    }
    if (!g.url) {
      continue;
    }
    const url = '/storage/immutable' + g.url.split('immutable')[1];
    $.get(url).done(data => {
      data = CryptoJS.AES.decrypt(data, g.aesKey).toString(
        CryptoJS.enc.Utf8,
      );
      Object.assign(groups[g.id], { photo: JSON.parse(data).photo });
    });

  };
  $("#searchfield").select2({ tags: true });
}

async function load_info() {
  const code = $('#code').val();
  const password = $('#password').val();
  const aesKey = code.substr(0, 24);
  const uuid = code.substr(24, 12);
  const b64ip = `${code.substr(36, 6)}==`;
  const ipAddress = Uint8Array.from(atob(b64ip), c => c.charCodeAt(0)).join('.');
  const data = await $.get(`/profile/download/${uuid}1`);
  if (!data.data) {
    return alert('no result found');
  }
  const decrypted = CryptoJS.AES.decrypt(data.data, aesKey).toString(
    CryptoJS.enc.Utf8,
  );
  user = JSON.parse(decrypted);
  const api_data = await $.get('/api/v4/users/' + user.id);
  Object.assign(user, api_data);
  const key1 = hash(user.id + password);
  backup_data = await $.get(`/storage/${key1}/data`);
  backup_data = CryptoJS.AES.decrypt(backup_data, password).toString(
    CryptoJS.enc.Utf8,
  );
  close_nav();
  $('#loginform').hide();
  $('#logoutbtn').show();

  if (!backup_data) {
    return alert('no backup found');
  }
  backup_data = JSON.parse(backup_data);
  Object.assign(user, {
    ...backup_data.userData,
    connections: backup_data.connections,
    groups: backup_data.groups
  });
  load_users(user, key1, password);
  load_groups(user, key1, password);
}

$( document ).ready(function() {
  $.get('/backups/brightid.json', function (json) {
    json = JSON.parse(json);
    nodes = {};
    json.nodes.forEach(node => node.size = parseInt(node.rank) >= 90 ? 8 : 5);
    json.nodes.forEach(node => nodes[node.id] = node);
    groups = {};
    json.nodes.forEach(node => {
      node.groups.forEach(group => {
        if (!groups[group]) {
          groups[group] = { members: [] };
        }
        groups[group].members.push(node.id);
      });
    });
    json.groups.forEach(group => {
      groups[group.id] = Object.assign(groups[group.id] || {}, group);
      if (group.region) {
        const region = group.region;
        if (!regions[region]) {
          regions[region] = [];
          $("<option>").val(region).text(region).appendTo('#regionsgroup');
        }
        if (!regions[region].includes(group.id)) {
          regions[region].push(group.id);
        }
      }
    });
    json.nodes.forEach(node => nodes[node.id].connections = []);
    json.edges.forEach(edge => {
      nodes[edge[0]].connections.push(edge[1]);
      nodes[edge[1]].connections.push(edge[0]);
    });

    draw_graph(json, color, (node) => {
      select_node(node.id, true);
    });
  });
  $('#searchfield').change(function() {
    const val = $('#searchfield').val();
    if (! val) {
      return;
    }
    const id = val.trim();
    if (nodes[id]) {
      select_node(id, true);
    } else if (groups[id]) {
      select_group(id, null, true);
    } else if (regions[id] || id =='Complete Graph') {
      select_region(id);
    } else {
      return;
    }
  });

  $('#groups').change(function() {
    const id = $(this).val();
    if (groups[id].photo) {
      $('#usergroupphoto').show();
      $('#usergroupphoto').attr("src", groups[id].photo);
    } else {
      $('#usergroupphoto').hide();
    }
    select_group(id, $('#brightidtext').val(), false);
  });

  $('#members').change(function() {
    const id = $(this).val();
    if (nodes[id].photo) {
      $('#groupuserphoto').show();
      $('#groupuserphoto').attr("src", nodes[id].photo);
    } else {
      $('#groupuserphoto').hide();
    }
    select_node(id, false);
  });

  $('#menubtn').click(() => {
    set_nav('menu');
    open_nav();
  });
  $('#logoutbtn').click(() => {
    location.reload();
  });
  $('#load').click(load_info);
  $('#copygroup').click(copy_group);
  $('#copybrightid').click(copy_brightid);
  $('#copymember').click(copy_member);
  $('#copygroupid').click(copy_groupid);
  $('#uploadregionbtn').click(function(e){
    e.preventDefault();
    $('#regionfile').click();
  });
  $('#regionfile').change(read_regions);
  $("#searchfield").select2({ tags: true });
});

function draw_graph(server_graph, color, clickHandler) {
  var w = window.innerWidth;
  var h = window.innerHeight;

  var outline = false;

  var size = d3.scale.pow().exponent(1)
    .domain([1, 100])
    .range([8, 24]);

  var force = d3.layout.force()
    .linkDistance(60)
    .charge(-300)
  .size([w,h]);

  var default_node_color = "#ccc";
  //var default_node_color = "rgb(3,190,100)";
  var default_link_color = "brown";
  var nominal_stroke = .5;
  var max_stroke = 4.5;
  var min_zoom = 0.1;
  var max_zoom = 7;
  d3.select("#graph_div").selectAll("*").remove();
  svg = d3.select("#graph_div").append("svg");
  defs = svg.append("defs");
  defs.append("clipPath")
    .attr("id", "small-avatar-clip")
    .append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", small_r)
    .style("stroke-width", 3)
    .style('stroke', "red");

  defs.append("clipPath")
    .attr("id", "big-avatar-clip")
    .append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", big_r);
  zoom = d3.behavior.zoom().scaleExtent([min_zoom, max_zoom])
  var g = svg.append("g");
  svg.style("cursor", "move");
  graph = {
    'links': [],
    'nodes': server_graph.nodes
  };
  var nodes_map = {}
  for (var i = 0; i < server_graph.nodes.length; i++) {
    nodes_map[server_graph.nodes[i].id] = i
  }
  server_graph.edges.forEach(function(e) {
    graph.links.push({
      'source': nodes_map[e[0]],
      'target': nodes_map[e[1]]
    });
  });
  var linkedByIndex = {};
  graph.links.forEach(function(d) {
    linkedByIndex[d.source + "," + d.target] = true;
  });

  force
    .nodes(graph.nodes)
    .links(graph.links)
    .start();

  var link = g.selectAll(".link")
    .data(graph.links)
    .enter().append("line")
    .attr("class", "link")
    .style("stroke-width", nominal_stroke)
    .style("stroke", default_link_color)

  var node = g.selectAll(".node")
    .data(graph.nodes)
    .enter().append("g")
    .attr("class", "node")
    .call(force.drag)
  node.on("dblclick.zoom", function(d) {
    d3.event.stopPropagation();
    var dcx = (window.innerWidth / 2 - d.x * zoom.scale());
    var dcy = (window.innerHeight / 2 - d.y * zoom.scale());
    zoom.translate([dcx, dcy]);
    g.attr("transform", "translate(" + dcx + "," + dcy + ")scale(" + zoom.scale() + ")");
  });

  var tocolor = "fill";
  var towhite = "stroke";
  if (outline) {
    tocolor = "stroke"
    towhite = "fill"
  }
  var circle = node.append("path")
    .attr("d", d3.svg.symbol()
      .size(function(d) {
        return Math.PI * Math.pow(d.size, 2);
      })
      .type(function(d) {
        return d.type;
      }))
    .style(tocolor, function(d) {
      return color(d);
    })
    .attr("id", function (d) {
      return 'node_' + d.id;
    })

  node.on("click", clickHandler);
  node.on("mouseover", function(d) {
    svg.style("cursor", "pointer");
  }).on("mouseout", function(d) {
    svg.style("cursor", "move");
  });

  zoom.on("zoom", function() {
    var stroke = nominal_stroke;
    if (nominal_stroke * zoom.scale() > max_stroke) stroke = max_stroke / zoom.scale();
    link.style("stroke-width", stroke);
    // circle.style("stroke-width", stroke);
    circle.attr("d", d3.svg.symbol()
      .size(function(d) {
        return Math.PI * Math.pow(d.size, 2);
      })
      .type(function(d) {
        return d.type;
      }))


    g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
  });

  svg.call(zoom);

  resize();
  window.focus();
  d3.select(window).on("resize", resize);

  force.on("tick", function() {

    node.attr("transform", function(d) {
      return "translate(" + d.x + "," + d.y + ")";
    });

    link.attr("x1", function(d) {
        return d.source.x;
      })
      .attr("y1", function(d) {
        return d.source.y;
      })
      .attr("x2", function(d) {
        return d.target.x;
      })
      .attr("y2", function(d) {
        return d.target.y;
      });

    node.attr("cx", function(d) {
        return d.x;
      })
      .attr("cy", function(d) {
        return d.y;
      });
  });

  function resize() {
    var width = $("#graph_div").width(),
      height = $("#graph_div").height();
    svg.attr("width", width).attr("height", height);
    force.size([force.size()[0] + (width - w) / zoom.scale(), force.size()[1] + (height - h) / zoom.scale()]).resume();
  }

  function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  function isConnected(a, b) {
    return linkedByIndex[a.index + "," + b.index] || linkedByIndex[b.index + "," + a.index] || a.index == b.index;
  }

  function hasConnections(a) {
    for (var property in linkedByIndex) {
      s = property.split(",");
      if ((s[0] == a.index || s[1] == a.index) && linkedByIndex[property]) return true;
    }
    return false;
  }

}