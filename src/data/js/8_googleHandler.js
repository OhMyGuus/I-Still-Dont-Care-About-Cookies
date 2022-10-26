/*  Google handler */
/*  Handler is only used for Google */

function _sl(s, c) {
  return (c || document).querySelector(s);
}

function _id(s) {
  return document.getElementById(s);
}

const _i = setInterval(function () {
  const html = _sl("html");

  if (!html || /idc8_343/.test(html.className)) {
    return;
  }

  clearInterval(_i);

  html.className += " idc8_343";

  let c = 0;
  const l = document.location;
  const i = setInterval(function () {
    let e;

    if (l.hostname.split(".")[0] == "consent") {
      if (l.pathname == "/m") {
        e = _sl(
          'form[action*="//consent."][action$="/s"] button, form[action*="//consent."][action$="/save"] button'
        );

        if (e) {
          e.click();
          c = 299;
        }
      }

      // Mobile only, ie google.co.uk (or in FF Nightly, on google.com search results)
      else if (l.pathname == "/ml") {
        e = _sl(".saveButtonContainerNarrowScreen > form:last-child .button");

        if (e) {
          e.click();
          c = 299;
        }
      }
    }

    // https://www.google.com/finance/
    else if (
      l.hostname == "ogs.google.com" &&
      l.pathname == "/widget/callout"
    ) {
      if (
        document
          .evaluate(
            '//span[contains(text(), "This site uses cookies")]',
            document,
            null,
            XPathResult.ANY_TYPE,
            null
          )
          .iterateNext()
      ) {
        _sl("button").click();
        c = 299;
      }
    } else {
      // The latest cookie popup, desktop and mobile

      const container = _sl('div[aria-modal="true"][style*="block"]');

      if (
        container &&
        _sl('a[href*="policies.google.com/technologies/cookies"]', container)
      ) {
        _sl("button + button", container).click();

        // Autofocus on the search field
        e = _sl(
          'form[role="search"][action="/search"]:not([id]) input[aria-autocomplete="both"]'
        );
        if (e) e.focus();

        c = 299;
      }

      // General privacy reminder
      e = _sl(
        'form[action^="/signin/privacyreminder"] > div > span > div:not([role]) > div:not([tabindex]) span + div'
      );
      if (e) e.click();

      // #cns=1
      if (l.hash == "#cns=1") {
        l.hash = "#cns=0";
      }
    }

    c++;

    if (c == 300) {
      clearInterval(i);
    }
  }, 250 + c * 10);
}, 250);
