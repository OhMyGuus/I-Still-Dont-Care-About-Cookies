let t = 0;

const i = setInterval(function () {
  const e = document.querySelector(".CookiesOK");
  t++;

  if (e) {
    e.click();
  }

  if (e || t == 200) {
    clearInterval(i);
  }
}, 500);
