Highcharts.getJSON(
  '../brightid.json',
  (data) => {
    loadNames()
      .then(() => {
        draw(data);
        loadGrid(data);
      });
  }
);

const period = window.location.href.indexOf('hourly') > 0 ? 'hourly' : 'daily';
const type = window.location.href.indexOf('groups') > 0 ? 'seed_groups' : 'seeds';

function total(data, border) {
  s = 0;
  data.filter(
    row => !border || row[0] > border
  ).forEach(row => {
    s += row[1];
  });
  return s;
}

async function loadNames() {
  let backup_data = await localforage.getItem('explorer_backup_data');
  names = {}
  if (backup_data) {
    backup_data = JSON.parse(backup_data);
    names[backup_data.id] = backup_data.name;
    backup_data.connections.forEach(c => {
      names[c.id] = c.name;
    });
  }
}

function draw(data) {
  const series = [];
  const k = type + '_' + period;
  for (let g in data[k]) {
    series.push({
      type: 'area',
      name: (type == 'seeds' && names[g]) || g,
      hasName: names[g] ? true : false,
      data: data[k][g],
      visible: (type == 'seed_groups' || names[g]) ? true : false
    });
  }
  series.sort((s1, s2) => total(s2.data) - total(s1.data));
  chart = Highcharts.chart('container', {
    chart: {
      zoomType: 'x',
      // height: '100%',
    },
    title: {
      text: type.replace('_', ' ') + ' - ' + period
    },
    subtitle: {
      text: document.ontouchstart === undefined ?
        'Click and drag in the plot area to zoom in' : 'Pinch the chart to zoom in'
    },
    legend: {
      maxHeight: 150,
    },
    xAxis: {
      type: 'datetime'
    },
    yAxis: {
      title: {
        text: 'Number of New Connections'
      }
    },
    plotOptions: {
      area: {
        stacking: 'normal',
        lineColor: '#666666',
        lineWidth: 1,
        marker: {
          lineWidth: 1,
          lineColor: '#666666'
        }
      }
    },
    series
  });
  $(document).on('click', '#hide-all', function () {
    $.each(chart.series, function (i, ser) {
      ser.setVisible(false, false);
    });
    chart.redraw();
  });
  $(document).on('click', '#show-all', function () {
    $.each(chart.series, function (i, ser) {
      ser.setVisible(true, false);
    });
    chart.redraw();
  });
  $(document).on('click', '#show-known', function () {
    $.each(chart.series, function (i, ser) {
      ser.setVisible(ser.userOptions.hasName || type == 'seed_groups', false);
    });
    chart.redraw();
  });
}

function loadGrid(data) {
  const rows = [];

  now = Date.now();
  map = {}
  const k = type + '_' + period;
  for (let g in data[k]) {
    if (period == 'daily') {
      var header = ["Name", "Quota", "Last week", "Last month", "Last year"];
      map[names[g] || g] = [
        total(data[k][g], now - 7 * 24 * 3600 * 1000),
        total(data[k][g], now - 30 * 24 * 3600 * 1000),
        total(data[k][g]),
      ];
    } else {
      var header = ["Name", "Quota", "Last day", "Last 2 days", "Last week"];
      map[names[g] || g] = [
        total(data[k][g], now - 1 * 24 * 3600 * 1000),
        total(data[k][g], now - 2 * 24 * 3600 * 1000),
        total(data[k][g]),
      ];
    }
  }
  if (type == 'seed_groups') {
    data.groups.filter(
      (g) => g.seed
    ).forEach((g) => {
      rows.push([
        g.region || g.id,
        g.quota,
        map[g.region || g.id][0],
        map[g.region || g.id][1],
        map[g.region || g.id][2],
      ]);
    });
  } else {
    const quotas = {};
    data.nodes.forEach(n => {
      quotas[n.id] = n.quota;
    });
    for (let g in data[k]) {
      rows.push([
        names[g] || g,
        quotas[g] || 0,
        map[names[g] || g][0],
        map[names[g] || g][1],
        map[names[g] || g][2],
      ]);
    };
  }

  rows.sort((row1, row2) => row2[1] - row1[1]);
  new gridjs.Grid({
    columns: header,
    data: rows,
    sort: true,
    pagination: {
      enabled: true,
      limit: 20,
      summary: false
    }
  }).render(document.getElementById("wrapper"));
}
