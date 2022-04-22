var sPlayer = new starsPlayer();
var colors = ["purple", "blue", "green", "red", "orange", "brown"]

function starsPlayer() {
  let task;
  let fromDate;
  let toDate;
  let delay;
  let stepLength;
  let steps;
  let step = 0;
  // const seedsColor = {};
  const allConnected = {};
  let sortedKeys = [];
  const colored = {};

  this.start = start;
  this.pause = pause;
  this.stop = stop;
  this.next = next;
  this.previous = previous;
  this.reset = reset;

  function reset() {
    if (playerSettingChangedSI) {
      fromDate = new Date($("#fromDateSI").val()).getTime();
      toDate = new Date($("#toDateSI").val()).getTime() + 24 * 60 * 60 * 1000;
      $("#levelsRange").val(1);
      $("#connectionLevel").html("Just met");
      $("#linkVisibility").prop("checked", false);
      drawGraph();
      graphLinks.forEach((l) => {
        const timestamp = l.history[l.history.length - 1][0]
        if (l.source?.node_type != "Seed" ||
          l.level == "reported" ||
          timestamp < fromDate ||
          timestamp > toDate
        ) {
          return;
        }
        if (!(l.source.id in allConnected)) {
          allConnected[l.source.id] = {};
        }
        allConnected[l.source.id][l.target.id] = timestamp;
      });
      sortedKeys = Object.keys(allConnected);
      sortedKeys.sort(function (a, b) {
        return Object.keys(allConnected[b]).length - Object.keys(allConnected[a]).length;
      });
      for (var i = sortedKeys.length - 1; i > 0; i--) {
        const seed = sortedKeys[i];
        Object.keys(allConnected[seed]).forEach(n => {
          const colorId = Math.min(i, 5);
          colored[n] = { "color": colors[colorId], "groupId": i, "timestamp": allConnected[seed][n] };
        })
      }
      step = 0;
      $("#dateSI").html("&nbsp;");
      Graph.nodeColor(fadedColor);
      Graph.linkVisibility(false);
      delay = $("#delaySI").val() * 1000;
      if (toDate - fromDate == 24 * 60 * 60 * 1000) {
        stepLength = 60 * 60 * 1000;
      } else {
        stepLength = 24 * 60 * 60 * 1000;
      }
      steps = Math.floor((toDate - fromDate) / stepLength);
      playerSettingChangedSI = false;
    }
    $("#defaultLegend").hide();
    $("#customizedLegend").html(`
      <div class="legend-title">Node colors</div>
      <div class="legend-scale">
        <ul class="legend-labels">
          <li><span style="background:purple;"></span>Connected to ${graphNodes[sortedKeys[0]]?.name || sortedKeys[0] || "__"}</li>
          <li><span style="background:blue;"></span>Connected to ${graphNodes[sortedKeys[1]]?.name || sortedKeys[1] || "__"}</li>
          <li><span style="background:green;"></span>Connected to ${graphNodes[sortedKeys[2]]?.name || sortedKeys[2] || "__"}</li>
          <li><span style="background:red;"></span>Connected to ${graphNodes[sortedKeys[3]]?.name || sortedKeys[3] || "__"}</li>
          <li><span style="background:orange;"></span>Connected to ${graphNodes[sortedKeys[4]]?.name || sortedKeys[4] || "__"}</li>
          <li><span style="background:brown;"></span>Connected to other seeds</li>
        </ul>
      </div>
    `);
    $("#customizedLegend").show();
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
    $("#defaultLegend").show();
    $("#customizedLegend").hide();
    drawGraph();
    $("#dateSI").html("&nbsp;");
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
      PlayerStateSI = "stopped";
      if ($("#playBtnSI").hasClass("fa-pause")) {
        $("#playBtnSI").removeClass("fa-pause");
        $("#playBtnSI").addClass("fa-play");
      }
      return true;
    }
  }

  function drawStep() {
    const to = fromDate + (step * stepLength);
    let from = to - stepLength;
    if (stepLength == 60 * 60 * 1000) {
      $("#dateSI").html(new Date(to).toLocaleString());
    } else {
      $("#dateSI").html(new Date(to).toLocaleDateString());
    }

    function setColor(n) {
      if (step + 1 == steps) {
        from = fromDate;
      }
      if (n.id in colored && from <= colored[n.id]["timestamp"] && colored[n.id]["timestamp"] <= to) {
        return colored[n.id]["color"];
      }
      else {
        return fadedColor;
      }
    }

    function setSize(n) {
      if (n.id in colored && fromDate <= colored[n.id]["timestamp"] && colored[n.id]["timestamp"] <= to) {
        return 50;
      } else {
        return 1;
      }
    }
    Graph.nodeColor(setColor);
    Graph.nodeVal(setSize);
  }
}

function setDateRangeSI() {
  const v = $("#dateRangeSI").val();
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
  $("#fromDateSI").val(fromDate.toISOString().split("T")[0]);
  $("#toDateSI").val(new Date(today).toISOString().split("T")[0]);
  playerSettingChangedSI = true;
}

function playBtnSI() {
  if (PlayerStateSI == "stopped" || PlayerStateSI == "paused") {
    $("#playBtnSI").removeClass("fa-play");
    $("#playBtnSI").addClass("fa-pause");
    PlayerStateSI = "playing";
    sPlayer.start();
  } else if (PlayerStateSI == "playing") {
    $("#playBtnSI").removeClass("fa-pause");
    $("#playBtnSI").addClass("fa-play");
    PlayerStateSI = "paused";
    sPlayer.pause();
  }
}

function stopBtnSI() {
  if ($("#playBtnSI").hasClass("fa-pause")) {
    $("#playBtnSI").removeClass("fa-pause");
    $("#playBtnSI").addClass("fa-play");
  }
  PlayerStateSI = "stopped";
  sPlayer.stop();
}

function previousBtnSI() {
  if ($("#playBtnSI").hasClass("fa-pause")) {
    $("#playBtnSI").removeClass("fa-pause");
    $("#playBtnSI").addClass("fa-play");
  }
  PlayerStateSI = "paused";
  sPlayer.previous();
}

function nextBtnSI() {
  if ($("#playBtnSI").hasClass("fa-pause")) {
    $("#playBtnSI").removeClass("fa-pause");
    $("#playBtnSI").addClass("fa-play");
  }
  PlayerStateSI = "paused";
  sPlayer.next();
}