var t = 0;

var i = setInterval(function(){
	var e = document.querySelector('.CookiesOK');
	t++;
	
	if (e)
		e.click();
	
	if (e || t == 200)
		clearInterval(i);
}, 500);