function drawLasso() {
  var canvas = document.getElementsByTagName("canvas")[0];
  var ctx = canvas.getContext("2d");

  canvas.addEventListener("mousedown", onMouseDown, false);
  canvas.addEventListener("mousemove", onMouseMove, false);
  window.addEventListener("mouseup", onMouseUp, false);

  const size = 4 / Graph.zoom() ** 0.5;

  var lastX;
  var lastY;

  var mouse = {
    x: 0,
    y: 0,
    down: 0
  };

  function draw(x, y) {
    if (lastX && lastY && (x !== lastX || y !== lastY)) {
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.fill();
      ctx.stroke();
    }
    lastX = x;
    lastY = y;
  }

  function onMouseDown() {
    mouse.down = 1;
    draw(mouse.x, mouse.y);
  }

  function onMouseUp() {
    mouse.down = 0;
    lastX = 0;
    lastY = 0;
  }

  function onMouseMove(e) {
    getMousePos(e);
    if (mouse.down == 1) {
      draw(mouse.x, mouse.y);
      areaPoints.push([mouse.x, mouse.y]);
    }
  }

  function getMousePos(e) {
    if (!e) var e = event;
    let p = Graph.screen2GraphCoords(
      e.offsetX || e.layerX,
      e.offsetY || e.layerX
    );
    mouse.x = p.x;
    mouse.y = p.y;
  }
}
