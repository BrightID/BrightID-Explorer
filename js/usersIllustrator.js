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
      $("#date").html("&nbsp;");
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
    $("#date").html("&nbsp;");
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
    let to = fromDate + (step * stepLength);
    let from = to - stepLength;
    if (step + 1 == steps) {
      from = fromDate;
      to = toDate;
    }
    graphLinks.forEach((link) => {
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
      $("#date").html(new Date(to).toJSON().split(".")[0].replace("T", " "));
    } else {
      $("#date").html(new Date(to).toJSON().split("T")[0]);
    }
    Graph.nodeColor(n => stepNodes.has(n.id) ? resetNodesColor(n) : fadedColor);
    Graph.linkVisibility((link) => (stepLinks.has(link) || previousStepsLinks.has(link) ? true : false));
    Graph.linkWidth((link) => (stepLinks.has(link) ? selectedLinkWidth : linkWidth))
      .linkColor((link) => (stepLinks.has(link) ? resetLinksColor(link) : fadedColor))
      .linkDirectionalArrowLength((link) => stepLinks.has(link) ? 16 : 6);
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