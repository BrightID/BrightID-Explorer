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

$('#logoutbtnform').hide();

function creatCard(title , text){
  let newCard= '<dive class="row justify-content-md-center mt-2"><div class="card verificationsCard border-dark mb-3" style="max-width: 18rem;"><div class="card-header text-dark text-center"><h7>'+ title + '<i class="fas fa-check-circle ml-2 text-primary"></i></h7></div><div class="card-body text-dark justify-center"><p class="card-title text-center">' + text + '</p></div></div></dive>';
  return newCard;
}
