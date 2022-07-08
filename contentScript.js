/** Types of messages for content-background communication. */
const MessageType = {
  PROTON_DB: "protonDb",
  DECK_VERIFIED: "deckVerified",
  PROTON_DB_AND_DECK_VERIFIED: "protonDb_and_deckVerified"
}

/** Names of the Deck Verification. */
const deckBadges = [
  "unknown",
  "unsupported",
  "playable",
  "verified"
];

/** Icon URLs for the Deck Verified Icons. */
const deckBadgeIcons = [
  // unknown
  "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/clans//39049601/1a3a76c9e8dacf756b822247a23bef435768a5ff.png",

  // unsupported
  "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/clans//39049601/dd56b9d37f5b5bf4da236b9bd3d62e3d120d7df5.png",

  // playable
  "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/clans//39049601/16e802051c2a3b99c7f1720b7de7fad6e540e02a.png",

  // verified
  "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/clans//39049601/82a3cff3038fbb4c36fabb5dd79540b23fa9a4d4.png"
];

const port = chrome.runtime.connect();

// inject ProtonDB font into the store page
let font = document.createElement("style");
font.innerText = "@import url('https://fonts.googleapis.com/css2?family=Rationale&display=swap');";
document.head.appendChild(font);

/** Handle pages that show search results. */
function handleSearchResults() {
  let searchResultsElement = document.getElementById("search_results");
  if (!searchResultsElement) return;
  const observer = new MutationObserver(tagSearchResults);
  observer.observe(searchResultsElement, {childList: true, subtree: true});
  tagSearchResults();

  /**
   * Tag all search result rows with their icons and medals.
   * This also makes sure that only rows get marked, that aren't already.
   */
  function tagSearchResults() {
    let rows = document.querySelectorAll("a.search_result_row:not(.tagged-medal-and-verification)");
    rows.forEach(row => row.classList.add("tagged-medal-and-verification"));
    if (!rows) return;

    let appRows = new Map();
    for (let row of rows) {
      let appId = row.dataset.dsAppid;
      appRows.set(appId, row);
    }

    port.onMessage.addListener(({type, appId, data}) => {
      if (type !== MessageType.PROTON_DB_AND_DECK_VERIFIED) return;
      let {protonDb, deckVerified} = data;
      let row = appRows.get(appId);
      if (!row) return;
      let iconRow = row.querySelector(".col.search_name.ellipsis").children[1];
      let deckVerifiedIcon = createDeckVerifiedIcon(deckVerified.resolved_category);
      if (deckVerified) iconRow.append(deckVerifiedIcon);
      let protonDbMedal = createProtonDbMedal(appId, protonDb.tier);
      if (protonDbMedal) iconRow.append(protonDbMedal);
    });

    for (let [appId, row] of appRows) {
      port.postMessage({
        type: MessageType.PROTON_DB_AND_DECK_VERIFIED,
        appId
      })
    }
  }

  /**
   * Create the HTML element to display the ProtonDB medal.
   * @param {string} tier Tier of the medal
   * @return {HTMLAnchorElement|null}
   */
  function createProtonDbMedal(appId, tier) {
    if (!appId || !tier || tier === "pending") return null;
    let dbTag = document.createElement("span");
    dbTag.innerText = tier.toUpperCase();
    dbTag.classList.add("proton-db-tier-" + tier);
    dbTag.classList.add("col");
    let dbLink = document.createElement("a");
    dbLink.href = "https://www.protondb.com/app/" + appId;
    dbLink.target = "_blank";
    dbLink.appendChild(dbTag);
    return dbLink;
  }

  /**
   * Create the HTML element to display the Deck Verification.
   * @param {0 | 1 | 2 | 3} cat
   * @return {HTMLSpanElement}
   */
  function createDeckVerifiedIcon(cat) {
    let verifiedTag = document.createElement("span");
    let verifiedStatus = deckBadges[cat];
    let verifiedImg = document.createElement("img");
    verifiedImg.src = deckBadgeIcons[cat];
    verifiedTag.appendChild(verifiedImg);
    verifiedTag.classList.add("deck-" + verifiedStatus);
    verifiedTag.classList.add("col");
    return verifiedTag;
  }
}
handleSearchResults();

function handleAppPage() {
  let gameMetaData = document.querySelector(".game_meta_data");
  if (!gameMetaData) return;
  let verifiedResults = document.querySelector("[data-featuretarget='deck-verified-results']")
  if (verifiedResults) {
    verifiedResults.remove();
    gameMetaData.children[0].prepend(verifiedResults);
  }

  port.onMessage.addListener(({type, appId, data}) => {
    if (type !== MessageType.PROTON_DB) return;
    let {tier} = data;
    let parser = new DOMParser();
    let protonHtml = `
    <div id="protondb-results" class="block">
      <div class="protondb-results title">
        <img src="https://www.protondb.com/sites/protondb/images/site-logo.svg"></img>
        <span class="protondb-logo protondb-logo-proton">proton</span>
        <span class="protondb-logo protondb-logo-db">db</span>
      </div>
      <span class="protondb-results medal protondb-tier-${tier}">
        ${tier.toUpperCase()}
      </span>
    </div>
  `;
    let protonElement = parser
      .parseFromString(protonHtml, "text/html")
      .getElementById("protondb-results");
    gameMetaData.children[0].prepend(protonElement);
  });
  let {appId} = document.location.pathname.match(/\/(?<appId>\d+)\/[^/]+\//).groups;
  port.postMessage({type: MessageType.PROTON_DB, appId});
}
handleAppPage();