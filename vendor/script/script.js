const open = {'loginDetail': false, 'statisticsDitail': false, 'linkDetail': false, 'userDitail': false, 'groupDitail':false}
function openCollapsible(selectedId, reopen) {
  let tag = $(`#${selectedId}`);
  let wrapper = $('#wrapper');
  wrapper.removeClass('toggled');
  if (! open[selectedId]) {
    tag.removeClass('hiden');
    open[selectedId] = true;
    Object.keys(open).forEach((id) => {
      if (id != selectedId) {
        let t = $(`#${id}`);
        t.addClass('hiden');
        open[id] = false;
      }
    })
  } else if (open[selectedId] && !reopen) {
    tag.addClass('hiden');
    open[selectedId] = false;
  }
}

$('#logoutForm').hide();