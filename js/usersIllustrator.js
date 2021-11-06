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
  this.subgraph = subgraph;

  function reset() {
    if (playerSettingChanged) {
      step = 0;
      $("#date").html("&nbsp;");
      Graph.nodeColor(n => fadedColor);
      Graph.linkVisibility(link => false);
      const fd = $("#fromDate").val();
      const td = $("#toDate").val();
      fromDate = new Date(fd).getTime() - (new Date(fd).getTimezoneOffset() * 60000);
      toDate = new Date(td).getTime() - (new Date(td).getTimezoneOffset() * 60000);
      delay = $("#delay").val() * 1000;
      if (toDate - fromDate >= 24 * 60 * 60 * 1000) {
        stepLength = 24 * 60 * 60 * 1000;
      } else if (toDate - fromDate >= 60 * 60 * 1000) {
        stepLength = 60 * 60 * 1000;
      } else {
        stepLength = 60 * 1000;
      }
      steps = Math.floor((toDate - fromDate) / stepLength);
      playerSettingChanged = false;
    }
  }

  function linkColorByLevel(level) {
    const colors = { "recovery": "blue", "already known": "green", "just met": "yellow", "suspicious": "orange", "reported": "red", "filtered": "gray" };
    return colors[level];
  }

  function subgraph() {
    reset();
    const subgraphLinks = [];
    const subgraphNodes = {};
    for (const link of graphLinks) {
      let filtered = link["history"].filter(function (tl) {
        return fromDate <= tl[0] && tl[0] <= toDate;
      });
      if (filtered.length > 0) {
        subgraphLinks.push({ ...link, history: filtered });
        subgraphNodes[link.source.id] = link.source;
        subgraphNodes[link.target.id] = link.target;
      }
    }
    drawSubgraph(Object.values(subgraphNodes), subgraphLinks);
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
    drawGraph();
    $("#date").html("&nbsp;");
    step = 0;
    return true;
  }

  function next() {
    clearTimeout(task);
    reset();
    if (step + 1 <= steps) {
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
    if (step + 1 <= steps) {
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
    const stepLinks = {};
    const stepNodes = new Set();
    const previousStepsLinks = {};
    let to = fromDate + (step * stepLength);
    let from = to - stepLength;
    if (step == steps) {
      from = fromDate;
      to = toDate;
    }
    graphLinks.forEach((link) => {

      let filtered1 = link["history"].filter(function (tl) {
        return fromDate <= tl[0] && tl[0] < from;
      });
      if (filtered1.length > 0) {
        previousStepsLinks[`${link.source.id}${link.target.id}`] = filtered1[filtered1.length - 1][1];
        stepNodes.add(link.source.id);
        stepNodes.add(link.target.id);
      }

      let filtered2 = link["history"].filter(function (tl) {
        return from <= tl[0] && tl[0] <= to;
      });
      if (filtered2.length > 0) {
        stepLinks[`${link.source.id}${link.target.id}`] = filtered2[filtered2.length - 1][1];
        stepNodes.add(link.source.id);
        stepNodes.add(link.target.id);
      }

    });

    if (stepLength < 24 * 60 * 60 * 1000) {
      $("#date").html(new Date(to).toJSON().split(".")[0].replace("T", " "));
    } else {
      $("#date").html(new Date(to).toJSON().split("T")[0]);
    }
    Graph.nodeColor(n => stepNodes.has(n.id) ? resetNodesColor(n) : fadedColor)
      .linkVisibility((l) => (`${l.source.id}${l.target.id}` in stepLinks || `${l.source.id}${l.target.id}` in previousStepsLinks ? true : false))
      .linkWidth((l) => (`${l.source.id}${l.target.id}` in stepLinks ? 0.4 : linkWidth))
      .linkColor((l) => (`${l.source.id}${l.target.id}` in stepLinks ? linkColorByLevel(stepLinks[`${l.source.id}${l.target.id}`]) : fadedColor))
      .linkDirectionalArrowLength((l) => `${l.source.id}${l.target.id}` in stepLinks ? 8 : 1);
  }
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

function playBtnUI() {
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
}

function stopBtnUI() {
  if ($("#playBtn").hasClass("fa-pause")) {
    $("#playBtn").removeClass("fa-pause");
    $("#playBtn").addClass("fa-play");
  }
  playerState = "stopped";
  gPlayer.stop();
}

function previousBtnUI() {
  if ($("#playBtn").hasClass("fa-pause")) {
    $("#playBtn").removeClass("fa-pause");
    $("#playBtn").addClass("fa-play");
  }
  playerState = "paused";
  gPlayer.previous();
}

function nextBtnUI() {
  if ($("#playBtn").hasClass("fa-pause")) {
    $("#playBtn").removeClass("fa-pause");
    $("#playBtn").addClass("fa-play");
  }
  playerState = "paused";
  gPlayer.next();
}

function subgraphBtnUI() {
  gPlayer.subgraph();
}