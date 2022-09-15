(function() {
	const classname = Math.random().toString(36).replace(/[^a-z]+/g, '');
	
	var l = document.location,
		is_audioboom = false,
		is_dailymotion = false,
		is_dailybuzz = false,
		is_playerclipslaliga = false;
	
	switch (l.hostname) {
		
		case 'embeds.audioboom.com':
			is_audioboom = true;
			break;
		
		case 'www.dailymotion.com':
			is_dailymotion = l.pathname.indexOf('/embed') === 0;
			break;
		
		case 'geo.dailymotion.com':
			is_dailymotion = l.pathname.indexOf('/player') === 0;
			break;
		
		case 'dailybuzz.nl':
			is_dailybuzz = l.pathname.indexOf('/buzz/embed') === 0;
			break;
		
		case 'playerclipslaliga.tv':
			is_playerclipslaliga = true;
			break;
	}
	
	
	function searchEmbeds() {
		setTimeout(function() {
			
			// audioboom.com iframe embeds
			if (is_audioboom) {
				document.querySelectorAll('div[id^="cookie-modal"] .modal[style*="block"] .btn.mrs:not(.' + classname + ')').forEach(function(button) {
					button.className += ' ' + classname;
					button.click();
				});
			}
			
			// dailymotion.com iframe embeds
			else if (is_dailymotion) {
				document.querySelectorAll('.np_DialogConsent-accept:not(.' + classname + ')').forEach(function(button) {
					button.className += ' ' + classname;
					button.click();
				});
			}
			
			// dailybuzz.nl iframe embeds
			else if (is_dailybuzz) {
				document.querySelectorAll('#ask-consent #accept:not(.' + classname + ')').forEach(function(button) {
					button.className += ' ' + classname;
					button.click();
				});
			}
			
			// playerclipslaliga.tv iframe embeds
			else if (is_playerclipslaliga) {
				document.querySelectorAll('#cookies button[onclick*="saveCookiesSelection"]:not(.' + classname + ')').forEach(function(button) {
					button.className += ' ' + classname;
					button.click();
				});
			}
			
			// Give up
			else {
				return;
			}
			
			searchEmbeds();
		}, 1000);
	}

	var start = setInterval(function() {
		var html = document.querySelector('html');
		
		if (!html || (new RegExp(classname)).test(html.className))
			return;
		
		html.className += ' ' + classname;
		searchEmbeds();
		clearInterval(start);
	}, 500);
})();