// Some pages like https://firmen.wko.at/codingyourlife-eu/nieder%C3%B6sterreich/?firmaid=f1504ba8-a92d-48ac-9ba1-fdcba892209d are not able to scroll after getting rid of the cookie message due to body overflow hidden.
// When modifiying also check e.g. https://www.apple.com/at/airpods-3rd-generation/ scroll effect but I found no negative impact.
(function() {
    const id = "i-still-dont-care-about-cookies_bodyscrollfix";

    function forcefullyEnableScrollingOnAllSitesOnce() {
        if (!document.getElementById(id)) {
            const styleElement = document.createElement('style');
            styleElement.id = id;
            styleElement.innerHTML = `body { overflow: unset !important; }`;
            document.body.appendChild(styleElement);
        }
    }

    forcefullyEnableScrollingOnAllSitesOnce();
})();
