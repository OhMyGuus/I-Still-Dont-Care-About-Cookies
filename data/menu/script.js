var toggle = document.getElementById('toggle'),
	refresh = document.getElementById('refresh'),
	report = document.getElementById('report'),
	options = document.getElementById('options'),
	support = document.getElementById('support'),
	currentTab = false;

support.textContent = chrome.i18n.getMessage("menuSupport");
report.textContent = chrome.i18n.getMessage("menuReport");
options.textContent = chrome.i18n.getMessage("optionsTitle");


function reloadMenu(enable_refresh_button)
{
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.runtime.sendMessage({
			command: "get_active_tab",
			tabId: tabs[0].id
		}, function(message) {
		
			message = message || {};
			currentTab = message.tab ? message.tab : false;
			
			if (message.tab && message.tab.hostname)
			{
				toggle.textContent = chrome.i18n.getMessage(message.tab.whitelisted ? "menuEnable" : "menuDisable", message.tab.hostname);
				toggle.style.display = 'block';
				
				report.style.display = message.tab.whitelisted ? 'none' : 'block';
			}
			else
			{
				toggle.textContent = '';
				toggle.style.display = 'none';
				
				report.style.display = 'none';
			}
			
			if (typeof enable_refresh_button != 'undefined')
			{
				refresh.style.display = 'block';
				toggle.style.display = 'none';
				report.style.display = 'none';
			}
		});
	});
}


toggle.addEventListener('click', function(e) {
	chrome.runtime.sendMessage({
		command: "toggle_extension",
		tabId: currentTab.id
	}, function(message) {
		reloadMenu(true);
	});
});

refresh.addEventListener('click', function(e) {
	chrome.runtime.sendMessage({
		command: "refresh_page",
		tabId: currentTab.id
	}, function(message) {
		window.close();
	});
});

report.addEventListener('click', function(e) {
	chrome.runtime.sendMessage({
		command: "report_website",
		tabId: currentTab.id
	}, function(message) {
		window.close();
	});
});

support.addEventListener('click', function(e) {
	chrome.runtime.sendMessage({
		command: "open_support_page",
	}, function(message) {
		window.close();
	});
});

options.addEventListener('click', function(e) {
	chrome.runtime.sendMessage({
		command: "open_options_page",
	}, function(message) {
		window.close();
	});
});

reloadMenu();