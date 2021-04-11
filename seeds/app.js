Highcharts.getJSON(
  '../brightid.json',
  draw
);

const period = window.location.href.indexOf('hourly') > 0 ? 'hourly' : 'daily';
function draw(data) {
  const series = [];
  for (let g in data[period]) {
    series.push({
      type: 'area',
      name: g,
      data: data[period][g]
    });
  }
  
  Highcharts.chart('container', {
    chart: {
      zoomType: 'x'
    },
    title: {
      text: 'Seed groups connections - ' + period
    },
    subtitle: {
      text: document.ontouchstart === undefined ?
        'Click and drag in the plot area to zoom in' : 'Pinch the chart to zoom in'
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
}
