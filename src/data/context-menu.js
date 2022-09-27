// Vars

var cached_rules = {},
	whitelisted_domains = {},
	tab_list = {},
	xml_tabs = {};
	lastDeclarativeNetRuleId = 1;

const isManifestV3 = chrome.runtime.getManifest().manifest_version == 3;

if (isManifestV3) {
	/* rules.js */
	try {
		importScripts("rules.js");
	} catch (e) {
		console.log(e);
	}
}

// Common functions

function getHostname(url, cleanup)
{
	try
	{
		if (url.indexOf('http') != 0)
			throw true;
		
		var a = new URL(url);
		
		return (typeof cleanup == 'undefined' ? a.hostname : a.hostname.replace(/^w{2,3}\d*\./i, ''));
	}
	catch(error)
	{
		return false;
	}
}


// Whitelisting
function updateWhitelist() {
	lastDeclarativeNetRuleId = 1;
	chrome.storage.local.get('whitelisted_domains', async (storedWhitelist) => {

		if (typeof storedWhitelist.whitelisted_domains != 'undefined')
			whitelisted_domains = storedWhitelist.whitelisted_domains;

		if (isManifestV3) {
			await UpdateWhitelistRules();
		}
	});
}

async function UpdateWhitelistRules() {
	if (!isManifestV3) {
		console.warn("Called unsupported function")
		return;
	}
	let previousRules = (await chrome.declarativeNetRequest.getDynamicRules()).map((v) => { return v.id; });
	let addRules = Object.entries(whitelisted_domains).filter((element) => element[1]).map((v) => {
		return {
			"id": lastDeclarativeNetRuleId++,
			"priority": 1,
			"action": { "type": "allow" },
			"condition": {
				"urlFilter": "*", "resourceTypes": ["script", "stylesheet", "xmlhttprequest", "image"],
				"initiatorDomains": [v[0]]
			}
		}
	});

	chrome.declarativeNetRequest.updateDynamicRules(
		{
			addRules,
			removeRuleIds: previousRules
		});
}

updateWhitelist();

chrome.runtime.onMessage.addListener(async function(request, info){
	if (request == 'update_whitelist')
		updateWhitelist();
});

function isWhitelisted(tab)
{
	if (typeof whitelisted_domains[tab.hostname] != 'undefined')
		return true;
	
	for (var i in tab.host_levels)
		if (typeof whitelisted_domains[tab.host_levels[i]] != 'undefined')
			return true;
	
	return false;
}

function getWhitelistedDomain(tab)
{
	if (typeof whitelisted_domains[tab.hostname] != 'undefined')
		return tab.hostname;
	
	for (var i in tab.host_levels)
		if (typeof whitelisted_domains[tab.host_levels[i]] != 'undefined')
			return tab.host_levels[i];
	
	return false;
}

async function toggleWhitelist(tab) {
	if (tab.url.indexOf('http') != 0 || !tab_list[tab.id])
		return;

	if (tab_list[tab.id].whitelisted) {
		var hostname = getWhitelistedDomain(tab_list[tab.id]);
		delete whitelisted_domains[tab_list[tab.id].hostname];
	}
	else
		whitelisted_domains[tab_list[tab.id].hostname] = true;

	chrome.storage.local.set({ 'whitelisted_domains': whitelisted_domains }, function () {
		for (var i in tab_list)
			if (tab_list[i].hostname == tab_list[tab.id].hostname)
				tab_list[i].whitelisted = !tab_list[tab.id].whitelisted;
	});
	if (isManifestV3) {
		await UpdateWhitelistRules();
	}
}


// Maintain tab list

function getPreparedTab(tab)
{
	tab.hostname = false;
	tab.whitelisted = false;
	tab.host_levels = [];
	
	if (tab.url)
	{
		tab.hostname = getHostname(tab.url, true);
		
		if (tab.hostname)
		{
			var parts = tab.hostname.split('.');
			
			for (var i=parts.length; i>=2; i--)
				tab.host_levels.push(parts.slice(-1*i).join('.'));
			
			tab.whitelisted = isWhitelisted(tab);
		}
	}
	
	return tab;
}

function onCreatedListener(tab)
{
    tab_list[tab.id] = getPreparedTab(tab);
}

function onUpdatedListener(tabId, changeInfo, tab) {
	if (changeInfo.status)
		tab_list[tab.id] = getPreparedTab(tab);
}

function onRemovedListener(tabId) {
    if (tab_list[tabId])
		delete tab_list[tabId];
}

function recreateTabList()
{
	tab_list = {};
	
	chrome.tabs.query({}, function(results) {
		results.forEach(onCreatedListener);
		
		for (var i in tab_list)
			doTheMagic(tab_list[i].id);
	});
}

chrome.tabs.onCreated.addListener(onCreatedListener);
chrome.tabs.onUpdated.addListener(onUpdatedListener);
chrome.tabs.onRemoved.addListener(onRemovedListener);

chrome.runtime.onStartup.addListener(function(d){
	cached_rules = {};
	recreateTabList();
});

chrome.runtime.onInstalled.addListener(function(d){
	cached_rules = {};
	
	if (d.reason == "update" && chrome.runtime.getManifest().version > d.previousVersion)
		recreateTabList();
});


// URL blocking

function blockUrlCallback(d)
{
	// Cached request: find the appropriate tab
	//TODO: parse rules.json for this function. 

	if (d.tabId == -1 && d.initiator) {
		let hostname = getHostname(d.initiator, true);
		
		for (let tabId in tab_list) {
			if (tab_list[tabId].hostname == getHostname(d.initiator, true)) {
				d.tabId = parseInt(tabId);
				break;
			}
		}
	}
	
	
	if (tab_list[d.tabId] && !tab_list[d.tabId].whitelisted && d.url)
	{
		var clean_url = d.url.split('?')[0];
		
		
		// To shorten the checklist, many filters are grouped by keywords
		
		for (var group in block_urls.common_groups)
		{
			if (d.url.indexOf(group) > -1)
			{
				var group_filters = block_urls.common_groups[group];
				
				for (var i in group_filters)
				{
					if ((group_filters[i].q && d.url.indexOf(group_filters[i].r) > -1) || (!group_filters[i].q && clean_url.indexOf(group_filters[i].r) > -1))
					{
						// Check for exceptions
						
						if (group_filters[i].e && tab_list[d.tabId].host_levels.length > 0)
							for (var level in tab_list[d.tabId].host_levels)
								for (var exception in group_filters[i].e)
									if (group_filters[i].e[exception] == tab_list[d.tabId].host_levels[level])
										return {cancel:false};
						
						return {cancel:true};
					}
				}
			}
		}
		
		
		// Check ungrouped filters
		
		var group_filters = block_urls.common;
		
		for (var i in group_filters)
		{
			if ((group_filters[i].q && d.url.indexOf(group_filters[i].r) > -1) || (!group_filters[i].q && clean_url.indexOf(group_filters[i].r) > -1))
			{
				// Check for exceptions
				
				if (group_filters[i].e && tab_list[d.tabId].host_levels.length > 0)
					for (var level in tab_list[d.tabId].host_levels)
						for (var exception in group_filters[i].e)
							if (group_filters[i].e[exception] == tab_list[d.tabId].host_levels[level])
								return {cancel:false};
				
				return {cancel:true};
			}
		}
		
		
		// Site specific filters
		
		if (d.tabId > -1 && tab_list[d.tabId].host_levels.length > 0)
		{
			for (var level in tab_list[d.tabId].host_levels)
			{
				if (block_urls.specific[tab_list[d.tabId].host_levels[level]])
				{
					var rules = block_urls.specific[tab_list[d.tabId].host_levels[level]];
					
					for (var i in rules)
						if (d.url.indexOf(rules[i]) > -1)
							return {cancel:true};
				}
			}
		}
	}
	
	return {cancel:false};
}
if (!isManifestV3) {
	chrome.webRequest.onBeforeRequest.addListener(blockUrlCallback, { urls: ["http://*/*", "https://*/*"], types: ["script", "stylesheet", "xmlhttprequest"] }, ["blocking"]);


	chrome.webRequest.onHeadersReceived.addListener(function(d) {
		if (tab_list[d.tabId]) {
			d.responseHeaders.forEach(function(h) {
				if (h.name == "Content-Type" || h.name == "content-type") {
					xml_tabs[d.tabId] = h.value.indexOf("/xml") > -1;
				}
			});
		}
		
		return {cancel:false};
	}, {urls:["http://*/*", "https://*/*"], types:["main_frame"]}, ["blocking", "responseHeaders"]);
	
}
// Reporting

function reportWebsite(info, tab)
{
	if (tab.url.indexOf('http') != 0 || !tab_list[tab.id])
		return;
	
	
	var hostname = getHostname(tab.url);
	
	if (hostname.length == 0)
		return;
	
	
	if (tab_list[tab.id].whitelisted)
	{
		return chrome.notifications.create('report', {
			type: "basic",
			title: chrome.i18n.getMessage("reportSkippedTitle", hostname),
			message: chrome.i18n.getMessage("reportSkippedMessage"),
			iconUrl: "icons/48.png"
		});
	}
	
	
	chrome.tabs.create({url:"https://github.com/OhMyGuus/I-Dont-Care-About-Cookies/issues/new"});
}


// Adding custom CSS/JS

function activateDomain(hostname, tabId, frameId)
{
	if (!cached_rules[hostname])
		cached_rules[hostname] = rules[hostname] || {};
	
	if (!cached_rules[hostname])
		return false;
	
	let cached_rule = cached_rules[hostname],
		status = false;
	
	// cached_rule.s = Custom css for webpage
	// cached_rule.c = Common css for webpage
	// cached_rule.j = Common js  for webpage

	if (typeof cached_rule.s != 'undefined') {
		insertCSS({ tabId, frameId: frameId || 0, css: cached_rule.s });
		status = true;
	}
	
	if (typeof cached_rule.c != 'undefined') {
		insertCSS({ tabId, frameId: frameId || 0, css: commons[cached_rule.c] });
		status = true;
	}

	if (typeof cached_rule.j != 'undefined') {
		executeScript({ tabId, frameId, file: 'data/js/' + (cached_rule.j > 0 ? 'common' + cached_rule.j : hostname) + '.js' });
		status = true;
	}

	return status;
}


function doTheMagic(tabId, frameId, anotherTry)
{
	if (!tab_list[tabId] || tab_list[tabId].url.indexOf('http') != 0)
		return;
	
	if (tab_list[tabId].whitelisted)
		return;

	// Common CSS rules
	insertCSS({ tabId, frameId: frameId || 0, file: "data/css/common.css" }, function () {
		// A failure? Retry.
		if (chrome.runtime.lastError) {
			console.log(chrome.runtime.lastError);

			let currentTry = (anotherTry || 1);

			if (currentTry == 5)
				return;

			return doTheMagic(tabId, frameId || 0, currentTry + 1);
		}

		// Common social embeds
		executeScript({ tabId, frameId, file: 'data/js/embeds.js' });

		if (activateDomain(tab_list[tabId].hostname, tabId, frameId || 0))
			return;

		for (var level in tab_list[tabId].host_levels)
			if (activateDomain(tab_list[tabId].host_levels[level], tabId, frameId || 0))
				return true;

		// Common JS rules when custom rules don't exist
		executeScript({ tabId, frameId, file: 'data/js/common.js' });
	});
}


chrome.webNavigation.onCommitted.addListener(function(tab) {
	if (tab.frameId > 0)
		return;
	
	tab_list[tab.tabId] = getPreparedTab(tab);
	
	doTheMagic(tab.tabId);
});


chrome.webRequest.onResponseStarted.addListener(function(tab) {
	if (tab.frameId > 0)
		doTheMagic(tab.tabId, tab.frameId);
}, {urls: ['<all_urls>'], types: ['sub_frame']});




// Toolbar menu

chrome.runtime.onMessage.addListener(function(request, info, sendResponse) {
	if (typeof request == 'object')
	{
		if (request.tabId && tab_list[request.tabId])
		{
			if (request.command == 'get_active_tab')
			{
				var response = {tab: tab_list[request.tabId]};
				
				if (response.tab.whitelisted)
					response.tab.hostname = getWhitelistedDomain(tab_list[request.tabId]);

				sendResponse(response);
			}
			else if (request.command == 'toggle_extension')
				 toggleWhitelist(tab_list[request.tabId]);
			else if (request.command == 'report_website')
				chrome.tabs.create({ url: "https://github.com/OhMyGuus/I-Dont-Care-About-Cookies/issues/new?assignees=OhMyGuus&labels=Website+request&template=site-request.md&title=%5BREQ%5D+Website+request%3A+" + encodeURIComponent(tab_list[request.tabId].url) });
			else if (request.command == 'refresh_page')
				executeScript({ tabId: request.tabId, func: () => { window.location.reload(); } });
		}
		else
		{
			 if (request.command == 'open_options_page')
				chrome.tabs.create({url:chrome.runtime.getURL('data/options.html')});
		}
	}
});



function insertCSS(injection, callback) {
	let { tabId, css, file, frameId } = injection

	if (isManifestV3) {
		chrome.scripting.insertCSS({ target: { tabId: tabId, frameIds: [frameId || 0] }, css: css, files: file ? [file] : undefined }, callback);
	} else {
		chrome.tabs.insertCSS(tabId, { file, code: css, frameId: frameId || 0, runAt: xml_tabs[tabId] ? 'document_idle' : 'document_start' }, callback)
	}
}

function executeScript(injection, callback) {
	let { tabId, func, file, frameId } = injection
	if (isManifestV3) {
		// manifest v3 
		chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId || 0] }, files: file ? [file] : undefined, func }, callback);
	} else {
		// manifest v2
		chrome.tabs.executeScript(tabId, { file, frameId: frameId || 0, code: func == undefined ? undefined : "(" + func.toString() + ")();", runAt: xml_tabs[tabId] ? 'document_idle' : 'document_end' }, callback);
	}
}