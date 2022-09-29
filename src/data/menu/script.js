const toggle = document.getElementById("toggle");
const refresh = document.getElementById("refresh");
const report = document.getElementById("report");
const options = document.getElementById("options");
let currentTab = false;

report.textContent = chrome.i18n.getMessage("menuReport");
options.textContent = chrome.i18n.getMessage("optionsTitle");

function reloadMenu(enableRefreshButton) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.runtime.sendMessage(
      {
        command: "get_active_tab",
        tabId: tabs[0].id,
      },
      function (message) {
        message = message || {};
        currentTab = message.tab ? message.tab : false;

        if (message.tab && message.tab.hostname) {
          toggle.textContent = chrome.i18n.getMessage(
            message.tab.whitelisted ? "menuEnable" : "menuDisable",
            message.tab.hostname
          );
          toggle.style.display = "block";

          report.style.display = message.tab.whitelisted ? "none" : "block";
        } else {
          toggle.textContent = "";
          toggle.style.display = "none";

          report.style.display = "none";
        }

        if (typeof enableRefreshButton != "undefined") {
          refresh.style.display = "block";
          toggle.style.display = "none";
          report.style.display = "none";
        }
      }
    );
  });
}

toggle.addEventListener("click", function (e) {
  chrome.runtime.sendMessage(
    {
      command: "toggle_extension",
      tabId: currentTab.id,
    },
    function (message) {
      reloadMenu(true);
    }
  );
});

refresh.addEventListener("click", function (e) {
  chrome.runtime.sendMessage(
    {
      command: "refresh_page",
      tabId: currentTab.id,
    },
    function (message) {
      window.close();
    }
  );
});

report.addEventListener("click", function (e) {
  chrome.runtime.sendMessage(
    {
      command: "report_website",
      tabId: currentTab.id,
    },
    function (message) {
      window.close();
    }
  );
});

options.addEventListener("click", function (e) {
  chrome.runtime.sendMessage(
    {
      command: "open_options_page",
    },
    function (message) {
      window.close();
    }
  );
});

reloadMenu();
